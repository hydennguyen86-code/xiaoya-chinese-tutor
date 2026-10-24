import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { importCommonVoice, corpusStore, mountListeningCorpus } from './listeningCorpus.mjs';
test('optional corpus filters official release TSV, omits identity, serves only catalog clips and rejects symlinks', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-cv-'));
  const source = path.join(temp, 'zh-CN');
  const dataDir = path.join(temp, 'private');
  fs.mkdirSync(path.join(source, 'clips'), { recursive: true });
  fs.writeFileSync(path.join(source, 'clips', 'cv1.mp3'), 'synthetic non-audio test fixture');
  fs.writeFileSync(
    path.join(source, 'validated.tsv'),
    [
      'client_id\tpath\tsentence\tlocale\tup_votes\tdown_votes',
      'private-speaker\tcv1.mp3\t你好，今天见。\tzh-CN\t3\t0',
      'private-speaker\tcv1.mp3\t你好，今天见。\tzh-CN\t3\t0',
      'private-speaker\tcv1.mp3\t明天见。\tzh-TW\t3\t0',
      'private-speaker\tcv1.mp3\t下午见。\tzh-CN\t1\t0',
      'private-speaker\t../secret.mp3\t明天再说。\tzh-CN\t3\t0',
    ].join('\n'),
  );
  const args = { source, dataDir, version: 'cv-test', sourceUrl: 'https://mozilladatacollective.com/datasets/test' };
  let server;
  try {
    assert.equal(await importCommonVoice(args), 1);
    const store = corpusStore(dataDir);
    const [clip] = store.list();
    assert.equal(clip.text, '你好，今天见。');
    assert.ok(!JSON.stringify(clip).includes('private-speaker'));
    assert.equal(store.audio('../secret'), null);
    await assert.rejects(importCommonVoice({ ...args, sourceUrl: 'https://example.com/file' }));
    const app = express();
    mountListeningCorpus(app, dataDir);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await fetch(`${base}/api/listening-corpus`)).json()).entries.length, 1);
    const response = await fetch(`${base}/api/listening-corpus/${clip.id}/audio`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${base}/api/listening-corpus/${'0'.repeat(24)}/audio`)).status, 404);
    fs.unlinkSync(store.audio(clip.id));
    fs.symlinkSync(path.join(source, 'clips', 'cv1.mp3'), path.join(dataDir, 'listening-corpus', `${clip.id}.mp3`));
    assert.equal(store.audio(clip.id), null);
    fs.writeFileSync(path.join(source, 'validated.tsv'), 'path\tsentence');
    await assert.rejects(importCommonVoice(args));
    assert.equal(store.list().length, 1);
  } finally {
    server?.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
