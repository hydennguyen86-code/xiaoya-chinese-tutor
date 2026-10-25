import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { loadCurated, validateCurated } from './curatedListening.mjs';
const curated = [{ sentence_id: 'a'.repeat(64), level: 'HSK1-2', meaningVi: 'Chào, hẹn gặp hôm nay.', focus: ['Nghe câu ngắn.'] }];
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
      'client_id\tsentence_id\tpath\tsentence\tlocale\tup_votes\tdown_votes',
      'private-speaker\taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tcv1.mp3\t你好，今天见。\tzh-CN\t3\t0',
      'private-speaker\taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tcv1.mp3\t你好，今天见。\tzh-CN\t3\t0',
      'private-speaker\taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tcv1.mp3\t明天见。\tzh-TW\t3\t0',
      'private-speaker\taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tcv1.mp3\t下午见。\tzh-CN\t1\t0',
      'private-speaker\taaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\t../secret.mp3\t明天再说。\tzh-CN\t3\t0',
    ].join('\n'),
  );
  const args = { curated, source, dataDir, version: 'cv-test', sourceUrl: 'https://mozilladatacollective.com/datasets/test' };
  let server;
  try {
    assert.equal((await importCommonVoice(args)).selected, 1);
    const store = corpusStore(dataDir, source, curated);
    const [clip] = store.list();
    assert.equal(clip.text, '你好，今天见。');
    assert.ok(!JSON.stringify(clip).includes('private-speaker'));
    assert.equal(store.audio('../secret'), null);
    await assert.rejects(importCommonVoice({ ...args, sourceUrl: 'https://example.com/file' }));
    const app = express();
    mountListeningCorpus(app, dataDir, source, curated);
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
    assert.deepEqual(corpusStore(dataDir, path.join(temp, 'wrong'), curated).list(), []);
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

test('train/dev/test catalog references external files without copying, supports optional locale and deduplicates across splits', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-cv-split-'));
  const source = path.join(temp, 'source'),
    dataDir = path.join(temp, 'data');
  fs.mkdirSync(path.join(source, 'clips'), { recursive: true });
  fs.writeFileSync(path.join(source, 'clips', 'test.mp3'), 'synthetic fixture');
  for (const split of ['train', 'dev', 'test'])
    fs.writeFileSync(
      path.join(source, split + '.tsv'),
      'sentence_id\tpath\tsentence\tup_votes\tdown_votes\n' +
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\ttest.mp3\t我今天去买东西。\t2\t0\n',
    );
  try {
    const result = await importCommonVoice({ curated, source, dataDir, version: 'cv26-beijing' });
    assert.equal(result.rows, 3);
    assert.equal(result.selected, 1);
    assert.equal(result.duplicate, 2);
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'listening-corpus')), ['manifest.json']);
    assert.deepEqual(corpusStore(dataDir, undefined).list(), []);
    const app = express();
    const guards = [];
    mountListeningCorpus({ ...app, use: (...args) => guards.push(args) }, dataDir, source, curated);
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

test('curated bank retains AI provenance, only sentence IDs and editorial fields; unsafe/duplicate metadata is rejected', () => {
  assert.equal(loadCurated().length, 154);
  const data = { kind: 'cv-curated', source: 'AI soạn, chưa duyệt', version: 1, items: curated };
  assert.equal(validateCurated(data).length, 1);
  assert.throws(() => validateCurated({ ...data, items: [...curated, ...curated] }));
  assert.throws(() => validateCurated({ ...data, items: [{ ...curated[0], path: '/private/audio.mp3' }] }));
});
