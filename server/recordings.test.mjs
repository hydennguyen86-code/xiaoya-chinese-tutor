import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateRecordings } from '../eval/recordings.mjs';

test('human-eval pipeline aggregates labels without retaining identities or audio in results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-eval-fixture-'));
  try {
    const rate = 16000,
      count = rate;
    const wav = Buffer.alloc(44 + count * 2);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + count * 2, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 180 * i) / rate)), 44 + i * 2);
    const recordings = [
      {
        id: 'single-1-1',
        text: '妈',
        kind: 'single',
        file: 'single-1-1.audio',
        label: { source: 'self', reviewedBy: 'SYNTHETIC-IDENTITY', tones: [1] },
      },
      {
        id: 'word-1',
        text: '中国',
        kind: 'word',
        file: 'word-1.audio',
        label: { source: 'expert', reviewedBy: 'SYNTHETIC-IDENTITY', tones: [1, 2] },
      },
    ];
    for (const entry of recordings) fs.writeFileSync(path.join(dir, entry.file), wav);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, recordings }));
    // Synthetic fixture ONLY: never persist this as a human evaluation run.
    const result = await evaluateRecordings(dir, { persist: false });
    assert.equal(result.counts.recordings, 2);
    assert.equal(result.counts.self, 1);
    assert.equal(result.counts.expert, 1);
    assert.equal(result.counts.labeledSyllables, 3);
    assert.equal(
      result.matrix.flat().reduce((a, b) => a + b),
      3,
    );
    for (const secret of ['SYNTHETIC-IDENTITY', dir, '妈', '中国', '.audio']) assert.equal(JSON.stringify(result).includes(secret), false);
    recordings[0].file = '../outside.audio';
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, recordings }));
    await assert.rejects(() => evaluateRecordings(dir, { persist: false }), /filename/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { readRecordingDataset } from '../eval/recordings.mjs';
test('external sidecars use human tones, never expected/app guesses, detect conflicts and stay read-only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-sidecar-fixture-'));
  try {
    fs.writeFileSync(path.join(dir, 'single-1-1.audio'), Buffer.alloc(1200));
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ version: 1, recordings: [{ id: 'single-1-1', text: '妈', file: 'single-1-1.audio', expected: [1], label: null }] }),
    );
    fs.writeFileSync(path.join(dir, 'app-scores.json'), JSON.stringify({ items: [{ id: 'single-1-1', heard: [1] }] }));
    assert.equal(readRecordingDataset(dir).inventory.labeledItems, 0);
    const label = { version: 1, source: 'self', reviewedBy: 'SYNTHETIC', labels: [{ id: 'single-1-1', tones: [4], expected: [1] }] };
    const serialized = JSON.stringify(label);
    fs.writeFileSync(path.join(dir, 'labels.self.json'), serialized);
    const data = readRecordingDataset(dir);
    assert.deepEqual(data.recordings[0].label.tones, [4]);
    assert.equal(data.inventory.complete, false);
    assert.equal(fs.readFileSync(path.join(dir, 'labels.self.json'), 'utf8'), serialized);
    label.labels[0].tones = [2];
    fs.writeFileSync(path.join(dir, 'labels.second.json'), JSON.stringify(label));
    assert.throws(() => readRecordingDataset(dir), /Conflicting/);
    assert.deepEqual(readRecordingDataset(dir, { labelsFile: 'labels.self.json' }).recordings[0].label.tones, [4]);
    assert.throws(() => readRecordingDataset(dir, { labelsFile: '../outside.json' }), /filename/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('label-server sidecars (file-level peer source) are read, unusable rows are reported', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-label-sidecar-'));
  try {
    const recordings = [
      { id: 'single-1-1', text: '妈', kind: 'single', file: 'single-1-1.audio' },
      { id: 'word-1', text: '中国', kind: 'word', file: 'word-1.audio' },
      { id: 'word-13', text: '手机', kind: 'word', file: 'word-13.audio' },
    ];
    for (const entry of recordings) fs.writeFileSync(path.join(dir, entry.file), 'x');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, recordings }));
    // the shape written by content-for-misu/recording-kit/label-server.mjs
    fs.writeFileSync(
      path.join(dir, 'labels.SYNTHETIC.json'),
      JSON.stringify({
        version: 1,
        labeler: 'SYNTHETIC',
        source: 'peer',
        reviewedBy: 'SYNTHETIC',
        items: {
          'single-1-1': { order: 1, text: '妈', tones: [1], badCut: false },
          'word-1': { order: 2, text: '中国', tones: [1, 2], badCut: false },
          'word-13': { order: 3, text: '手机', badCut: true },
        },
        incomplete: [],
      }),
    );
    const { recordings: labelled, inventory } = readRecordingDataset(dir);
    assert.deepEqual(
      labelled.map((r) => [r.id, r.label.source]),
      [
        ['single-1-1', 'peer'],
        ['word-1', 'peer'],
      ],
    );
    assert.equal(inventory.rejectedLabels, 1);
    assert.deepEqual(inventory.rejected, [{ id: 'word-13', reason: 'bad cut' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
