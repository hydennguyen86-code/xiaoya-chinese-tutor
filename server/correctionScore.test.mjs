import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCorrection } from '../eval/correctionScore.mjs';
test('full-sentence fix is separate from an expected fragment or ambiguous repeated replacement', () => {
  const text = '我有三个书，还有三个书。',
    one = { original: '三个书', corrected: '三本书', index: 2 };
  assert.equal(scoreCorrection(text, '三本书', [one]).exact, false);
  assert.equal(scoreCorrection(text, '三本书', [one]).partial, true);
  assert.equal(scoreCorrection(text, '我有三本书，还有三本书', [{ ...one, index: undefined }]).exact, false);
  assert.equal(scoreCorrection(text, '我有三本书，还有三本书', [one, { ...one, index: text.lastIndexOf('三个书') }]).exact, true);
  assert.equal(scoreCorrection('我有三个书。', '我有三本书', [{ original: '三个书', corrected: '三本书' }]).exact, true);
});
