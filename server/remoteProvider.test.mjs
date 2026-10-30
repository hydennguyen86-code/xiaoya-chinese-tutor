import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initializeRemoteProvider,
  saveRemoteSettings,
  publicRemoteSettings,
  deleteRemoteSettings,
  streamRemote,
  validateRemoteConfig,
  pingRemote,
} from './remoteProvider.mjs';
import { createDataStore } from './dataStore.mjs';
test('remote key stays private; consent, HTTPS, configured model and sanitized errors are enforced', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-api-test-'));
  const original = globalThis.fetch;
  try {
    initializeRemoteProvider(dir);
    const raw = { url: 'https://example.test/v1', model: 'fixture/model', apiKey: 'NOT-A-REAL-KEY', consent: true };
    for (const invalid of [
      { ...raw, consent: false },
      { ...raw, url: 'http://example.test/v1' },
      { ...raw, url: 'https://user:key@example.test/v1' },
      { ...raw, url: 'https://example.test/v1?key=x' },
      { ...raw, apiKey: 'bad\nkey' },
    ])
      assert.throws(() => validateRemoteConfig(invalid));
    saveRemoteSettings(raw);
    assert.equal(publicRemoteSettings().hasKey, true);
    assert.equal(JSON.stringify(publicRemoteSettings()).includes(raw.apiKey), false);
    assert.equal(JSON.stringify(createDataStore(dir).readAll()).includes(raw.apiKey), false);
    initializeRemoteProvider(dir); // Survives restart without using browser storage.
    let received;
    globalThis.fetch = async (url, options) => {
      received = { url, options };
      return Response.json({ choices: [{ message: { content: '{"reply":"你好"}' } }] });
    };
    let delta;
    await streamRemote({
      model: raw.model,
      messages: [{ role: 'user', content: 'Synthetic fixture' }],
      schema: {},
      onDelta: (text) => {
        delta = text;
      },
    });
    assert.equal(received.url, 'https://example.test/v1/chat/completions');
    assert.equal(received.options.headers.Authorization, 'Bearer NOT-A-REAL-KEY');
    assert.equal(received.options.redirect, 'error');
    assert.equal(JSON.parse(delta).reply, '你好');
    await assert.rejects(() => streamRemote({ model: 'wrong-model' }), /model/);
    globalThis.fetch = async () => new Response('Upstream error contains NOT-A-REAL-KEY', { status: 401 });
    await assert.rejects(
      () => streamRemote({ model: raw.model, onDelta() {} }),
      (error) => !error.message.includes(raw.apiKey) && error.message.includes('401'),
    );
    deleteRemoteSettings();
    assert.equal(publicRemoteSettings().configured, false);
  } finally {
    globalThis.fetch = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('remote streams SSE, retries once without JSON mode on 400, and classifies provider errors', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-api-stream-'));
  const original = globalThis.fetch;
  try {
    initializeRemoteProvider(dir);
    saveRemoteSettings({ url: 'https://example.test/v1', model: 'gemini-4-argon', apiKey: 'NOT-A-REAL-KEY', consent: true });
    const bodies = [];
    const sse = ['{"reply":"你', '好"}'].map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join('');
    globalThis.fetch = async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1) return new Response('response_format not supported', { status: 400 });
      return new Response(`${sse}data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":3}}\n\ndata: [DONE]\n\n`, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };
    let text = '';
    const result = await streamRemote({ model: 'gemini-4-argon', messages: [], schema: {}, maxTokens: 400, onDelta: (d) => (text += d) });
    assert.equal(text, '{"reply":"你好"}');
    assert.equal(result.usage.completionTokens, 3);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].response_format.type, 'json_object');
    assert.equal(bodies[1].response_format, undefined);
    assert.equal(bodies[0].stream, true);
    assert.ok(bodies[0].max_tokens >= 2048, 'thinking models need room for reasoning');

    for (const [status, body, pattern] of [
      [402, '', /credit/],
      [403, '{"error":"insufficient balance"}', /credit/],
      [401, 'bad key NOT-A-REAL-KEY', /key/],
      [404, '{"error":{"code":"model_not_found"}}', /model/],
      [429, '', /429/],
      [503, '', /503/],
    ]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(
        () => streamRemote({ model: 'gemini-4-argon', onDelta() {} }),
        (error) => error.remote === true && pattern.test(error.message) && !error.message.includes('NOT-A-REAL-KEY'),
      );
    }
    deleteRemoteSettings();
  } finally {
    globalThis.fetch = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('free ping reports ok, missing model, bad key and unreachable without leaking the key', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-api-ping-'));
  const original = globalThis.fetch;
  try {
    initializeRemoteProvider(dir);
    assert.equal(await pingRemote(), null);
    saveRemoteSettings({ url: 'https://example.test/v1', model: 'gemini-4-argon', apiKey: 'NOT-A-REAL-KEY', consent: true });
    let seen;
    globalThis.fetch = async (url, options) => {
      seen = { url, options };
      return Response.json({ data: [{ id: 'gemini-4-argon' }, { id: 'gpt' }] });
    };
    assert.equal((await pingRemote()).state, 'ok');
    assert.equal(seen.url, 'https://example.test/v1/models');
    assert.equal(seen.options.method, undefined, 'GET only, no tokens');
    assert.equal(publicRemoteSettings().health.state, 'ok');
    globalThis.fetch = async () => Response.json({ data: [{ id: 'gpt' }] });
    assert.equal((await pingRemote()).state, 'warn');
    globalThis.fetch = async () => new Response('bad key NOT-A-REAL-KEY', { status: 401 });
    const bad = await pingRemote();
    assert.equal(bad.state, 'error');
    assert.equal(JSON.stringify(bad).includes('NOT-A-REAL-KEY'), false);
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    assert.equal((await pingRemote()).state, 'error');
    deleteRemoteSettings();
    assert.equal(publicRemoteSettings().health, null);
  } finally {
    globalThis.fetch = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
