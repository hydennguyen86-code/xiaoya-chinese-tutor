import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewProblems } from './lessonReview.mjs';
test('review metadata requires named human, real date and nonempty notes', () => {
  const valid = { reviewed: true, reviewedBy: 'Synthetic fixture reviewer', reviewedAt: '2026-10-24', notes: 'Test fixture only.' };
  assert.deepEqual(reviewProblems(valid), []);
  for (const key of ['reviewed', 'reviewedBy', 'reviewedAt', 'notes']) {
    const raw = { ...valid };
    delete raw[key];
    assert.ok(reviewProblems(raw).length, key);
  }
  assert.ok(reviewProblems({ ...valid, reviewedAt: '2026-02-30' }).length);
  assert.ok(reviewProblems({ reviewed: true, review: { reviewer: 'Legacy', date: '2026-10-24' } }).length);
});
