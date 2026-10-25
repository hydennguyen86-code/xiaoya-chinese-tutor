import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latencyResult } from './latency.ts';
test('latency requires complete monotonic stage evidence and distinguishes silence wait, STT, model, TTS and playback', () => {
  const t = {
    scope: 'a',
    speechEnd: 100,
    recordingEnd: 1000,
    sttStart: 1000,
    sttEnd: 1200,
    modelStart: 1200,
    sentence: 1600,
    ttsStart: 1600,
    ttsReady: 2100,
    audio: 2200,
  };
  const r = latencyResult(t);
  assert.equal(r?.total, 2100);
  assert.equal(r?.silenceWait, 900);
  assert.equal(r?.uploadRecognition, 200);
  assert.equal(r?.model, 400);
  assert.equal(r?.tts, 500);
  assert.equal(r?.decodePlayback, 100);
  assert.equal(latencyResult({ ...t, audio: undefined }), null);
  assert.equal(latencyResult({ ...t, ttsReady: 1500 }), null);
});
