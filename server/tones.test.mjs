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
  assert.deepEqual(
    expectedTones('你好').map((s) => s.expected),
    [2, 3],
  );
  assert.deepEqual(
    expectedTones('不是').map((s) => s.expected),
    [2, 4],
  );
  assert.deepEqual(
    expectedTones('一起').map((s) => s.expected),
    [4, 3],
  );
  assert.deepEqual(
    expectedTones('中国，好！').map((s) => s.char),
    ['中', '国', '好'],
  );
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

test('analyseTones exposes ordered bounded timestamps for words and sentences', async () => {
  const { analyseTones } = await import('./tones.mjs');
  // A generated PCM fixture checks timestamps, never a human-accuracy claim.
  const rate = 16000;
  const count = rate * 2;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + count * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 180 * i) / rate)), 44 + i * 2);
  for (const text of ['中国', '我学习汉语']) {
    const report = await analyseTones(wav, text);
    assert.equal(report.segments.length, [...text].length);
    assert.equal(report.duration, 2);
    report.segments.forEach((part, index) => {
      assert.equal(part.char, [...text][index]);
      assert.ok(part.start >= 0 && part.end > part.start && part.end <= report.duration);
      if (index) assert.equal(part.start, report.segments[index - 1].end);
    });
  }
});

test('a short, high, creaky syllable is left unjudged instead of being called tone 3', () => {
  // measured on a Vietnamese learner: 爸/费/骂 clipped like thanh nặng, little pitch left
  const high = {
    start: 3,
    end: 3,
    min: 3,
    change: 0,
    rise: 0.4,
    fall: 0.2,
    minPos: 0,
    range: 0.8,
    height: 1.2,
    startHeight: 1.2,
    endHeight: 1.2,
    minHeight: 1.2,
    voicedRatio: 0.4,
    frames: 10,
  };
  assert.equal(classifyIsolated(high, true), 0);
  const low = { ...high, height: 0.1, startHeight: 0.2, endHeight: 0, minHeight: 0 };
  assert.equal(classifyIsolated(low, true), 3);
});
