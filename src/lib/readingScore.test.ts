import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignSyllables, containsReading, readingOk, scoreReading, syllablesOf } from './readingScore.mjs';

test('đồng âm khác chữ là đúng âm: 事/是, 他/她/它', () => {
  const a = scoreReading('是', '事');
  assert.equal(a.syllables[0].status, 'match');
  assert.ok(a.ok);
  for (const h of ['她', '它']) assert.equal(scoreReading('他', h).syllables[0].status, 'match');
  assert.ok(scoreReading('他是老师', '她事老师').ok);
});

test('妈/马 cùng âm khác thanh → tone, không đạt với một âm', () => {
  const r = scoreReading('妈', '马');
  assert.equal(r.syllables[0].status, 'tone');
  assert.equal(r.syllables[0].heard?.tone, 3);
  assert.equal(r.ok, false);
  assert.match(r.summary, /thanh 3/);
  assert.match(r.summary, /thanh 1/);
});

test('四/十: s/sh gần nhau kèm lệch thanh', () => {
  const r = scoreReading('四', '十');
  assert.equal(r.syllables[0].status, 'near');
  assert.equal(r.syllables[0].toneDiff, true);
  assert.equal(r.syllables[0].near?.from, 's');
  assert.equal(r.syllables[0].near?.to, 'sh');
  assert.equal(r.ok, false);
});

test('thiếu một âm → missing; thừa âm → extra', () => {
  const miss = scoreReading('谢谢你', '谢谢');
  assert.equal(miss.syllables[2].status, 'missing');
  assert.equal(miss.matched, 2);
  const extra = scoreReading('谢谢', '谢谢你');
  assert.equal(extra.extra.length, 1);
  assert.equal(extra.extra[0].char, '你');
  assert.match(extra.summary, /thừa/i);
});

test('câu dài chứa mục tiêu: containsReading tìm đúng cửa sổ', () => {
  const r = containsReading('学习', '今天我在学习汉语');
  assert.ok(r.ok);
  assert.equal(r.matched, 2);
  assert.ok(containsReading('学习', '今天我在雪习汉语').ok === false || containsReading('学习', '今天我在雪习汉语').score >= 70);
  assert.equal(containsReading('银行', '我去那个很大的超市').ok, false);
  assert.ok(readingOk('我是学生', '嗯，我事学生。', { within: true }));
});

test('儿 hoá: 哪儿 là một âm tiết, nghe 哪 vẫn khớp', () => {
  const s = syllablesOf('你在哪儿？');
  assert.equal(s.length, 3);
  assert.equal(s[2].pinyin, 'nǎr');
  assert.equal(s[2].base, 'na');
  assert.ok(scoreReading('哪儿', '哪').ok);
});

test('thanh nhẹ ở mẫu không đòi thanh cụ thể', () => {
  assert.ok(scoreReading('吗', '妈').syllables[0].status === 'match');
  assert.ok(scoreReading('你好吗', '你好马').ok);
});

test('không có chữ Hán → total 0, ok false', () => {
  const r = scoreReading('HSK 5', '你好');
  assert.equal(r.total, 0);
  assert.equal(r.ok, false);
  assert.equal(r.score, 0);
  assert.deepEqual(syllablesOf('123 abc'), []);
  assert.equal(readingOk('', '你好'), false);
});

test('heard rỗng → mọi âm missing; alignSyllables cho vận gần', () => {
  const r = scoreReading('你好', '');
  assert.deepEqual(
    r.syllables.map((s) => s.status),
    ['missing', 'missing'],
  );
  const a = alignSyllables(syllablesOf('清'), syllablesOf('轻'));
  assert.equal(a.syllables[0].status, 'match');
  const b = alignSyllables(syllablesOf('新'), syllablesOf('星'));
  assert.equal(b.syllables[0].status, 'near');
  assert.equal(b.syllables[0].near?.kind, 'final');
});
