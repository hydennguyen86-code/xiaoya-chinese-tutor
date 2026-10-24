import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToProfile, classifyIsolated, expectedTones, pitchTrack, profileRange, toneFeatures } from './tones.mjs';

// pitch frames in semitones from start to end along a few key points
const shape = (...points) => {
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let k = 0; k < 10; k += 1) out.push(points[i] + ((points[i + 1] - points[i]) * k) / 10);
  }
  out.push(points[points.length - 1]);
  return out;
};
const judge = (frames, known = true) => classifyIsolated(toneFeatures(frames, -4, 4), known);

test('expected tones follow the sandhi rules', () => {
  assert.deepEqual(expectedTones('你好').map((s) => s.expected), [2, 3]);
  assert.deepEqual(expectedTones('不是').map((s) => s.expected), [2, 4]);
  assert.deepEqual(expectedTones('一起').map((s) => s.expected), [4, 3]);
  assert.deepEqual(expectedTones('中国，好！').map((s) => s.char), ['中', '国', '好']);
});

test('isolated syllables are classified by contour and height', () => {
  assert.equal(judge(shape(3, 3, 3)), 1); // high and level
  assert.equal(judge(shape(-1.5, 0, 2.5)), 2); // rises from its lowest point
  assert.equal(judge(shape(-1, -2.5, -0.5)), 3); // dips, then rises a little
  assert.equal(judge(shape(-3, -3.5, -3.5)), 3); // low and level
  assert.equal(judge(shape(3, 0, -3)), 4); // high falling
});

test('without a known voice range a level syllable is left unjudged', () => {
  assert.equal(judge(shape(3, 3, 3), false), 0);
  assert.equal(judge(shape(-1.5, 0, 2.5), false), 2);
});

test('the voice range needs enough speech before it is used', () => {
  assert.equal(profileRange(addToProfile(null, new Array(100).fill(200))), null);
  const f0 = Array.from({ length: 1000 }, (_, i) => 150 + (i % 100));
  const range = profileRange(addToProfile(null, f0));
  assert.ok(range.low < range.median && range.median < range.high);
  assert.ok(Math.abs(range.median - 200) < 10);
});

test('pitch tracking finds the frequency of a steady tone', () => {
  const rate = 16000;
  const samples = Float32Array.from({ length: rate }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate));
  const { median } = pitchTrack(samples);
  assert.ok(Math.abs(median - 220) < 5, `median ${median}`);
});
