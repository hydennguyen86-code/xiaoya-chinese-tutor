import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedTones, gradeTone, nextTone, tonePriority, type ToneItem } from './listeningPractice.ts';
const item: ToneItem = {
  id: 'sandhi',
  level: 'HSK1-2',
  hanzi: '你好',
  pinyin: 'ní hǎo',
  meaningVi: 'chào',
  tone: [2, 3],
  baseTone: [3, 3],
  acceptTones: [
    [2, 3],
    [3, 3],
  ],
  distractors: [[2, 2]],
};
test('authored sandhi accepts declared variants while base metadata is retained', () => {
  assert.ok(gradeTone(item, [2, 3]));
  assert.ok(gradeTone(item, [3, 3]));
  assert.ok(!gradeTone(item, [2, 2]));
  assert.deepEqual(acceptedTones(item), [
    [2, 3],
    [3, 3],
  ]);
});
test('adaptation combines learner-specific confusion and exposure, excludes uncertain and previous items', () => {
  const history = { matrix: { '2:3': 8 }, attempts: {} };
  assert.ok(tonePriority(item, history) > tonePriority({ ...item, tone: 4 }, history));
  assert.equal(nextTone([item, { ...item, id: 'uncertain', uncertain: true }], history, '', 0)?.id, 'sandhi');
});
