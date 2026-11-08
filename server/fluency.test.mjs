import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureFluency } from './fluency.mjs';
test('fluency uses recognized Han count and internal voiced span, missing speech is unavailable', () => {
  assert.equal(measureFluency(null, '你好'), null);
  assert.equal(measureFluency({ speechStart: 0, speechEnd: 2, pauses: [] }, ''), null);
  const r = measureFluency({ speechStart: 1, speechEnd: 4, pauses: [{ start: 2, end: 3.2 }] }, '你好，今天见。');
  assert.equal(r.syllables, 5);
  assert.equal(r.syllablesPerSecond, 5 / 3);
  assert.equal(r.pausesOverOneSecond, 1);
  assert.ok(r.advisory);
});

test('儿 hoá counts as one syllable in the speaking rate', () => {
  const timing = { speechStart: 0, speechEnd: 2, pauses: [] };
  assert.equal(measureFluency(timing, '哪儿有洗手间？').syllables, 5);
  assert.equal(measureFluency(timing, '儿子在哪儿').syllables, 4);
});
