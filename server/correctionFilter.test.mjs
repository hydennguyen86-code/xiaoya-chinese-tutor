import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStyleOnlyEdit } from './correctionFilter.mjs';

// Style-only edits the 4B model proposed on correct sentences during evaluation.
test('treats synonym, intensifier, 儿 and particle swaps as style only', () => {
  assert.equal(isStyleOnlyEdit('说', '讲'), true);
  assert.equal(isStyleOnlyEdit('一会儿', '一会'), true);
  assert.equal(isStyleOnlyEdit('走走吧', '走走'), true);
  assert.equal(isStyleOnlyEdit('很', '非常'), true);
  assert.equal(isStyleOnlyEdit('很流利。', '很流利'), true);
  assert.equal(isStyleOnlyEdit('', '吃'), true);
  // dropping 很 outside a comparison (seen while testing the daily lesson)
  assert.equal(isStyleOnlyEdit('我最近压力很大吗？', '我最近压力大吗？', '我最近压力很大吗？'), true);
  assert.equal(isStyleOnlyEdit('压力挺大的', '压力大', '经常加班，压力挺大的。'), true);
});

// Real fixes from the evaluation set must survive the filter.
test('keeps genuine grammar, word-order and measure-word fixes', () => {
  assert.equal(isStyleOnlyEdit('三个书', '三本书'), false);
  assert.equal(isStyleOnlyEdit('他比我很高', '他比我高'), false);
  assert.equal(isStyleOnlyEdit('我们见面明天', '我们明天见面'), false);
  assert.equal(isStyleOnlyEdit('看书在晚上', '晚上看书'), false);
  assert.equal(isStyleOnlyEdit('昨天我不去上班', '昨天我没去上班'), false);
  assert.equal(isStyleOnlyEdit('两个衣服', '两件衣服'), false);
});
