import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('STT adapter checks readiness and sends multipart Chinese audio to mocked backend', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-stt-'));
  const original = globalThis.fetch;
  const env = { WHISPER_BIN: process.env.WHISPER_BIN, WHISPER_MODEL: process.env.WHISPER_MODEL };
  try {
    const model = path.join(dir, 'fixture.bin');
    fs.writeFileSync(model, 'fixture');
    process.env.WHISPER_BIN = process.execPath;
    process.env.WHISPER_MODEL = model;
    const stt = await import(`./stt.mjs?test=${Date.now()}`);
    await assert.rejects(() => stt.transcribe(Buffer.alloc(1001)), /chưa sẵn sàng/);
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return Response.json(options ? { text: '  你好  ' } : { ok: true });
    };
    await stt.startStt();
    assert.equal(stt.sttReady(), true);
    assert.equal(await stt.transcribe(Buffer.alloc(1001), 'audio/mp4'), '你好');
    assert.equal(request.options.body.get('language'), 'zh');
    assert.equal(request.options.body.get('file').name, 'speech.m4a');
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(() => stt.transcribe(Buffer.alloc(1001)), /HTTP 503/);
    stt.stopStt();
    assert.equal(stt.sttReady(), false);
  } finally {
    globalThis.fetch = original;
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { pcmWav } from './stt.mjs';
test('shared decoded PCM is packed as mono 16 kHz WAV for Whisper', () => {
  const wav = pcmWav(new Float32Array([-2, 0, 2]));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readInt16LE(44), -32767);
  assert.equal(wav.readInt16LE(48), 32767);
});
