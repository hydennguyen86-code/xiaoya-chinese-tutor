import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIssues, buildCoachMessages, coachFeedback, pinyinOf, sanitizeCoach, sanitizeWordNotes, tierOfLevel } from './coach.mjs';

const SAID = '我昨天去了超市买东西了';
const MODEL_FIX = {
  verdict: 'fix',
  corrected: '我昨天去超市买了东西',
  issues: [
    {
      original: '去了超市买东西了',
      corrected: '去超市买了东西',
      category: 'grammar',
      why: 'Trong chuỗi 去 + nơi + làm gì, 了 đặt sau động từ chính 买.',
    },
  ],
  natural: '我昨天去超市买了点儿东西',
  naturalVi: 'Thêm 点儿 cho câu nhẹ, tự nhiên.',
  pattern: '去 + nơi + 动词 + 了 + tân ngữ',
  patternVi: 'Kể đã đi đâu làm gì.',
  praise: '',
};

test('tier follows the level', () => {
  assert.equal(tierOfLevel('HSK1-2'), 'foundation');
  assert.equal(tierOfLevel('HSK3-4'), 'coach');
  assert.equal(tierOfLevel('free'), 'coach');
});

test('a real mistake becomes a fix with the corrected sentence, pinyin, natural and pattern', () => {
  const coach = sanitizeCoach(MODEL_FIX, SAID, { level: 'HSK3-4' });
  assert.equal(coach.verdict, 'fix');
  assert.equal(coach.corrected, '我昨天去超市买了东西');
  assert.match(coach.correctedPinyin, /mǎi le/);
  assert.equal(coach.issues.length, 1);
  assert.equal(coach.issues[0].category, 'grammar');
  assert.equal(coach.natural, '我昨天去超市买了点儿东西');
  assert.equal(coach.pattern, '去 + nơi + 动词 + 了 + tân ngữ');
  assert.equal(coach.praise, '');
});

test('fragments that are not in the learner sentence are dropped', () => {
  const coach = sanitizeCoach(
    { ...MODEL_FIX, issues: [{ ...MODEL_FIX.issues[0], original: '去超市了' }], natural: '' },
    SAID,
    { level: 'HSK3-4' },
  );
  // nothing trustworthy is left as a mistake: the model sentence is offered as the more natural way
  assert.equal(coach.verdict, 'polish');
  assert.deepEqual(coach.issues, []);
  assert.equal(coach.natural, '我昨天去超市买了东西');
});

test('style-only edits are not called mistakes', () => {
  const coach = sanitizeCoach(
    {
      verdict: 'fix',
      corrected: '我非常忙',
      issues: [{ original: '很', corrected: '非常', category: 'word_choice', why: 'Dùng 非常 mạnh hơn.' }],
      natural: '',
      naturalVi: '',
      pattern: '',
      patternVi: '',
      praise: '',
    },
    '我很忙',
    { level: 'HSK3-4' },
  );
  assert.equal(coach, null);
});

test('an explanation must be Vietnamese', () => {
  const coach = sanitizeCoach(
    { ...MODEL_FIX, issues: [{ ...MODEL_FIX.issues[0], why: '了要放在买后面。' }], natural: '' },
    SAID,
    { level: 'HSK3-4' },
  );
  assert.notEqual(coach?.verdict, 'fix');
});

test('ok needs the model to say ok; praise is kept', () => {
  const ok = sanitizeCoach(
    { verdict: 'ok', corrected: '', issues: [], natural: '', naturalVi: '', pattern: '', patternVi: '', praise: 'Dùng 了 sau 买 rất đúng chỗ.' },
    '我昨天去超市买了东西',
    { level: 'HSK3-4' },
  );
  assert.equal(ok.verdict, 'ok');
  assert.equal(ok.praise, 'Dùng 了 sau 买 rất đúng chỗ.');
  assert.equal(sanitizeCoach({ corrections: [] }, '你好', { level: 'HSK3-4' }), null);
  assert.equal(sanitizeCoach(null, '你好', { level: 'HSK3-4' }), null);
});

test('HSK 1–2 keeps at most two issues and drops a long natural sentence', () => {
  const said = '我有三个书和两个车在家里我很喜欢看';
  const coach = sanitizeCoach(
    {
      verdict: 'fix',
      corrected: '我家里有三本书和两辆车',
      issues: [
        { original: '三个书', corrected: '三本书', category: 'measure_word', why: 'Sách dùng lượng từ 本.' },
        { original: '两个车', corrected: '两辆车', category: 'measure_word', why: 'Xe dùng lượng từ 辆.' },
        { original: '在家里', corrected: '家里', category: 'word_order', why: 'Bỏ 在 ở đây.' },
      ],
      natural: '我家里有三本书、两辆车，我很喜欢看书',
      naturalVi: 'Tự nhiên hơn.',
      pattern: '',
      patternVi: '',
      praise: '',
    },
    said,
    { level: 'HSK1-2' },
  );
  assert.equal(coach.verdict, 'fix');
  assert.equal(coach.issues.length, 2);
  assert.equal(coach.natural, '');
});

test('applyIssues replaces fragments in order', () => {
  assert.equal(applyIssues('我三个书', [{ original: '三个书', corrected: '三本书' }]), '我三本书');
});

test('rules work without a model', async () => {
  const result = await coachFeedback({ provider: 'rules', model: '', level: 'HSK3-4', text: '我工作在银行' });
  assert.equal(result.coach.verdict, 'fix');
  assert.equal(result.coach.corrected, '我在银行工作');
  assert.equal(result.corrections.length, 1);
  assert.ok(result.corrections[0].explanation);
  const clean = await coachFeedback({ provider: 'rules', model: '', level: 'HSK3-4', text: '我在银行工作' });
  assert.equal(clean.coach, null);
  assert.deepEqual(clean.corrections, []);
});

test('coach prompt carries the context line and level rules', () => {
  const [system, user] = buildCoachMessages('HSK1-2', '我好', '你好吗？');
  assert.match(system.content, /tối đa 2/);
  assert.match(user.content, /Câu Coach nói trước: 你好吗？/);
  assert.match(buildCoachMessages('HSK5-6', '我好')[0].content, /tối đa 3/);
});

test('word notes keep only valid parts and examples with the word, pinyin computed locally', () => {
  const notes = sanitizeWordNotes(
    {
      parts: [
        { char: '电', meaning: 'điện' },
        { char: '脑', meaning: 'não, đầu óc' },
        { char: 'X', meaning: 'sai' },
      ],
      origin: 'Ghép “điện” với “não”: bộ não chạy bằng điện.',
      memoryTip: 'Điện não = máy tính.',
      usage: 'Hay đi với 用、买、开.',
      examples: [
        { zh: '我每天用电脑工作。', vi: 'Tôi làm việc bằng máy tính mỗi ngày.' },
        { zh: '你好。', vi: 'Xin chào.' },
      ],
    },
    '电脑',
  );
  assert.equal(notes.parts.length, 2);
  assert.equal(notes.examples.length, 1);
  assert.match(notes.examples[0].pinyin, /diàn nǎo/);
  assert.equal(sanitizeWordNotes(null, '电脑'), null);
  assert.equal(pinyinOf('abc'), '');
});
