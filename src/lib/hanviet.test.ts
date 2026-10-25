import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANVIET_SOURCE, hanVietParts, hanVietText, wordTraps, hanVietBank } from './hanviet.ts';
test('Unihan lookup follows traditional variants, preserves alternatives and never invents missing readings', () => {
  assert.equal(HANVIET_SOURCE.version, '17.0.0');
  assert.equal(hanVietText('学习'), 'học tập');
  assert.equal(hanVietText('學習'), 'học tập');
  assert.deepEqual(hanVietParts('学')[0].via, ['學']);
  assert.ok(hanVietParts('东')[0].readings.length > 1);
  assert.equal(hanVietParts('ABC').length, 0);
  const missing = hanVietParts(String.fromCodePoint(0x323af))[0];
  assert.deepEqual(missing.readings, []);
  assert.ok(hanVietText(missing.char).includes('chưa có dữ liệu'));
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
