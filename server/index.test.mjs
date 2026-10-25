import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureWav } from './testFixtures.mjs';

test('real index server routes work with temporary data and local synthetic backends', { timeout: 20000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-index-'));
  const backend = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'fixture' }] }));
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'fixture' }] }));
    if (req.url === '/inference') return res.end(JSON.stringify({ text: '你好' }));
    if (req.url === '/synthesize') {
      res.setHeader('Content-Type', 'audio/wav');
      return res.end(fixtureWav());
    }
    if (req.url === '/api/chat') {
      const body = JSON.parse(raw);
      const turn = body.format?.properties?.reply
        ? {
            reply: '你好！',
            translation: 'Xin chào!',
            emotion: 'happy',
            gesture: 'none',
            corrections: [],
            vocab: [],
            suggestion: '你好。',
            suggestionTranslation: 'Xin chào.',
          }
        : { corrections: [] };
      return res.end(JSON.stringify({ message: { content: JSON.stringify(turn) }, done: true }) + '\n');
    }
    res.end('{}');
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const port = backend.address().port;
  const model = path.join(dir, 'fixture.bin');
  fs.writeFileSync(model, 'synthetic model placeholder; never executed');
  const child = fork(new URL('./index.mjs', import.meta.url), [], {
    silent: true,
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      XIAOYA_DATA_DIR: dir,
      XIAOYA_SAMPLE_AVATARS: '1',
      OLLAMA_URL: `http://127.0.0.1:${port}`,
      LMSTUDIO_URL: `http://127.0.0.1:${port}`,
      VOICE_CLONE_URL: `http://127.0.0.1:${port}`,
      WHISPER_PORT: String(port),
      WHISPER_BIN: process.execPath,
      WHISPER_MODEL: model,
    },
  });
  let errors = '';
  child.stderr.on('data', (b) => {
    errors += b;
  });
  child.stdout.resume();
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit').catch(() => {});
    }
    await new Promise((resolve) => backend.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const ready = await new Promise((resolve, reject) => {
    child.on('message', (m) => {
      if (m.type === 'misu-ready') resolve(m);
    });
    child.once('exit', () => reject(new Error(errors)));
  });
  const base = `http://127.0.0.1:${ready.port}`;
  const get = (url, options) => fetch(base + url, options);
  const post = (url, body) => get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let status;
  for (let i = 0; i < 30; i++) {
    status = await (await get('/api/status')).json();
    if (status.localStt) break;
    await new Promise((r) => setTimeout(r, 30));
  }
  assert.equal(status.localStt, true);
  assert.equal(status.avatarUrl, '/avatars/brunette.glb');
  assert.equal((await get('/api/avatars/personal.glb')).status, 404);
  assert.equal((await get('/avatars/personal.glb')).status, 404);
  assert.equal((await get('/api/store')).status, 200);
  const key = '/api/store/xiaoya.test.route';
  assert.equal(
    (await get(key, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'fixture' }) })).status,
    200,
  );
  assert.equal((await (await get('/api/store')).json()).items['xiaoya.test.route'], 'fixture');
  await get(key, { method: 'DELETE' });
  assert.equal(
    (await get('/api/store/not-allowed', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"value":"bad"}' }))
      .status,
    400,
  );
  assert.equal(
    (await get('/api/store/not-allowed', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{' })).status,
    400,
  );
  assert.equal((await get('/api/syllabus')).status, 200);
  const lesson = await (await post('/api/lesson-content', { volumeId: 'hsk1-practical', lessonNo: 1, day: 1, level: 'HSK1-2' })).json();
  assert.equal(lesson.reviewed, false);
  assert.ok(lesson.vocab.length);
  const speech = await (await post('/api/tts', { text: '你好', voice: 'clone-zh' })).json();
  assert.equal(speech.provider, 'clone');
  assert.ok(speech.audioBase64.length);
  const transcription = await (
    await get('/api/transcribe', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: fixtureWav() })
  ).json();
  assert.equal(transcription.text, '你好');
  assert.equal(transcription.fluencyReason, null);
  assert.ok(transcription.fluency.syllables > 0);
  assert.equal(
    (await get('/api/transcribe', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: Buffer.alloc(2) })).status,
    400,
  );
  const tones = await (
    await get('/api/pronounce?target=你好&reference=0', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: fixtureWav() })
  ).json();
  assert.equal(tones.tones.syllables.length, 2);
  assert.equal(tones.fluencyReason, null);
  assert.ok(tones.fluency);
  assert.equal(
    (
      await get('/api/pronounce?target=你好&reference=0', {
        method: 'POST',
        headers: { 'content-type': 'audio/wav' },
        body: Buffer.alloc(1200),
      })
    ).status,
    500,
  );
  assert.equal(
    (await get('/api/transcribe', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: Buffer.alloc(1200) })).status,
    500,
  );
  assert.equal((await post('/api/corrections', { provider: 'invalid', model: 'fixture', text: '你好' })).status, 400);
  const fixes = await (await post('/api/corrections', { provider: 'ollama', model: 'fixture', text: '你好' })).json();
  assert.deepEqual(fixes.corrections, []);
  const chat = await post('/api/chat', {
    provider: 'ollama',
    model: 'fixture',
    level: 'HSK1-2',
    messages: [{ role: 'user', content: '你好' }],
  });
  assert.equal(chat.status, 200);
  assert.match(await chat.text(), /"type":"turn"/);
  const config = await (await get('/api/provider-config')).json();
  assert.equal(config.hasKey, false);
  assert.equal('apiKey' in config, false);
  assert.equal((await get('/api/absent')).status, 404);
});
