import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { listeningDifficulty } from './listeningDifficulty.mjs';
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
    assert.equal((await importCommonVoice(args)).selected, 1);
    const store = corpusStore(dataDir, source);
    const [clip] = store.list();
    assert.equal(clip.text, '你好，今天见。');
    assert.ok(!JSON.stringify(clip).includes('private-speaker'));
    assert.equal(store.audio('../secret'), null);
    await assert.rejects(importCommonVoice({ ...args, sourceUrl: 'https://example.com/file' }));
    const app = express();
    mountListeningCorpus(app, dataDir, source);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await fetch(`${base}/api/listening-corpus`)).json()).entries.length, 1);
    const response = await fetch(`${base}/api/listening-corpus/${clip.id}/audio`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${base}/api/listening-corpus/${'0'.repeat(24)}/audio`)).status, 404);
    assert.equal(store.audio(clip.id), fs.realpathSync(path.join(source, 'clips', 'cv1.mp3')));
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'listening-corpus')), ['manifest.json']);
    assert.deepEqual(corpusStore(dataDir, path.join(temp, 'wrong')).list(), []);
    const original = path.join(source, 'clips', 'cv1.mp3');
    fs.renameSync(original, original + '.original');
    fs.symlinkSync(original + '.original', original);
    assert.equal(store.audio(clip.id), null);
    fs.writeFileSync(path.join(source, 'validated.tsv'), 'path\tsentence');
    await assert.rejects(importCommonVoice(args));
    assert.equal(store.list().length, 1);
  } finally {
    server?.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('difficulty filter rejects encyclopedic names, technical material and unknown words without official HSK claims', () => {
  assert.ok(listeningDifficulty('我今天去买东西。'));
  for (const text of ['李普出生于湖南湘乡。', '张卫平，可以指：', '可以用全硫代锑酸盐加酸来制备它。', '我在星际飞船上工作。'])
    assert.equal(listeningDifficulty(text), null, text);
});
test('train/dev/test catalog references external files without copying, supports optional locale and deduplicates across splits', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-cv-split-'));
  const source = path.join(temp, 'source'),
    dataDir = path.join(temp, 'data');
  fs.mkdirSync(path.join(source, 'clips'), { recursive: true });
  fs.writeFileSync(path.join(source, 'clips', 'test.mp3'), 'synthetic fixture');
  for (const split of ['train', 'dev', 'test'])
    fs.writeFileSync(path.join(source, split + '.tsv'), 'path\tsentence\tup_votes\tdown_votes\n' + 'test.mp3\t我今天去买东西。\t2\t0\n');
  try {
    const result = await importCommonVoice({ source, dataDir, version: 'cv26-beijing' });
    assert.equal(result.rows, 3);
    assert.equal(result.selected, 1);
    assert.equal(result.duplicate, 2);
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'listening-corpus')), ['manifest.json']);
    assert.deepEqual(corpusStore(dataDir, undefined).list(), []);
    const app = express();
    const guards = [];
    mountListeningCorpus({ ...app, use: (...args) => guards.push(args) }, dataDir, source);
    let status;
    guards[0][1](
      { socket: { remoteAddress: '192.168.1.25' } },
      {
        sendStatus: (code) => {
          status = code;
        },
      },
      () => assert.fail('LAN must not access corpus'),
    );
    assert.equal(status, 403);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
