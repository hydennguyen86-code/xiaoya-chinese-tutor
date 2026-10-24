import fs from 'node:fs';
import path from 'node:path';
import { analyseTones, profileFromAudio, emptyProfile, expectedTones } from '../server/tones.mjs';
import { validateToneLabel } from '../server/toneEvaluation.mjs';
import { TONE_ITEMS } from './toneItems.mjs';
import { saveResult } from './record.mjs';

export async function evaluateRecordings(directory) {
  const root = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.recordings)) throw new Error('Unsupported recording manifest.');
  const entries = manifest.recordings.filter((entry) => {
    const item = TONE_ITEMS.find((item) => item.id === entry.id && item.text === entry.text);
    return item && validateToneLabel(entry.label, expectedTones(item.text).length);
  });
  if (!entries.length) throw new Error('No human-labeled recordings. Record and label audio first.');
  const seen = new Set();
  const recordings = entries.map((entry) => {
    if (seen.has(entry.id)) throw new Error('Duplicate recording id.');
    seen.add(entry.id);
    if (entry.file !== `${entry.id}.audio`) throw new Error('Invalid recording filename.');
    const file = fs.realpathSync(path.join(root, entry.file));
    if (path.dirname(file) !== root) throw new Error('Audio must be inside the recording directory.');
    return { ...entry, audio: fs.readFileSync(file) };
  });
  // Calibrate the person's range from the captured set. This is descriptive,
  // not an independent held-out validation or evidence for threshold tuning.
  let profile = emptyProfile();
  for (const entry of recordings) profile = await profileFromAudio(entry.audio, profile);
  const matrix = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  const counts = { self: 0, expert: 0, recordings: recordings.length, labeledSyllables: 0, correct: 0, unclear: 0, humanUnclear: 0 };
  const sources = { self: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]), expert: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]) };
  for (const entry of recordings) {
    const report = await analyseTones(entry.audio, entry.text, { profile });
    counts[entry.label.source] += 1;
    entry.label.tones.forEach((truth, index) => {
      if (truth === 0) {
        counts.humanUnclear += 1;
        return;
      }
      const heard = report.syllables[index]?.heard ?? 0;
      matrix[truth][heard] += 1;
      sources[entry.label.source][truth][heard] += 1;
      counts.labeledSyllables += 1;
      if (truth === heard) counts.correct += 1;
      if (!heard) counts.unclear += 1;
    });
  }
  console.log('Rows: human label 1–4. Columns: unclear, predicted 1,2,3,4.');
  console.table(matrix.slice(1));
  console.log(counts);
  saveResult(
    'tones-human',
    { thresholds: 'unchanged', rangeCalibration: 'same captured set; not held-out', labels: 'human; self/expert reported separately' },
    { matrix, bySource: sources, counts },
  );
}
