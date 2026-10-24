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
