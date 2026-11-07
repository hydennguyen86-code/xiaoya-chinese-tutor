import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLearning, loadLearning, recordPronunciation, reviewPronunciation, duePronunciation, reviewWord } from './learning.ts';
test('legacy learning loads with a new pronunciation list without losing words, reviews are shorter and unclear does not advance', () => {
  const original = globalThis.localStorage;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) },
  });
  try {
    values.set('xiaoya.learning.v1:old', JSON.stringify({ version: 1, words: [{ word: '好', meaning: 'tốt', box: 1 }], updatedAt: 42 }));
    const migrated = loadLearning('old');
    assert.equal(migrated.version, 2);
    assert.equal(migrated.words.length, 1);
    assert.deepEqual(migrated.pronunciation, []);
    let p = recordPronunciation(emptyLearning(), { kind: 'tone', target: '好', contrast: '3', heard: '2' }, 100);
    assert.equal(duePronunciation(p, 100).length, 1);
    const id = p.pronunciation[0].id;
    assert.equal(reviewPronunciation(p, id, null, 200), p);
    p = reviewPronunciation(p, id, true, 200);
    assert.equal(p.pronunciation[0].dueAt, 200 + 30 * 60000);
    assert.equal(duePronunciation(p, 200).length, 0);
    p = reviewPronunciation(p, id, false, 300);
    assert.equal(p.pronunciation[0].dueAt, 300 + 5 * 60000);
    assert.deepEqual(loadLearning('another').pronunciation, []);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
});

test('broken pronunciation schedules are discarded and duplicate IDs cannot multiply due cards', () => {
  const original = globalThis.localStorage;
  const entry = recordPronunciation(emptyLearning(), { kind: 'tone', target: '好', contrast: '3', heard: '2' }, 100).pronunciation[0];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify({ ...emptyLearning(), pronunciation: [entry, entry, { ...entry, target: '' }, { ...entry, dueAt: undefined }] }),
    },
  });
  try {
    const p = loadLearning('synthetic');
    assert.equal(p.pronunciation.length, 1);
    assert.equal(reviewPronunciation(p, 'absent', true, 200), p);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
});

test('reviews are scheduled by FSRS: intervals grow when remembered and reset when forgotten', async () => {
  const { reviewWord, emptyLearning, recordLearningTurn } = await import('./learning.ts');
  const t0 = Date.parse('2026-11-01T08:00:00Z');
  let profile = recordLearningTurn(
    emptyLearning(),
    '我喜欢苹果',
    { corrections: [], vocab: [{ word: '苹果', pinyin: 'píngguǒ', meaning: 'quả táo' }] },
    { timestamp: t0 },
  );
  const word = () => profile.words.find((w) => w.word === '苹果')!;
  assert.equal(word().box, 0);
  profile = reviewWord(profile, '苹果', true, t0);
  const first = word();
  assert.ok(first.fsrs, 'FSRS state is stored');
  assert.ok(first.dueAt > t0 && first.dueAt - t0 < 2 * 86400000, 'a first Good review comes back within two days');
  const t1 = first.dueAt + 1000;
  profile = reviewWord(profile, '苹果', true, t1);
  const second = word();
  assert.ok(second.dueAt - t1 > first.dueAt - t0, 'the interval grows');
  assert.ok(second.box >= first.box);
  const t2 = second.dueAt + 1000;
  profile = reviewWord(profile, '苹果', false, t2);
  const lapsed = word();
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.dueAt - t2 < 86400000, 'a forgotten word comes back the same day');
  assert.equal(lapsed.box, 1);
  assert.equal(lapsed.reviews, 3);
});

test('a word last reviewed under the old ladder keeps a sensible schedule after the switch', async () => {
  const { reviewWord, emptyLearning } = await import('./learning.ts');
  const t0 = Date.parse('2026-11-01T08:00:00Z');
  const legacy = {
    ...emptyLearning(t0),
    words: [
      {
        word: '学校',
        pinyin: 'xuéxiào',
        meaning: 'trường học',
        count: 3,
        firstSeen: t0 - 20 * 86400000,
        lastSeen: t0,
        box: 4,
        dueAt: t0,
        reviews: 4,
        lapses: 0,
      },
    ],
  };
  const next = reviewWord(legacy, '学校', true, t0).words[0];
  assert.ok(next.fsrs, 'the review creates FSRS state');
  assert.ok(next.dueAt - t0 > 10 * 86400000, 'a word that held for two weeks is not asked again tomorrow');
  assert.ok(next.dueAt - t0 <= 120 * 86400000);
});
