import fs from 'node:fs';
import path from 'node:path';
import { analyseTones, profileFromAudio, emptyProfile, expectedTones } from '../server/tones.mjs';
import { validateToneLabel } from '../server/toneEvaluation.mjs';
import { TONE_ITEMS } from './toneItems.mjs';
import { saveResult } from './record.mjs';

// Read external captures in place. Never infer a human label from expected/app scores.
export function readRecordingDataset(directory, { labelsFile } = {}) {
  const root = fs.realpathSync(directory);
  function localFile(name) {
    if (path.basename(name) !== name) throw new Error('Invalid recording filename.');
    const file = fs.realpathSync(path.join(root, name));
    if (path.dirname(file) !== root) throw new Error('Audio/labels must be inside the recording directory.');
    return file;
  }
  const manifest = JSON.parse(fs.readFileSync(localFile('manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.recordings)) throw new Error('Unsupported recording manifest.');
  const sidecars = labelsFile
    ? [labelsFile]
    : fs
        .readdirSync(root)
        .filter((f) => /^labels\..+\.json$/.test(f))
        .sort();
  const labels = new Map();
  function add(id, label) {
    if (!validateToneLabel(label, TONE_ITEMS.find((i) => i.id === id)?.text.length ?? -1, 5)) return;
    const old = labels.get(id);
    if (old && JSON.stringify(old.tones) !== JSON.stringify(label.tones))
      throw new Error('Conflicting human labels. Select one sidecar explicitly with --labels=<filename>.');
    labels.set(id, { ...label, reviewedBy: label.reviewedBy.trim() });
  }
  for (const entry of manifest.recordings) if (entry.label) add(entry.id, entry.label);
  for (const name of sidecars) {
    const data = JSON.parse(fs.readFileSync(localFile(name), 'utf8'));
    if (data.version !== 1) throw new Error('Unsupported labels version.');
    const rows = data.labels ?? data.items ?? data.recordings;
    if (!rows || typeof rows !== 'object') throw new Error('Labels need labels/items/recordings rows.');
    const list = Array.isArray(rows)
      ? rows
      : Object.entries(rows).map(([id, label]) => ({ id, ...(Array.isArray(label) ? { tones: label } : label) }));
    for (const row of list)
      add(row.id, row.label ?? { ...row, source: row.source ?? data.source, reviewedBy: row.reviewedBy ?? data.reviewedBy });
  }
  const seen = new Set(),
    recordings = [],
    calibration = [];
  let availableItems = 0;
  for (const entry of manifest.recordings) {
    if (seen.has(entry.id)) throw new Error('Duplicate recording id.');
    seen.add(entry.id);
    const item = TONE_ITEMS.find((item) => item.id === entry.id && item.text === entry.text);
    const isCalibration = /^sentence-[1-9][0-9]*$/.test(entry.id) && typeof entry.text === 'string';
    if (!item && !isCalibration) continue;
    if (entry.file !== `${entry.id}.audio`) throw new Error('Invalid recording filename.');
    const file = localFile(entry.file);
    if (item) availableItems++;
    const label = labels.get(entry.id);
    if (item && label) recordings.push({ ...entry, label, file });
    if (isCalibration) calibration.push({ ...entry, file });
  }
  return {
    recordings,
    calibration,
    inventory: {
      availableItems,
      labeledItems: recordings.length,
      requiredItems: TONE_ITEMS.length,
      complete: recordings.length === TONE_ITEMS.length,
      sidecars: sidecars.length,
    },
  };
}

export async function evaluateRecordings(directory, { persist = true, labelsFile } = {}) {
  const { recordings: entries, calibration: calibrationEntries, inventory } = readRecordingDataset(directory, { labelsFile });
  const recordings = entries.map((entry) => ({ ...entry, audio: fs.readFileSync(entry.file) }));
  const calibration = calibrationEntries.length
    ? calibrationEntries.map((entry) => fs.readFileSync(entry.file))
    : recordings.map((entry) => entry.audio);
  // Calibrate the person's range from the captured set. This is descriptive,
  // not an independent held-out validation or evidence for threshold tuning.
  let profile = emptyProfile();
  for (const audio of calibration) profile = await profileFromAudio(audio, profile);
  const matrix = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  const counts = {
    self: 0,
    expert: 0,
    recordings: recordings.length,
    labeledSyllables: 0,
    correct: 0,
    unclear: 0,
    humanUnclear: 0,
    humanNeutral: 0,
  };
  const sources = { self: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]), expert: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]) };
  for (const entry of recordings) {
    const report = await analyseTones(entry.audio, entry.text, { profile });
    counts[entry.label.source] += 1;
    entry.label.tones.forEach((truth, index) => {
      if (truth === 0) {
        counts.humanUnclear += 1;
        return;
      }
      if (truth === 5) {
        counts.humanNeutral += 1;
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
  if (persist)
    saveResult(
      'tones-human',
      {
        thresholds: 'unchanged',
        rangeCalibration: calibrationEntries.length ? 'separate sentence clips; same person' : 'same captured set; not held-out',
        labels: 'human; self/expert reported separately',
      },
      { matrix, bySource: sources, counts, inventory },
    );
  return { matrix, bySource: sources, counts, inventory };
}
