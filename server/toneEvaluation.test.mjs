import { fixtureWav } from './testFixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateToneLabel } from './toneEvaluation.mjs';
import { TONE_ITEMS } from '../eval/toneItems.mjs';
test('tone capture has the exact 40 characters and 16 words with unique ids', () => {
  assert.equal(TONE_ITEMS.filter((i) => i.kind === 'single').length, 40);
  assert.equal(TONE_ITEMS.filter((i) => i.kind === 'word').length, 16);
  assert.equal(new Set(TONE_ITEMS.map((i) => i.id)).size, 56);
});
test('human labels require reviewer, provenance and one valid tone per syllable', () => {
  const valid = { source: 'expert', reviewedBy: 'Test reviewer', tones: [2, 3] };
  assert.equal(validateToneLabel(valid, 2), true);
  for (const value of [
    { ...valid, source: 'ai' },
    { ...valid, reviewedBy: '' },
    { ...valid, tones: [5, 1] },
    { ...valid, tones: [1] },
  ])
    assert.equal(validateToneLabel(value, 2), false);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mountToneEvaluation } from './toneEvaluation.mjs';
test('captured audio stays per learner; rerecording invalidates labels and rejects path tricks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-capture-test-'));
  const routes = new Map();
  const app = Object.fromEntries(
    ['get', 'post', 'put', 'delete'].map((method) => [method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers.at(-1))]),
  );
  mountToneEvaluation(app, dir);
  function call(route, body, learner = 'synthetic-fixture') {
    const req = { params: { learner, item: 'single-1-1' }, headers: { 'content-type': 'audio/wav' }, body };
    const res = {
      code: 200,
      status(code) {
        this.code = code;
        return this;
      },
      json(value) {
        this.value = value;
      },
    };
    routes.get(route)(req, res);
    return res;
  }
  try {
    const upload = 'post /api/tone-evaluation/:learner/:item';
    const label = 'put /api/tone-evaluation/:learner/:item/label';
    const audioFixture = Buffer.alloc(1001); // Not human speech and never an eval result.
    assert.equal(call(upload, audioFixture).code, 200);
    assert.equal(call(label, { source: 'self', reviewedBy: 'Synthetic test fixture', tones: [1] }).code, 200);
    const file = path.join(dir, 'eval-recordings/synthetic-fixture/manifest.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(file)).recordings[0].label.tones, [1]);
    assert.equal(call(upload, audioFixture).code, 200);
    assert.equal(JSON.parse(fs.readFileSync(file)).recordings[0].label, null);
    assert.equal(call(upload, audioFixture, '../escape').code, 400);
    assert.equal(call(label, { source: 'ai', reviewedBy: 'AI', tones: [1] }).code, 400);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('human disagreement saves audio and independent labels privately, counts per learner and rejects invalid labels', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-feedback-test-'));
  const routes = new Map();
  const app = Object.fromEntries(
    ['get', 'post', 'put', 'delete'].map((method) => [method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers.at(-1))]),
  );
  mountToneEvaluation(app, dir);
  async function call(method, body, learner = 'synthetic') {
    const res = {
      code: 200,
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        this.data = data;
      },
    };
    await routes.get(`${method} /api/tone-feedback/:learner`)({ params: { learner }, body }, res);
    return res;
  }
  try {
    const body = {
      text: '你好',
      mime: 'audio/wav',
      audioBase64: fixtureWav().toString('base64'),
      machine: [
        { expected: 999, heard: 999 },
        { expected: 3, heard: 4 },
      ],
      label: { source: 'self', reviewedBy: 'Synthetic reviewer', tones: [2, 3] },
    };
    assert.equal((await call('post', { ...body, label: { ...body.label, tones: [3] } })).code, 400);
    assert.equal((await call('post', body, '../escape')).code, 400);
    assert.equal((await call('post', body)).code, 200);
    assert.equal((await call('post', body)).code, 200);
    const folder = path.join(dir, 'eval-recordings/synthetic/feedback');
    const entry = JSON.parse(
      fs.readFileSync(
        path.join(
          folder,
          fs.readdirSync(folder).find((f) => f.endsWith('.json')),
        ),
      ),
    );
    assert.deepEqual(entry.label.tones, [2, 3]);
    assert.match(entry.itemId, /^practice:/);
    assert.equal(entry.roleVerification, 'self-declared; not verified');
    assert.ok(entry.machine.every((s) => s.heard >= 0 && s.heard <= 4));
    assert.equal(fs.readFileSync(path.join(folder, entry.file)).length, fixtureWav().length);
    assert.deepEqual((await call('get')).data, { labeled: 0, feedback: 1 });
    assert.deepEqual((await call('get', null, 'other')).data, { labeled: 0, feedback: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('export and deletion are confined to the confirmed learner', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-retention-')),
    routes = new Map();
  mountToneEvaluation(
    Object.fromEntries(['get', 'post', 'put', 'delete'].map((m) => [m, (url, ...h) => routes.set(`${m} ${url}`, h.at(-1))])),
    dir,
  );
  const folder = path.join(dir, 'eval-recordings/synthetic'),
    other = path.join(dir, 'eval-recordings/other');
  fs.mkdirSync(folder, { recursive: true });
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'keep'), 'fixture');
  fs.writeFileSync(
    path.join(folder, 'manifest.json'),
    JSON.stringify({
      version: 1,
      recordings: [
        { id: 'single-1-1', text: '妈', file: 'single-1-1.audio', label: { source: 'peer', reviewedBy: 'Synthetic', tones: [4] } },
      ],
    }),
  );
  fs.writeFileSync(path.join(folder, 'single-1-1.audio'), fixtureWav());
  async function call(route, body) {
    const res = {
      code: 200,
      status(c) {
        this.code = c;
        return this;
      },
      json(d) {
        this.data = d;
      },
      set() {
        return this;
      },
      type() {
        return this;
      },
      send(d) {
        this.data = d;
      },
    };
    await routes.get(route)({ params: { learner: 'synthetic' }, body }, res);
    return res;
  }
  try {
    const response = await call('get /api/tone-evaluation/:learner/export');
    assert.equal(response.code, 200);
    const JSZip = (await import('jszip')).default,
      zip = await JSZip.loadAsync(response.data);
    assert.ok(zip.file('single-1-1.audio'));
    assert.ok(zip.file('manifest.json'));
    assert.equal(zip.file('other/keep'), null);
    assert.equal((await call('delete /api/tone-evaluation/:learner', {})).code, 400);
    assert.equal(fs.existsSync(folder), true);
    assert.equal((await call('delete /api/tone-evaluation/:learner', { confirm: 'synthetic' })).code, 200);
    assert.equal(fs.existsSync(folder), false);
    assert.equal(fs.existsSync(path.join(other, 'keep')), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
