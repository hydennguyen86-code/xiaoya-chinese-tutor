import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANVIET_AUTHORED_SOURCE, HANVIET_SOURCE, hanVietParts, hanVietText, wordTraps, hanVietBank } from './hanviet.ts';
test('Unihan lookup follows traditional variants, preserves alternatives and never invents missing readings', () => {
  assert.equal(HANVIET_SOURCE.version, '17.0.0');
  assert.equal(hanVietText('学习'), 'học tập');
  assert.equal(hanVietText('學習'), 'học tập');
  assert.deepEqual(hanVietParts('学')[0].via, ['學']);
  assert.ok(hanVietParts('彐')[0].readings.length > 1);
  assert.equal(hanVietParts('ABC').length, 0);
  const missing = hanVietParts(String.fromCodePoint(0x323af))[0];
  assert.deepEqual(missing.readings, []);
  assert.equal(hanVietText(missing.char), '');
});
test('AI-authored character readings take priority and cover the requested examples', () => {
  assert.equal(HANVIET_AUTHORED_SOURCE, 'AI soạn, chưa duyệt');
  assert.equal(hanVietText('电话'), 'điện thoại');
  assert.equal(hanVietText('你好'), 'nhĩ hảo');
  assert.equal(hanVietText('家'), 'gia');
  assert.equal(hanVietParts('你')[0].source, 'authored');
});
test('characters without authored readings use Unihan, and characters without either source are hidden', () => {
  const traditional = hanVietParts('學')[0];
  assert.equal(traditional.source, 'unihan');
  assert.ok(traditional.readings.length > 0);
  const missing = String.fromCodePoint(0x323af);
  assert.equal(hanVietParts(missing)[0].source, 'missing');
  assert.equal(hanVietText(missing), '');
});
test('semantic traps and sound mnemonics remain separate AI drafts', () => {
  assert.equal(hanVietBank.source, 'AI soạn, chưa duyệt');
  assert.deepEqual([...new Set(hanVietBank.items.map((t) => t.trap))].sort(), ['nghĩa', 'âm'].sort());
  assert.ok(wordTraps('东西').some((t) => t.trap === 'nghĩa'));
  assert.ok(wordTraps('学习').every((t) => t.trap !== 'nghĩa'));
  for (const t of hanVietBank.items.filter((t) => t.trap === 'âm')) assert.match(t.noteVi, /gần đúng/i);
});

test('single-character hints do not attach to unrelated long words', () => {
  const single = hanVietBank.items.find((t) => t.trap === 'âm' && [...t.hanzi].length === 1)!;
  assert.ok(wordTraps(single.hanzi).some((t) => t.id === single.id));
  assert.deepEqual(wordTraps(single.hanzi + '未知'), []);
});
