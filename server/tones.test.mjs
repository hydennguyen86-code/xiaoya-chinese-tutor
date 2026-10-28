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

test('儿 hoá merges 儿 into the previous syllable so the grader splits one segment', () => {
  assert.deepEqual(expectedTones('哪儿'), [{ char: '哪儿', pinyin: 'nǎr', expected: 3 }]);
  assert.deepEqual(expectedTones('有点儿'), [
    { char: '有', pinyin: 'yǒu', expected: 2 },
    { char: '点儿', pinyin: 'diǎnr', expected: 3 },
  ]);
  assert.deepEqual(
    expectedTones('儿子').map((s) => s.char),
    ['儿', '子'],
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

test('inside a word: a tone 1 gliding up from the previous syllable, and a low first syllable that still rises', () => {
  const base = {
    start: 0,
    end: 0,
    min: 0,
    change: 0,
    rise: 0,
    fall: 0,
    minPos: 0,
    range: 0,
    height: 0.5,
    startHeight: 0.5,
    endHeight: 0.5,
    minHeight: 0.5,
    voicedRatio: 1,
    frames: 18,
  };
  // 北京 京: starts already high, rises to the top -> tone 1 (on its own it would be tone 2)
  const glide = { ...base, start: 0, end: 2.3, rise: 2.4, change: 2.3, range: 2.6, minPos: 0, height: 0.9, startHeight: 0.7, endHeight: 1 };
  assert.equal(classifyIsolated(glide, true, { single: false, first: false }), 1);
  assert.equal(classifyIsolated(glide, true, { single: true }), 2);
  // 回家 回: low but rising -> tone 2; 北京 北: low and falling -> tone 3
  const lowRise = { ...base, rise: 1.3, fall: 0.5, change: 0.8, range: 1.4, minPos: 0.4, height: 0.2, startHeight: 0.1, endHeight: 0.2 };
  assert.equal(classifyIsolated(lowRise, true, { single: false, first: true }), 2);
  const lowFall = { ...lowRise, rise: 0, fall: 2.7, change: -2.7, minPos: 1 };
  assert.equal(classifyIsolated(lowFall, true, { single: false, first: true }), 3);
});

test('a level syllable said at a middle-low pitch is tone 1, never tone 3 (learner complaint: 妈 flat → "thanh 3")', () => {
  const flat = (height) => ({
    start: 0,
    end: 0,
    min: -0.2,
    change: 0,
    rise: 0.2,
    fall: 0.2,
    minPos: 0.5,
    range: 0.4,
    height,
    startHeight: height,
    endHeight: height,
    minHeight: height,
    voicedRatio: 1,
    frames: 30,
  });
  for (const h of [0.25, 0.3, 0.4, 0.6]) assert.equal(classifyIsolated(flat(h), true, { single: true }), 1, `height ${h}`);
  for (const h of [0.12, 0.2]) assert.notEqual(classifyIsolated(flat(h), true, { single: true }), 3, `height ${h}`);
  assert.equal(classifyIsolated(flat(0.05), true, { single: true }), 3);
  // inside a word the stricter split stays
  assert.equal(classifyIsolated(flat(0.3), true, { single: false, first: false }), 3);
});

test('a recording far from the learner profile is not judged against it and does not change it', async () => {
  const { updateProfile, voiceFits, profileRange } = await import('./tones.mjs');
  const female = Array.from({ length: 2000 }, (_, i) => 230 + (i % 60)); // ~230–290 Hz
  let profile = updateProfile(null, female, 260);
  assert.ok(voiceFits(profile, 250));
  assert.equal(voiceFits(profile, 120), false); // a male voice (or the other way round) does not fit
  const before = profile.frames;
  profile = updateProfile(profile, Array(200).fill(120), 120);
  assert.equal(profile.frames, before); // not added
  // four consistent mismatches: the profile was the wrong voice; start again from the new one
  for (let i = 0; i < 3; i++) profile = updateProfile(profile, Array(200).fill(120), 120);
  assert.ok(profile.frames <= 200);
  assert.ok(Math.abs(12 * Math.log2(120 / (profileRange({ ...profile, frames: Math.max(300, profile.frames) })?.median || 120))) < 1);
});
