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

test('pinyin-pro mis-reads these in context; the lock table keeps the dictionary reading', () => {
  for (const [sentence, expected] of [
    ['银行人很多，要排队。', 'yín háng rén hěn duō ， yào pái duì 。'],
    ['银行在哪儿？', 'yín háng zài nǎr ？'],
    ['今天我没来上班，你别着急。', 'jīn tiān wǒ méi lái shàng bān ， nǐ bié zháo jí 。'],
    ['钥匙帮我再配一把。', 'yào shi bāng wǒ zài pèi yì bǎ 。'],
    ['最后可能并不便宜。', 'zuì hòu kě néng bìng bù pián yi 。'],
    ['押金应该先退还是先检查？', 'yā jīn yīng gāi xiān tuì hái shì xiān jiǎn chá ？'],
    ['你明天有空吗？', 'nǐ míng tiān yǒu kòng ma ？'],
    ['房间空着。', 'fáng jiān kòng zhe 。'],
    ['空调需要维修。', 'kōng tiáo xū yào wéi xiū 。'],
    ['不过只送小号的。', 'bú guò zhǐ sòng xiǎo hào de 。'],
    ['教育孩子不能只看成绩。', 'jiào yù hái zi bù néng zhǐ kàn chéng jì 。'],
    ['这项调查只访问了一个社区。', 'zhè xiàng diào chá zhǐ fǎng wèn le yí gè shè qū 。'],
    ['租金一个月一千八百块。', 'zū jīn yí gè yuè yì qiān bā bǎi kuài 。'],
    ['押金付两个月，退房的时候还。', 'yā jīn fù liǎng gè yuè ， tuì fáng de shí hou huán 。'],
    ['我们还需要讨论。', 'wǒ men hái xū yào tǎo lùn 。'],
  ]) {
    assert.equal(pinyinCitation(sentence), expected, sentence);
  }
});

test('the grader reads the same locked syllables as the displayed pinyin', async () => {
  const { readSentence } = await import('./listeningPinyin.mjs');
  assert.equal(readSentence('银行人很多').pinyin, 'yín háng rén hěn duō');
  assert.equal(readSentence('你别着急').pinyin, 'nǐ bié zháo jí');
  assert.equal(readSentence('你明天有空吗').pinyin, 'nǐ míng tiān yǒu kòng ma');
  assert.equal(readSentence('房间空着').pinyin, 'fáng jiān kòng zhe');
});

test('得 is light after a verb, děi when it means "must", dé when it means "obtain"', () => {
  for (const [sentence, expected] of [
    ['马跑得很快。', 'mǎ pǎo de hěn kuài 。'],
    ['重要的不是练得多。', 'zhòng yào de bú shì liàn de duō 。'],
    ['每天浪费的食物多得惊人。', 'měi tiān làng fèi de shí wù duō de jīng rén 。'],
    ['那天我得加班。', 'nà tiān wǒ děi jiā bān 。'],
    ['是个坏习惯，得改掉。', 'shì gè huài xí guàn ， děi gǎi diào 。'],
    ['我打电话叫维修的人过来。', 'wǒ dǎ diàn huà jiào wéi xiū de rén guò lái 。'],
  ]) {
    assert.equal(pinyinCitation(sentence), expected, sentence);
  }
  // Các khoá 得 không được phép bắt nhầm 得 trong 觉得 hay 得到/得出.
  for (const [sentence, expected] of [
    ['你觉得早上锻炼好？', 'nǐ jué de zǎo shang duàn liàn hǎo ？'],
    ['我得到一个人的帮助。', 'wǒ dé dào yí gè rén de bāng zhù 。'],
    ['急着得出结论。', 'jí zhe dé chū jié lùn 。'],
  ]) {
    assert.equal(pinyinCitation(sentence), expected, sentence);
  }
});

test('一起 keeps its sandhi reading even when the surrounding sentence changes', () => {
  assert.equal(pinyinCitation('可以，周六一起看房屋状况。'), 'kě yǐ ， zhōu liù yì qǐ kàn fáng wū zhuàng kuàng 。');
  assert.equal(pinyinCitation('最后可能并不便宜。'), 'zuì hòu kě néng bìng bù pián yi 。');
});

test('Latin words inside a Chinese sentence stay one word, not letter-by-letter', () => {
  assert.equal(pinyinCitation('我的目标是明年通过 HSK 五级。'), 'wǒ de mù biāo shì míng nián tōng guò   HSK   wǔ jí 。');
  assert.equal(pinyinCitation('B超做完了。'), 'B chāo zuò wán le 。');
});

test('儿 hoá: 哪儿/这儿/点儿… gộp một âm tiết, 儿子/女儿 giữ 儿 riêng', async () => {
  for (const [sentence, expected] of [
    ['哪儿', 'nǎr'],
    ['这儿', 'zhèr'],
    ['那儿', 'nàr'],
    ['一点儿', 'yì diǎnr'],
    ['有点儿远', 'yǒu diǎnr yuǎn'],
    ['一会儿', 'yí huìr'],
    ['有事儿吗？', 'yǒu shìr ma ？'],
    ['你去哪儿？', 'nǐ qù nǎr ？'],
    ['女儿', 'nǚ ér'],
    ['儿子', 'ér zi'],
    ['三个儿子', 'sān gè ér zi'],
    ['儿科', 'ér kē'],
  ]) {
    assert.equal(pinyinCitation(sentence), expected, sentence);
  }
  const { readSentence } = await import('./listeningPinyin.mjs');
  const r = readSentence('有点儿远', [], [], { allSandhi: true });
  assert.equal(r.pinyin, 'yóu diǎnr yuǎn');
  assert.deepEqual(r.tones, [2, 3, 3]);
  assert.deepEqual(r.dict, [3, 3, 3]);
  assert.deepEqual(r.parts, ['yóu', 'diǎnr', 'yuǎn']);
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
