import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateToneLabel } from './toneEvaluation.mjs';
import { TONE_ITEMS } from '../eval/toneItems.mjs';
test('tone capture has the exact 40 characters and 16 words with unique ids', () => {
  assert.equal(TONE_ITEMS.filter((i) => i.kind === 'single').length, 40);
  assert.equal(TONE_ITEMS.filter((i) => i.kind === 'word').length, 16);
  assert.equal(new Set(TONE_ITEMS.map((i) => i.id)).size, 56);
});
test('human labels require reviewer, provenance and one valid tone per syllable', () => {
  const valid = { source: 'expert', reviewedBy: 'Test reviewer', tones: [2, 3] };
  assert.equal(validateToneLabel(valid, 2), true);
  for (const value of [{ ...valid, source: 'ai' }, { ...valid, reviewedBy: '' }, { ...valid, tones: [5, 1] }, { ...valid, tones: [1] }]) assert.equal(validateToneLabel(value, 2), false);
});
