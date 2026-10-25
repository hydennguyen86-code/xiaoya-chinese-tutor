import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyFluency } from './fluency.ts';
test('weekly fluency weights by speech span, groups by Monday and never invents an empty score', () => {
  assert.deepEqual(weeklyFluency([]), []);
  const sample = {
    syllables: 4,
    speechSeconds: 2,
    syllablesPerSecond: 2,
    pausesOverOneSecond: 1,
    pauseSeconds: 1.1,
    advisory: true as const,
  };
  const weeks = weeklyFluency([
    { ...sample, at: Date.parse('2026-10-20') },
    { ...sample, syllables: 6, speechSeconds: 6, at: Date.parse('2026-10-22') },
    { ...sample, at: Date.parse('2026-10-26') },
  ]);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].week, '2026-10-19');
  assert.equal(weeks[0].rate, 10 / 8);
  assert.equal(weeks[0].turns, 2);
});

test('week uses the local Monday even when UTC is still Sunday', () => {
  const old = process.env.TZ;
  process.env.TZ = 'Asia/Ho_Chi_Minh';
  try {
    const rows = weeklyFluency([
      {
        at: Date.parse('2026-10-25T18:00:00Z'),
        syllables: 3,
        speechSeconds: 2,
        syllablesPerSecond: 1.5,
        pausesOverOneSecond: 0,
        pauseSeconds: 0,
        advisory: true,
      },
    ]);
    assert.equal(rows[0].week, '2026-10-26');
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
