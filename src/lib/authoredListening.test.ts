import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeDictation } from './authoredListening.ts';
const item = {
  id: 'test',
  level: 'HSK1-2',
  hanzi: '你好',
  pinyin: 'ní hǎo',
  meaningVi: 'chào',
  baseTones: [3, 3],
  acceptTones: [
    [2, 3],
    [3, 3],
  ],
};
test('dictation accepts untoned input, authored sandhi alternatives, rejects wrong tones and aligns omissions', () => {
  for (const a of ['ni hao', 'ni2 hao3', 'ni3 hao3', 'ní hǎo', '你好']) assert.ok(gradeDictation(item, a).correct, a);
  assert.ok(!gradeDictation(item, 'ni4 hao3').correct);
  assert.ok(!gradeDictation(item, '你').correct);
});
