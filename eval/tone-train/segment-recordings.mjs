// Turns a private recording set (manifest.json + labels.<name>.json, as made by
// the recording kit) into the same JSONL rows as make-dataset.mjs, with the
// human tone labels and the app's energy-based syllable boundaries, so
// tone/train.py --human can measure a classifier on real speech. Audio stays
// where it is: rows point at the original files with absolute paths.
//
//   node eval/tone-train/segment-recordings.mjs /path/to/split/huan [--labels=labels.X.json] > human.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { readRecordingDataset } from '../recordings.mjs';
import { decodeToPcm, pitchTrack, segment, expectedTones } from '../../server/tones.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: segment-recordings.mjs <recording dir> [--labels=<file>]');
  process.exit(1);
}
const labelsFile = process.argv.find((a) => a.startsWith('--labels='))?.slice(9);
const { recordings } = readRecordingDataset(dir, { labelsFile });
let kept = 0;
for (const entry of recordings) {
  const chars = [...entry.text];
  const expected = expectedTones(entry.text).map((s) => s.expected);
  const pcm = await decodeToPcm(fs.readFileSync(entry.file));
  const { f0, rms } = pitchTrack(pcm);
  const parts = segment(rms, f0, chars.length);
  if (!parts) {
    console.error(`[skip] ${entry.id}: not enough speech to split`);
    continue;
  }
  const row = {
    file: path.resolve(entry.file),
    id: entry.id,
    text: entry.text,
    voice: `human:${path.basename(dir)}`,
    source: 'human',
    kind: entry.kind,
    labelSource: entry.label.source,
    boundaryMethod: 'energy',
    syllables: chars.map((char, i) => ({
      char,
      tone: entry.label.tones[i], // 0 = the labeller could not tell, 5 = neutral
      expected: expected[i] ?? 0, // dictionary tone, for reference only; never a label
      start: Math.round(parts[i][0] * 10) / 1000,
      end: Math.round((parts[i][1] + 1) * 10) / 1000,
      pos: chars.length === 1 ? 'single' : i === 0 ? 'first' : i === chars.length - 1 ? 'last' : 'mid',
    })),
  };
  process.stdout.write(`${JSON.stringify(row)}\n`);
  kept += 1;
}
console.error(`${kept}/${recordings.length} recordings written`);
