import test from 'node:test';
import assert from 'node:assert/strict';
import { showsAdvancedPronunciation, tierFor } from './tier.ts';

test('level decides the tier when no course volume is known', () => {
  assert.equal(tierFor('HSK1-2'), 'foundation');
  assert.equal(tierFor('HSK3-4'), 'coach');
  assert.equal(tierFor('HSK5-6'), 'coach');
  assert.equal(tierFor('free'), 'coach');
});

test('a course volume overrides the level', () => {
  assert.equal(tierFor('HSK5-6', { levels: ['HSK1-2'] }), 'foundation'); // pinyin-intro, hsk1, misu30-1
  assert.equal(tierFor('HSK1-2', { levels: ['HSK3-4'] }), 'coach');
  assert.equal(tierFor('HSK1-2', { levels: [] }), 'foundation');
  assert.equal(tierFor('HSK3-4', null), 'coach');
});

test('advanced pronunciation tools only in the foundation tier', () => {
  assert.equal(showsAdvancedPronunciation('foundation'), true);
  assert.equal(showsAdvancedPronunciation('coach'), false);
});
