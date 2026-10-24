import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTaskResult, normalizeOpenResult } from './assessment.mjs';
test('missing or malformed model goals fail closed, and evidence must come from learner', () => {
  const goals = ['Gọi món', 'Hỏi giá', 'Ít cay'];
  const result = normalizeTaskResult({ goals: [{ status: 'done', evidence: '我要米饭' }, { status: 'done', evidence: '多少钱' }, { status: 'excellent' }] }, goals, ['我要米饭']);
  assert.deepEqual(result.map((g) => g.status), ['done', 'missing', 'missing']);
  assert.equal(normalizeTaskResult(null, goals, [])[0].status, 'missing');
  assert.equal(normalizeTaskResult({goals:[{status:'partly',evidence:'米饭'}]}, goals, ['我要米饭'])[0].status,'partly');
});
test('open response must supply all bounded rubric scores', () => {
  assert.equal(normalizeOpenResult({fluency:5}),null);
  assert.equal(normalizeOpenResult({fluency:1,accuracy:2,complexity:3,feedback:'Cần nói thêm.'}).estimated,true);
});
