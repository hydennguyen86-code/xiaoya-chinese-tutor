import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinyinCitation } from './coursePinyin.mjs';

test('的/了/子 keep their tone where they are full morphemes', () => {
  for (const [word, expected] of [
    ['目的', 'mù dì'],
    ['的确', 'dí què'],
    ['了解', 'liǎo jiě'],
    ['电子', 'diàn zǐ'],
    ['王子', 'wáng zǐ'],
    ['男子', 'nán zǐ'],
    ['学子', 'xué zǐ'],
  ]) {
    assert.equal(pinyinCitation(word), expected, word);
  }
});

test('particles and everyday 子 nouns are neutral', () => {
  for (const [word, expected] of [
    ['我的', 'wǒ de'],
    ['吃了', 'chī le'],
    ['孩子', 'hái zi'],
    ['鞋子', 'xié zi'],
    ['饺子', 'jiǎo zi'],
    ['例子', 'lì zi'],
    ['一下子', 'yí xià zi'],
    ['我们', 'wǒ men'],
    ['好吧', 'hǎo ba'],
  ]) {
    assert.equal(pinyinCitation(word), expected, word);
  }
});
