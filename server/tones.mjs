import { energyTiming } from './audioTiming.mjs';
import { mediaToolPath } from './mediaTools.mjs';
import { spawn } from 'node:child_process';
import { pinyin } from 'pinyin-pro';

// Tone feedback for a sentence the learner read aloud. Everything runs on this
// computer: ffmpeg decodes the recording, YIN tracks the pitch, the utterance
// is split into as many syllables as the target text has characters, and each
// syllable's pitch shape is classified as tone 1–4. When the shape is not clear
// the syllable is reported as "unclear" rather than guessed.

const SR = 16000;
const HOP = 160; // 10 ms
const FRAME = 800; // 50 ms
const HAN = /\p{Script=Han}/u;

export function decodeToPcm(buffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn(mediaToolPath('ffmpeg'), [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-ac',
      '1',
      '-ar',
      String(SR),
      '-f',
      'f32le',
      'pipe:1',
    ]);
    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffmpeg không đọc được âm thanh.'));
      const all = Buffer.concat(chunks);
      resolve(new Float32Array(all.buffer, all.byteOffset, Math.floor(all.length / 4)));
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(buffer);
  });
}

// ---- pitch: YIN (de Cheveigné & Kawahara 2002) ----
function yin(frame, fmin = 70, fmax = 500, threshold = 0.2) {
  const tauMin = Math.floor(SR / fmax);
  const tauMax = Math.floor(SR / fmin);
  const W = frame.length - tauMax;
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0;
    for (let j = 0; j < W; j += 1) {
      const diff = frame[j] - frame[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  let running = 0;
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  for (let tau = 1; tau <= tauMax; tau += 1) {
    running += d[tau];
    cmnd[tau] = running ? (d[tau] * tau) / running : 1;
  }
  for (let tau = tauMin; tau < tauMax; tau += 1) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      const a = cmnd[tau - 1];
      const b = cmnd[tau];
      const c = cmnd[tau + 1];
      const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
      return SR / (tau + (Number.isFinite(shift) ? shift : 0));
    }
  }
  let best = tauMin;
  for (let tau = tauMin; tau < tauMax; tau += 1) if (cmnd[tau] < cmnd[best]) best = tau;
  return cmnd[best] < 0.35 ? SR / best : 0;
}

export function pitchTrack(samples) {
  const f0 = [];
  const rms = [];
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    const frame = samples.subarray(start, start + FRAME);
    let sum = 0;
    for (const v of frame) sum += v * v;
    const energy = Math.sqrt(sum / FRAME);
    rms.push(energy);
    f0.push(energy > 0.005 ? yin(frame) : 0);
  }
  const peak = Math.max(...rms, 1e-9);
  // unvoice quiet frames, then a 5-frame median filter and an octave-jump guard
  const voiced = f0.map((v, i) => (rms[i] > peak * 0.08 ? v : 0));
  const smooth = voiced.map((v, i) => {
    if (!v) return 0;
    const win = voiced
      .slice(Math.max(0, i - 2), i + 3)
      .filter(Boolean)
      .sort((x, y) => x - y);
    return win[Math.floor(win.length / 2)];
  });
  const sorted = smooth.filter(Boolean).sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const cleaned = smooth.map((v) => (v && median && Math.abs(Math.log2(v / median)) < 0.75 ? v : 0));
  return { f0: cleaned, rms, peak, median };
}

// ---- split the speech span into n syllables (low-energy boundaries, even lengths) ----
export function segment(rms, f0, n, lo = 0, hi = rms.length - 1) {
  const peakAll = Math.max(...rms);
  let first = -1;
  let last = -1;
  for (let i = lo; i <= hi; i += 1) {
    if (rms[i] > peakAll * 0.08) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (lo > 0 || hi < rms.length - 1) {
    // inside a word given by the recogniser: trust its boundaries
    first = lo;
    last = hi;
  }
  if (first < 0 || last - first < n * 3) return null;
  const T = last - first + 1;
  const mean = T / n;
  const minLen = Math.max(2, Math.floor(mean * 0.35));
  const peak = Math.max(...rms);
  const env = rms.slice(first, last + 1).map((v, i, arr) => {
    const win = arr.slice(Math.max(0, i - 2), i + 3);
    return win.reduce((a, b) => a + b, 0) / win.length / peak;
  });
  const boundaryCost = (t) => env[t] + (f0[first + t] ? 0.25 : 0);
  // a fairly strong pull towards equal syllable lengths: in connected speech the
  // energy dip between syllables is often missing (汉语, 电脑), and a weak prior
  // let the boundary slide into the first syllable
  const segCost = (len) => 1.5 * ((len - mean) / mean) ** 2;
  // dp[k][t]: best cost with the k-th boundary at t (boundary 0 is the start)
  const INF = 1e18;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(T + 1).fill(INF));
  const from = Array.from({ length: n + 1 }, () => new Int32Array(T + 1).fill(-1));
  dp[0][0] = 0;
  for (let k = 1; k <= n; k += 1) {
    for (let t = k * minLen; t <= T; t += 1) {
      const end = k === n ? T : t;
      if (k === n && t !== T) continue;
      for (let s = n > 2 ? Math.max((k - 1) * minLen, end - Math.ceil(mean * 3)) : (k - 1) * minLen; s <= end - minLen; s += 1) {
        if (dp[k - 1][s] >= INF) continue;
        const cost = dp[k - 1][s] + segCost(end - s) + (k < n ? boundaryCost(Math.min(end, T - 1)) : 0);
        if (cost < dp[k][end]) {
          dp[k][end] = cost;
          from[k][end] = s;
        }
      }
    }
  }
  if (dp[n][T] >= INF) return null;
  const cuts = [T];
  for (let k = n, t = T; k > 0; k -= 1) {
    t = from[k][t];
    cuts.unshift(t);
  }
  return cuts.slice(0, -1).map((s, i) => [first + s, first + cuts[i + 1]]);
}

// ---- classify one syllable's pitch shape ----
const semis = (hz, ref) => 12 * Math.log2(hz / ref);

// ---- a speaker's pitch range, accumulated over everything they record ----
// histogram of voiced frames in half-semitone bins above 50 Hz
const BIN_HZ = 50;
const BINS = 96; // 50 Hz .. ~800 Hz
const toBin = (hz) => Math.max(0, Math.min(BINS - 1, Math.round(24 * Math.log2(hz / BIN_HZ))));
const fromBin = (bin) => BIN_HZ * 2 ** (bin / 24);

export function emptyProfile() {
  return { version: 1, frames: 0, hist: new Array(BINS).fill(0) };
}

export function addToProfile(profile, f0) {
  const next = profile?.version === 1 && Array.isArray(profile.hist) ? { ...profile, hist: [...profile.hist] } : emptyProfile();
  for (const v of f0) {
    if (!v) continue;
    next.hist[toBin(v)] += 1;
    next.frames += 1;
  }
  // keep it adaptive: halve old counts once it is large
  if (next.frames > 20000) {
    next.hist = next.hist.map((c) => Math.floor(c / 2));
    next.frames = next.hist.reduce((a, b) => a + b, 0);
  }
  return next;
}

/** p10 / median / p90 in Hz, or null until there is enough speech (≈3 s voiced). */
export function profileRange(profile) {
  if (!profile || profile.frames < 300) return null;
  const at = (p) => {
    let acc = 0;
    for (let i = 0; i < BINS; i += 1) {
      acc += profile.hist[i];
      if (acc >= p * profile.frames) return fromBin(i);
    }
    return fromBin(BINS - 1);
  };
  return { low: at(0.1), median: at(0.5), high: at(0.9) };
}

// ---- features of one syllable ----
/**
 * `values` are semitones relative to `ref` (Hz) for each frame of the
 * syllable from voicing onset, 0-frames (unvoiced) included as null.
 * `low`/`high` are the speaker's range in the same semitone scale.
 */
export function toneFeatures(frames, low, high) {
  const firstVoiced = frames.findIndex((v) => v !== null);
  if (firstVoiced < 0) return null;
  const tail = frames.slice(firstVoiced);
  const values = tail.filter((v) => v !== null);
  if (values.length < 4) return null;
  const k = Math.max(1, Math.round(values.length * 0.2));
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const start = avg(values.slice(0, k));
  const end = avg(values.slice(-k));
  let minIdx = 0;
  values.forEach((v, i) => {
    if (v < values[minIdx]) minIdx = i;
  });
  const min = values[minIdx];
  const max = Math.max(...values);
  const span = Math.max(high - low, 4);
  return {
    start,
    end,
    min,
    change: end - start,
    rise: end - min,
    fall: start - min,
    minPos: minIdx / Math.max(1, values.length - 1),
    range: max - min,
    height: (avg(values) - low) / span,
    startHeight: (start - low) / span,
    endHeight: (end - low) / span,
    minHeight: (min - low) / span,
    voicedRatio: values.length / tail.length,
    frames: values.length,
  };
}

/**
 * Tone of an isolated word syllable from its shape and, when the speaker's
 * range is known, its height. 0 when it cannot be told apart.
 */
export function classifyIsolated(f, knownRange, { single = true, first = false } = {}) {
  if (!f) return 0;
  if (f.fall >= 4 && f.minPos >= 0.6 && (!knownRange || f.startHeight >= 0.45)) return 4;
  // a dip (falls first, lowest point mid-syllable, then rises) is tone 3;
  // tone 2 starts at or near its lowest point, or ends well above where it began.
  // Only for a syllable said on its own: inside a word, the move from the
  // previous syllable makes tone 2 dip as well.
  if (single && f.fall >= 0.8 && f.rise >= 1.5 && f.minPos >= 0.35 && f.minPos <= 0.9 && f.change <= 2.5) return 3;
  if (!single && !first && knownRange) {
    // inside a word, tone 1 after another syllable glides up into its high level:
    // it already starts in the upper range and ends at the top
    if (f.rise >= 2 && f.minPos <= 0.3 && f.fall < 1 && f.startHeight >= 0.6 && f.endHeight >= 0.85) return 1;
  }
  if (!single && first && knownRange) {
    // a low first syllable that still rises is tone 2; a low half-third (tone 3
    // before another tone) falls or stays level
    if (f.height <= 0.35 && f.change >= 0.3 && f.rise >= 0.6 && f.fall <= f.rise) return 2;
  }
  if (f.rise >= 2 && f.minPos <= 0.75 && f.end > f.start + 0.5) return 2;
  const creaky = f.voicedRatio < 0.8;
  if (f.range <= 2.5 && !creaky) {
    if (!knownRange) return 0; // flat: tone 1 (high) and tone 3 (low) differ only in height
    if (f.height >= 0.5) return 1;
    if (f.height <= 0.35) return 3;
    return 0;
  }
  // creak usually means a low tone 3, but a short, high, creaky syllable is a
  // Vietnamese-style clipped tone 4 or 1 (爸 费 骂 read like thanh nặng): too
  // little pitch to tell which, so leave it unjudged rather than call it 3
  if (creaky && knownRange && f.height > 0.5) return 0;
  if (creaky || (knownRange && f.height <= 0.35)) return 3;
  if (f.fall >= 4) return 4;
  return 0;
}

/** Expected tone per Han character, with 一/不 and 3-3 sandhi applied. */
export function expectedTones(text) {
  const chars = [...text].filter((ch) => HAN.test(ch));
  const tones = pinyin(chars.join(''), { pattern: 'num', type: 'array' }).map((t) => Number(t) || 0);
  const marks = pinyin(chars.join(''), { type: 'array' });
  for (let i = tones.length - 2; i >= 0; i -= 1) {
    if (tones[i] === 3 && tones[i + 1] === 3) tones[i] = 2;
  }
  return chars.map((char, i) => ({ char, pinyin: marks[i], expected: tones[i] }));
}

/** Fold a recording's voiced frames into a speaker's pitch profile. */
export async function profileFromAudio(audio, profile, pcm = null) {
  const { f0 } = pitchTrack(pcm ?? (await decodeToPcm(audio)));
  return addToProfile(profile, f0);
}

/** Downsampled pitch curve (semitones re the speaker median) of the voiced speech. */
function contour(f0, median, points = 60) {
  const voicedIdx = f0.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!voicedIdx.length) return [];
  const a = 0;
  const b = f0.length - 1;
  const out = [];
  for (let p = 0; p < points; p += 1) {
    const i = Math.round(a + ((b - a) * p) / (points - 1));
    out.push(f0[i] ? Math.round(semis(f0[i], median) * 10) / 10 : null);
  }
  return out;
}

/**
 * Analyse a recording of `target`.
 * - Words of 1–2 syllables get a tone verdict per syllable.
 * - Longer sentences get the learner's pitch curve for visual comparison with
 *   a model reading (connected-speech tones are too context-dependent to grade
 *   reliably with a rule-based checker; see eval/tones.mjs).
 * `profile` is the speaker's accumulated pitch histogram (or null); the
 * updated profile is returned so the caller can store it.
 */
export async function analyseTones(audio, target, { profile = null, debug = false, pcm: decoded = null } = {}) {
  const syllables = expectedTones(target);
  const pcm = decoded ?? (await decodeToPcm(audio));
  const { f0, rms, median } = pitchTrack(pcm);
  const nextProfile = addToProfile(profile, f0);
  const base = { syllables: syllables.map((s) => ({ ...s, heard: 0, ok: null })), checked: 0, correct: 0, profile: nextProfile };
  if (!syllables.length) return { ...base, note: 'Không có chữ Hán để chấm.' };
  if (!median) return { ...base, note: 'Không nghe rõ giọng. Đọc to, rõ và chậm hơn nhé.' };

  const parts = segment(rms, f0, syllables.length);
  const duration = pcm.length / SR;
  const segments = (parts || []).map(([a, b], index) => ({
    char: syllables[index].char,
    start: (a * HOP) / SR,
    end: Math.min(duration, (b * HOP) / SR),
  }));
  Object.assign(base, { timing: energyTiming(pcm), duration, segments, curve: contour(f0, median), boundaryMethod: 'energy-estimate' });
  if (syllables.length > 2) {
    return { ...base, mode: 'sentence', curve: contour(f0, median) };
  }

  const range = profileRange(nextProfile);
  const ref = range ? range.median : median;
  const low = range ? semis(range.low, ref) : -3;
  const high = range ? semis(range.high, ref) : 3;
  if (!parts) return { ...base, mode: 'word', note: 'Không đủ âm thanh để chấm. Đọc to, rõ hơn nhé.' };
  const result = syllables.map((s, i) => {
    const [a, b] = parts[i];
    const frames = f0.slice(a, b + 1).map((v) => (v ? semis(v, ref) : null));
    const features = toneFeatures(frames, low, high);
    const single = syllables.length === 1;
    const heard = s.expected ? classifyIsolated(features, Boolean(range), { single, first: i === 0 }) : 0;
    // A mismatch is only a failure when the measurement can actually support it:
    // before the speaker's pitch range is learned, on a short or creaky syllable,
    // and for the 2/3 pair inside a word (where the previous syllable drags the
    // pitch, and even reference speech is misread), report "not judged" instead.
    const sure = !heard || heard === s.expected || (Boolean(range) && features && features.frames >= 6 && features.voicedRatio >= 0.8);
    const confusable = !single && s.expected === 2 && heard === 3;
    const ok = s.expected && heard ? (heard === s.expected ? true : sure && !confusable ? false : null) : null;
    return { ...s, heard, ok, ...(debug ? { features } : {}) };
  });
  const scored = result.filter((s) => s.ok !== null);
  return {
    ...base,
    mode: 'word',
    syllables: result,
    checked: scored.length,
    correct: scored.filter((s) => s.ok).length,
    ...(range ? {} : { note: 'Mình chưa quen giọng bạn: nói thêm vài câu để mình phân biệt thanh 1 và thanh 3 chính xác hơn.' }),
  };
}
