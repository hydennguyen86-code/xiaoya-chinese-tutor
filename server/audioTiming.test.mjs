import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energyTiming } from './audioTiming.mjs';
test('advisory energy timing excludes leading/trailing silence and counts only internal pauses longer than a second', () => {
  const pcm = new Float32Array(16000 * 5);
  pcm.fill(0.2, 8000, 16000);
  pcm.fill(0.2, 16000 * 2.5, 16000 * 3.5);
  const report = energyTiming(pcm);
  assert.equal(report.pauses.length, 1);
  assert.ok(report.speechStart >= 0.48);
  assert.ok(report.speechEnd <= 3.52);
  assert.equal(energyTiming(new Float32Array(16000)), null);
});
