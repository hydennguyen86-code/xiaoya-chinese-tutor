import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mouthShape } from './lamMouth.ts';
import { buildSpeechTimeline } from './lipsync.ts';

test('loud audio does not open a PP closure or an explicit silence', () => {
  const closed = mouthShape('PP', 1);
  assert.equal(closed.jawOpen ?? 0, 0);
  assert.ok(closed.mouthClose >= 0.7);
  assert.equal(mouthShape('sil', 1).jawOpen ?? 0, 0);
  assert.ok((mouthShape(null, 1).jawOpen ?? 0) <= 0.09);
});

test('a, i, u, and ü have distinct mouth targets', () => {
  assert.ok(mouthShape('aa', 0.6).jawOpen > mouthShape('I', 0.6).jawOpen);
  assert.ok(mouthShape('aa', 1).jawOpen <= 0.34);
  assert.ok(mouthShape('U', 0.6).mouthPucker > (mouthShape('I', 0.6).mouthPucker ?? 0));
  assert.ok(mouthShape('Y', 0.6).mouthStretchLeft > (mouthShape('U', 0.6).mouthStretchLeft ?? 0));
});

test('Chinese pinyin distinguishes ü and apical i', () => {
  const timeline = buildSpeechTimeline('鱼去书知不', [], 1800);
  assert.ok(timeline.visemes.includes('Y'));
  assert.ok(timeline.visemes.includes('CH'));
  assert.ok(timeline.visemes.includes('PP'));
  const vowels = timeline.visemes.filter((viseme) => viseme !== 'sil');
  assert.notEqual(vowels[0], 'U');
});
