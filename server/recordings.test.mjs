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
