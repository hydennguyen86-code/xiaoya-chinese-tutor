import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAttempt, benchmarkDue, delta, percent } from './benchmark.ts';

test('a milestone test is due before the first attempt and again four weeks later', () => {
  const t0 = Date.parse('2026-11-07T10:00:00Z');
  const empty = { version: 1 as const, attempts: [] };
  assert.equal(benchmarkDue(empty, t0), true);
  const attempt = {
    at: t0,
    listening: { right: 4, total: 6 },
    meaning: { right: 5, total: 6 },
    speaking: { right: 3, total: 8, unclear: 2 },
    toneMethod: 'rules',
  };
  const data = addAttempt(empty, attempt);
  assert.equal(benchmarkDue(data, t0 + 10 * 86400000), false);
  assert.equal(benchmarkDue(data, t0 + 29 * 86400000), true);
});

test('percent and delta compare the first and latest attempt', () => {
  assert.equal(percent({ right: 4, total: 6 }), 67);
  assert.equal(percent({ right: 0, total: 0 }), null);
  assert.equal(delta({ right: 3, total: 6 }, { right: 5, total: 6 }), 33);
  assert.equal(delta({ right: 0, total: 0 }, { right: 5, total: 6 }), null);
});
