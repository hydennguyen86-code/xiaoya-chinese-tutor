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
    ['get', 'post', 'put'].map((method) => [method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers.at(-1))]),
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

test('human disagreement saves audio and independent labels privately, counts per learner and rejects invalid labels', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-feedback-test-'));
  const routes = new Map();
  const app = Object.fromEntries(
    ['get', 'post', 'put'].map((method) => [method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers.at(-1))]),
  );
  mountToneEvaluation(app, dir);
  function call(method, body, learner = 'synthetic') {
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
    routes.get(`${method} /api/tone-feedback/:learner`)({ params: { learner }, body }, res);
    return res;
  }
  try {
    const body = {
      text: '你好',
      mime: 'audio/wav',
      audioBase64: Buffer.alloc(1200).toString('base64'),
      machine: [
        { expected: 3, heard: 1 },
        { expected: 3, heard: 4 },
      ],
      label: { source: 'self', reviewedBy: 'Synthetic reviewer', tones: [2, 3] },
    };
    assert.equal(call('post', { ...body, label: { ...body.label, tones: [3] } }).code, 400);
    assert.equal(call('post', body, '../escape').code, 400);
    assert.equal(call('post', body).code, 200);
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
    assert.equal(entry.machine[0].heard, 1);
    assert.equal(fs.readFileSync(path.join(folder, entry.file)).length, 1200);
    assert.deepEqual(call('get').data, { labeled: 0, feedback: 1 });
    assert.deepEqual(call('get', null, 'other').data, { labeled: 0, feedback: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
