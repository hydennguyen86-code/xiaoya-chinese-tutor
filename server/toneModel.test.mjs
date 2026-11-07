import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeVerdict } from './toneModel.mjs';

const opts = { minConfidence: 0.6, overrideConfidence: 0.8 };

test('without the model the rule verdict is reported as before', () => {
  assert.deepEqual(mergeVerdict(2, null, 2, opts), { heard: 2, ok: true, confidence: null, method: 'rules' });
  assert.deepEqual(mergeVerdict(2, null, 3, opts), { heard: 3, ok: false, confidence: null, method: 'rules' });
  assert.equal(mergeVerdict(2, null, 0, opts).ok, null);
});

test('a confident model verdict stands on its own', () => {
  assert.equal(mergeVerdict(1, { tone: 1, confidence: 0.9 }, null, opts).ok, true);
  const wrong = mergeVerdict(1, { tone: 2, confidence: 0.9 }, null, opts);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.heard, 2);
  assert.equal(wrong.method, 'model');
});

test('a low-confidence mismatch is "not judged" instead of "wrong"', () => {
  const unsure = mergeVerdict(1, { tone: 2, confidence: 0.45 }, null, opts);
  assert.equal(unsure.ok, null);
  assert.equal(unsure.heard, 2);
});

test('the rules can keep a correct syllable when the model is not sure enough to override', () => {
  const kept = mergeVerdict(3, { tone: 2, confidence: 0.7 }, 3, opts);
  assert.equal(kept.ok, true);
  assert.equal(kept.method, 'rules>model');
  const overridden = mergeVerdict(3, { tone: 2, confidence: 0.85 }, 3, opts);
  assert.equal(overridden.ok, false);
});

test('model and rules disagreeing three ways gives no verdict unless the model is very sure', () => {
  assert.equal(mergeVerdict(1, { tone: 2, confidence: 0.7 }, 3, opts).ok, null);
  assert.equal(mergeVerdict(1, { tone: 2, confidence: 0.9 }, 3, opts).ok, false);
});

test('neutral syllables are only ever confirmed, never marked wrong', () => {
  assert.equal(mergeVerdict(0, { tone: 5, confidence: 0.9 }, null, opts).ok, true);
  assert.equal(mergeVerdict(0, { tone: 4, confidence: 0.9 }, null, opts).ok, null);
});

test('analyseTones uses an injected scorer for words and sentences and falls back without one', async () => {
  const { analyseTones } = await import('./tones.mjs');
  const rate = 16000;
  // 1.2 s of a 200 Hz tone with two short gaps: enough speech to split into syllables
  const pcm = new Float32Array(Math.round(rate * 1.2));
  for (let i = 0; i < pcm.length; i += 1) {
    const t = i / rate;
    const gap = (t > 0.38 && t < 0.42) || (t > 0.78 && t < 0.82);
    pcm[i] = gap ? 0 : 0.3 * Math.sin(2 * Math.PI * 200 * t);
  }
  const scorer = async (_pcm, segments) => segments.map((s, i) => ({ tone: i === 1 ? 2 : 1, confidence: 0.95, probs: [] }));
  const sentence = await analyseTones(null, '妈妈好', { pcm, scorer });
  assert.equal(sentence.mode, 'sentence');
  assert.equal(sentence.method, 'model');
  assert.equal(sentence.syllables.length, 3);
  assert.equal(sentence.syllables[0].ok, true); // 妈 = tone 1, model heard 1
  assert.equal(sentence.syllables[2].ok, false); // 好 = tone 3, model confidently heard 1
  assert.equal(sentence.checked, 2); // 妈 (neutral, 2nd syllable) is not graded
  const plain = await analyseTones(null, '妈妈好', { pcm, scorer: null });
  assert.equal(plain.mode, 'sentence');
  assert.equal(plain.method, 'rules');
  assert.equal(plain.checked, 0);
  const word = await analyseTones(null, '妈', { pcm, scorer });
  assert.equal(word.mode, 'word');
  assert.equal(word.syllables[0].method, 'model');
  assert.equal(word.syllables[0].ok, true);
});
