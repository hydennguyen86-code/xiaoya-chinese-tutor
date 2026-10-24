import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeed, withSpeechRate, speechRate } from './listeningPrefs.ts';
test('speed is bounded and one-shot slow playback never changes the default', () => {
  assert.equal(normalizeSpeed(0.7), 0.7);
  assert.equal(normalizeSpeed(0.85), 0.85);
  assert.equal(normalizeSpeed(10), 1);
  assert.equal(speechRate(), 1);
  withSpeechRate(0.7, () => assert.equal(speechRate(), 0.7));
  assert.equal(speechRate(), 1);
  assert.throws(() =>
    withSpeechRate(0.85, () => {
      throw Error('fixture');
    }),
  );
  assert.equal(speechRate(), 1);
});
