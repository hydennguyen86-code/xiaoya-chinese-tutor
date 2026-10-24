import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareDictation } from './listeningCorpus.ts';
test('community dictation aligns omissions, additions and untoned spaced pinyin', () => {
  assert.ok(compareDictation('你好，今天见。', 'ni hao jin tian jian').every((c) => c.ok));
  assert.ok(compareDictation('你好，今天见。', '你好今天见').every((c) => c.ok));
  const omitted = compareDictation('你好今天见', '你今天见');
  assert.equal(omitted.filter((c) => !c.ok).length, 1);
  assert.equal(omitted.find((c) => !c.ok)?.expected, '好');
  assert.equal(compareDictation('你好', '你很好').filter((c) => !c.ok).length, 1);
  assert.equal(compareDictation('你好', '').filter((c) => !c.ok).length, 2);
});
