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
