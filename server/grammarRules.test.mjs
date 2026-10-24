import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCorrections, ruleCorrections } from './grammarRules.mjs';

const fixes = (sentence) => ruleCorrections(sentence).map((c) => `${c.original}→${c.corrected}`);

test('catches common word-order and measure-word errors', () => {
  assert.deepEqual(fixes('我有三个书。'), ['三个书→三本书']);
  assert.deepEqual(fixes('我想买两个衣服。'), ['两个衣服→两件衣服']);
  assert.deepEqual(fixes('他比我很高。'), ['比我很高→比我高']);
  assert.deepEqual(fixes('我没有去了学校。'), ['没有去了→没有去']);
  assert.deepEqual(fixes('我会说中文一点儿。'), ['说中文一点儿→说一点儿中文']);
  assert.deepEqual(fixes('我的工作很忙在公司。'), ['很忙在公司→在公司很忙']);
  assert.deepEqual(fixes('我工作在银行。'), ['工作在银行→在银行工作']);
  assert.deepEqual(fixes('他每天都吃早饭在家。'), ['吃早饭在家→在家吃早饭']);
  assert.deepEqual(fixes('我们吃饭在餐厅吧。'), ['吃饭在餐厅→在餐厅吃饭']);
  assert.deepEqual(fixes('我们见面明天。'), ['我们见面明天→我们明天见面']);
  assert.deepEqual(fixes('我去过北京两次去年。'), ['我去过北京两次去年→我去年去过北京两次']);
});

test('leaves correct look-alikes alone', () => {
  for (const sentence of [
    '我住在河内。', '书放在桌子上。', '他坐在椅子上。', '我在公司很忙。',
    '我好久没去了。', '没有办法了。', '我还没吃饭。',
    '我比较喜欢喝茶。', '这场比赛很精彩。', '他比我高多了。', '比如说，你可以早点儿来。',
    '我们明天见。', '我今天很忙。', '我最喜欢的是明天。', '我买了一本书。', '这个人很好。',
    '你最近压力很大吗？', '我会说一点儿中文。', '他每天在家吃早饭。',
  ]) {
    assert.deepEqual(fixes(sentence), [], sentence);
  }
});

test('rule fixes come first and overlapping model fixes are dropped', () => {
  const rule = [{ original: '很忙在公司', corrected: '在公司很忙', explanation: '', category: 'word_order' }];
  const model = [
    { original: '忙在公司', corrected: '在公司忙', explanation: '', category: 'word_order' },
    { original: '经常加班', corrected: '常常加班', explanation: '', category: 'word_choice' },
  ];
  assert.deepEqual(mergeCorrections(rule, model).map((c) => c.original), ['很忙在公司', '经常加班']);
});
