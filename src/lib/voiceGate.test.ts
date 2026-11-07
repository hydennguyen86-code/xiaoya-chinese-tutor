import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceGate, encodeWav, DEFAULT_GATE } from './voiceGate.ts';

const feedMany = (gate: VoiceGate, rms: number, count: number, speaking = false) => {
  let last = null;
  for (let i = 0; i < count; i += 1) last = gate.feed(rms, speaking) ?? last;
  return last;
};

test('an utterance starts after a short onset and ends after the silence window', () => {
  const gate = new VoiceGate();
  feedMany(gate, 0.002, 10); // room noise
  assert.equal(gate.isRecording, false);
  assert.equal(feedMany(gate, 0.1, 1)?.type, undefined);
  assert.equal(feedMany(gate, 0.1, 1)?.type, 'start'); // 2 chunks ≈ 256 ms ≥ 250 ms onset
  assert.equal(gate.isRecording, true);
  feedMany(gate, 0.1, 6); // ~770 ms of speech
  const end = feedMany(gate, 0.002, Math.ceil(DEFAULT_GATE.silenceMs / DEFAULT_GATE.chunkMs));
  assert.equal(end?.type, 'end');
  assert.equal(gate.isRecording, false);
});

test('a blip shorter than minSpeechMs is discarded', () => {
  const gate = new VoiceGate();
  feedMany(gate, 0.002, 10);
  feedMany(gate, 0.1, 2);
  const end = feedMany(gate, 0.002, 12);
  assert.equal(end?.type, 'discard');
});

test('while the avatar speaks the gate needs a louder, longer voice (echo residue is ignored)', () => {
  const gate = new VoiceGate();
  feedMany(gate, 0.002, 10);
  assert.equal(feedMany(gate, 0.02, 5, true), null); // residual echo: loud enough for a quiet room, not while speaking
  assert.equal(feedMany(gate, 0.1, 3, true)?.type, undefined);
  assert.equal(feedMany(gate, 0.1, 1, true)?.type, 'start'); // 4 chunks ≈ 512 ms ≥ 420 ms
});

test('the noise floor adapts so a noisy room does not trigger recording', () => {
  const gate = new VoiceGate();
  feedMany(gate, 0.02, 30); // constant fan noise
  assert.equal(gate.isRecording, false);
  assert.ok(gate.threshold(false) > 0.04);
});

test('encodeWav writes a valid 16 kHz mono header', async () => {
  const blob = encodeWav([new Float32Array([0, 0.5, -0.5]), new Float32Array([1])], 16000);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 16000);
  assert.equal(new DataView(bytes.buffer).getUint32(40, true), 8);
  assert.equal(bytes.length, 44 + 8);
});
