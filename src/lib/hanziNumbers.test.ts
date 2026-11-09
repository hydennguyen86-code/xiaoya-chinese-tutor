import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitwise, numberCandidates, positional, readingsOf } from './hanziNumbers.mjs';
import { containsReading, normalizeHeard, readingOk, scoreReading } from './readingScore.mjs';
import { measureFluency } from '../../server/fluency.mjs';

test('đọc số theo giá trị và từng chữ số', () => {
  assert.equal(positional('25'), '二十五');
  assert.equal(positional('10'), '十');
  assert.equal(positional('15'), '十五');
  assert.equal(positional('110'), '一百一十');
  assert.equal(positional('120'), '一百二十');
  assert.equal(positional('205'), '二百零五');
  assert.equal(positional('2160', { liang: true }), '两千一百六十');
  assert.equal(positional('10000'), '一万');
  assert.equal(positional('20000', { liang: true }), '两万');
  assert.equal(positional('10050'), '一万零五十');
  assert.equal(digitwise('0123'), '零一二三');
  assert.equal(positional('012'), '零一二', 'số bắt đầu bằng 0 là dãy số, đọc từng chữ');
  assert.deepEqual(readingsOf('4%'), ['百分之四']);
  assert.ok(readingsOf('8:30').includes('八点半'));
  assert.ok(readingsOf('8:10').includes('八点十分'));
  assert.ok(readingsOf('7.2').includes('七块二'));
  assert.deepEqual(numberCandidates('你好'), ['你好']);
  assert.ok(numberCandidates('135,7208').includes('一三五,七二零八'));
});

test('người học đọc đúng số mà máy chép ra chữ số vẫn được chấm đúng', () => {
  const cases: [string, string][] = [
    ['我今年二十五岁。', '我今年25岁'],
    ['一三五，七二零八，九四六一。', '135,7208,9461'],
    ['这件一百二十块。', '这件120块'],
    ['两千一百六十块', '2160块'],
    ['二百五十块', '250块'],
    ['两百块', '200块'],
    ['现在八点十分。', '现在8:10'],
    ['九点半上课', '9:30上课'],
    ['降价百分之四', '降价4%'],
    ['一美元换七块二', '1美元换7.2'],
    ['他的电话号码是三二一。', '他的电话号码是321'],
  ];
  for (const [target, heard] of cases) {
    const r = scoreReading(target, heard);
    assert.equal(r.score, 100, `${target} ← ${heard}: ${r.summary}`);
    assert.ok(r.ok);
    assert.ok(readingOk(target, heard));
  }
  assert.ok(containsReading('二十五岁', '我今年25岁了').ok);
});

test('số đọc sai vẫn bị báo sai', () => {
  assert.equal(scoreReading('二十六块', '27块').ok, false);
  assert.equal(scoreReading('一百二十块', '100块').ok, false);
  assert.equal(scoreReading('三点半', '4点半').ok, false);
});

test('normalizeHeard trả bản chép bằng chữ Hán để đếm âm tiết', () => {
  assert.equal(normalizeHeard('我今年二十五岁。', '我今年25岁'), '我今年二十五岁');
  assert.equal(normalizeHeard('你好', '你好'), '你好');
});

test('độ trôi chảy đếm âm tiết của chữ số theo cách đọc', () => {
  const timing = { speechStart: 0, speechEnd: 2, pauses: [] };
  assert.equal(measureFluency(timing, '我25岁')?.syllables, 5);
});
