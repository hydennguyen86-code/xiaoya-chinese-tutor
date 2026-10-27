import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinyinCitation, sameSyllable, toneLabel } from './coursePinyin.mjs';

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

test('known full-tone compound does not inherit the neutral meaning of its substring', async () => {
  assert.equal(pinyinCitation('东西'), 'dōng xi');
  assert.equal(pinyinCitation('东西方'), 'dōng xī fāng');
  const { readSentence } = await import('./listeningPinyin.mjs');
  assert.equal(readSentence('东西方').pinyin, 'dōng xī fāng');
});

test('toneLabel names the light tone instead of calling it tone 1', () => {
  assert.equal(toneLabel('mā'), 'thanh 1');
  assert.equal(toneLabel('má'), 'thanh 2');
  assert.equal(toneLabel('mǎ'), 'thanh 3');
  assert.equal(toneLabel('mà'), 'thanh 4');
  assert.equal(toneLabel('lǜ'), 'thanh 4');
  assert.equal(toneLabel(pinyinCitation('吗')), 'thanh nhẹ');
});

test('sameSyllable lets a light-tone word pass on its sound, not the recognised character', () => {
  assert.equal(sameSyllable('mā', 'ma'), true);
  assert.equal(sameSyllable('mà', 'ma'), true);
  assert.equal(sameSyllable('mā', 'māo'), false);
  assert.equal(sameSyllable('lǜ', 'lu'), false);
  assert.equal(sameSyllable('', 'ma'), false);
});
