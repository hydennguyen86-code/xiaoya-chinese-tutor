// Builds a labelled tone dataset from synthetic voices for tone/train.py.
// Nothing here is a recording of a person: macOS `say` voices and Edge TTS read
// isolated syllables, two-syllable HSK words and lesson sentences. The tone of
// every syllable is known from the text (pinyin-pro + the lesson neutral-tone
// policy), and syllable boundaries come from the same energy segmenter the app
// uses at scoring time (or Edge word boundaries, sub-split by that segmenter).
//
//   node eval/tone-train/make-dataset.mjs --out data/tone-train [--say] [--edge] [--limit-chars 120] [--limit-words 600] [--limit-sentences 300]
//
// Output: <out>/wav/*.wav (16 kHz mono) and <out>/manifest.jsonl, one row per
// utterance: { file, text, voice, source, kind, syllables: [{ char, tone, start, end, pos }] }
// where tone is 1–4, or 5 for a neutral tone, and start/end are seconds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { decodeToPcm, pitchTrack, segment, expectedTones } from '../../server/tones.mjs';
import { pcmWav } from '../../server/stt.mjs';
import { erhuaIndices, HAN } from '../../src/lib/coursePinyin.mjs';
import { readSentence, pauseAfter, hanOnly } from '../../server/listeningPinyin.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = path.resolve(opt('--out', 'data/tone-train'));
const useSay = args.includes('--say') || !args.includes('--edge');
const useEdge = args.includes('--edge') || !args.includes('--say');
const LIMIT_CHARS = Number(opt('--limit-chars', 120));
const LIMIT_WORDS = Number(opt('--limit-words', 600));
const LIMIT_SENTENCES = Number(opt('--limit-sentences', 300));
// classic voices understand [[slnc]] pauses, so a batch of items is read per call;
// the newer voices (Flo, Reed, Grandpa, Shelley…) ignore them and are read one item per call
const SAY_VOICES = (opt('--say-voices', 'Tingting,Meijia') || '').split(',').filter(Boolean);
const SAY_SINGLE_VOICES = (
  opt(
    '--say-single-voices',
    'Flo (Chinese (China mainland)),Reed (Chinese (China mainland)),Grandpa (Chinese (China mainland)),Shelley (Chinese (China mainland))',
  ) || ''
)
  .split(',')
  .filter(Boolean);
const SINGLE_WORDS = Number(opt('--single-words', 240));
const SINGLE_SENTENCES = Number(opt('--single-sentences', 100));
const SAY_RATES = [150, 190];
const EDGE_VOICES = [
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-YunjianNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunyangNeural',
  'zh-CN-XiaohanNeural',
];
const HOP_S = 0.01;

const manifestFile = path.join(OUT, 'manifest.jsonl');
let done = new Set();
let manifest = null;
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

function prepareOutput() {
  fs.mkdirSync(path.join(OUT, 'wav'), { recursive: true });
  if (args.includes('--relabel')) {
    // recompute every row's tones from its text (after a labelling fix); audio and boundaries stay
    const rows = fs
      .readFileSync(manifestFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    let changed = 0;
    let dropped = 0;
    const kept = [];
    for (const row of rows) {
      const tones = spokenTones(row.text);
      if (!tones || tones.length !== row.syllables.length) {
        dropped += 1;
        continue;
      }
      if (tones.some((t, i) => t.tone !== row.syllables[i].tone)) changed += 1;
      row.syllables = row.syllables.map((s, i) => ({ ...s, tone: tones[i].tone }));
      kept.push(row);
    }
    fs.writeFileSync(manifestFile, kept.map((row) => JSON.stringify(row)).join('\n') + (kept.length ? '\n' : ''));
    console.log(`relabelled ${manifestFile}: ${kept.length} rows kept, ${changed} changed, ${dropped} dropped`);
    process.exit(0);
  }
  done = new Set(
    fs.existsSync(manifestFile)
      ? fs
          .readFileSync(manifestFile, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line).file)
      : [],
  );
  manifest = fs.createWriteStream(manifestFile, { flags: 'a' });
}

/**
 * Tones as spoken: pinyin-pro readings with the lesson neutral-tone policy,
 * 一/不 sandhi, and 3-3 sandhi lowered left to right but never across a
 * punctuation pause (the same reading the listening drills teach).
 */
export function spokenTones(text) {
  const han = hanOnly(text);
  if (!han || erhuaIndices(han).size) return null; // 儿化 merges syllables; skip for training
  let read;
  try {
    read = readSentence(han, [], [], { allSandhi: true, pauses: pauseAfter(text) });
  } catch {
    return null;
  }
  const chars = [...han];
  if (read.tones.length !== chars.length) return null;
  const out = chars.map((char, i) => ({ char, tone: read.tones[i] }));
  return out.every((s) => s.tone >= 1 && s.tone <= 5) ? out : null;
}

function singleReading(ch) {
  return pinyin(ch, { multiple: true, type: 'array' }).length === 1;
}

const hsk = fs
  .readFileSync(path.join(ROOT, 'eval', 'hsk-standard.words.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

function pickChars() {
  const byTone = { 1: [], 2: [], 3: [], 4: [] };
  for (const row of hsk) {
    const w = [...row.w];
    if (w.length !== 1 || !HAN.test(w[0]) || !singleReading(w[0])) continue;
    const tone = Number(pinyin(w[0], { pattern: 'num' }));
    if (byTone[tone] && !byTone[tone].includes(w[0])) byTone[tone].push(w[0]);
  }
  return Object.entries(byTone).flatMap(([tone, list]) =>
    list.slice(0, LIMIT_CHARS).map((ch) => ({ text: ch, tones: [{ char: ch, tone: Number(tone) }] })),
  );
}

function pickWords() {
  const pairs = new Map();
  for (const row of hsk) {
    const w = [...row.w];
    if (w.length !== 2 || !w.every((ch) => HAN.test(ch))) continue;
    const spoken = spokenTones(row.w);
    if (!spoken || spoken.length !== 2) continue;
    // the HSK list marks neutral syllables by a missing tone mark: trust it over the policy
    const listed = row.py.split(/\s+/);
    if (listed.length === 2)
      listed.forEach((syl, i) => {
        if (!/[̀́̄̌]/.test(syl.normalize('NFD'))) spoken[i].tone = 5;
      });
    const key = spoken.map((s) => s.tone).join('');
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push({ text: row.w, tones: spoken });
  }
  const perPair = Math.max(8, Math.ceil(LIMIT_WORDS / pairs.size));
  return [...pairs.values()].flatMap((list) => list.slice(0, perPair));
}

function pickSentences() {
  const seen = new Set();
  const out = [];
  for (const file of fs.readdirSync(path.join(ROOT, 'lessons', 'courses')).filter((f) => f.endsWith('.json'))) {
    const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons', 'courses', file), 'utf8'));
    for (const item of [...(lesson.vocab || []), ...(lesson.patterns || [])]) {
      const text = item.example;
      if (!text || seen.has(text) || [...text].filter((c) => HAN.test(c)).length > 14) continue;
      const tones = spokenTones(text);
      if (!tones) continue;
      seen.add(text);
      out.push({ text, tones });
    }
  }
  // spread across lessons rather than taking the first files only
  const step = Math.max(1, Math.floor(out.length / LIMIT_SENTENCES));
  return out.filter((_, i) => i % step === 0).slice(0, LIMIT_SENTENCES);
}

// `say` is slow to start, so a batch of items is read in one call separated by
// long pauses, then cut apart at the silences. A batch whose silences do not
// come out as expected is dropped whole.
const SAY_PAUSE_MS = 900;
async function sayBatch(texts, voice, rate) {
  const file = path.join(os.tmpdir(), `tone-say-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  await run('say', [
    '-v',
    voice,
    '-r',
    String(rate),
    '-o',
    file,
    '--file-format=WAVE',
    '--data-format=LEI16@16000',
    texts.join(` [[slnc ${SAY_PAUSE_MS}]] `),
  ]);
  const audio = fs.readFileSync(file);
  fs.rmSync(file, { force: true });
  const pcm = await decodeToPcm(audio);
  const hop = 160;
  const rms = [];
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + hop; j += 1) sum += pcm[j] * pcm[j];
    rms.push(Math.sqrt(sum / hop));
  }
  const peak = Math.max(...rms);
  const active = rms.map((v) => v > peak * 0.02);
  const pieces = [];
  let start = -1;
  let quiet = 0;
  for (let i = 0; i < active.length; i += 1) {
    if (active[i]) {
      if (start < 0) start = i;
      quiet = 0;
    } else if (start >= 0) {
      quiet += 1;
      if (quiet >= 55) {
        pieces.push([start, i - quiet]);
        start = -1;
        quiet = 0;
      }
    }
  }
  if (start >= 0) pieces.push([start, active.length - 1]);
  if (pieces.length !== texts.length) return null;
  return pieces.map(([a, b]) => pcm.slice(Math.max(0, (a - 4) * hop), Math.min(pcm.length, (b + 6) * hop)));
}

async function sayAudio(text, voice, rate) {
  const file = path.join(os.tmpdir(), `tone-say-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  await run('say', ['-v', voice, '-r', String(rate), '-o', file, '--file-format=WAVE', '--data-format=LEI16@16000', text]);
  const audio = fs.readFileSync(file);
  fs.rmSync(file, { force: true });
  return { audio, words: null };
}

let edge = null;
async function edgeAudio(text, voice, rate) {
  edge ??= await import('../../server/tts.mjs');
  const result = await edge.synthesizeEdge(text, voice, rate);
  return { audio: Buffer.from(result.audioBase64, 'base64'), words: result.words };
}

/** syllable boundaries in seconds; Edge word boundaries bound the split when given */
function boundaries(pcm, chars, words) {
  const { f0, rms } = pitchTrack(pcm);
  const toSec = (frame) => Math.round(frame * HOP_S * 1000) / 1000;
  if (!words?.length) {
    const parts = segment(rms, f0, chars.length);
    return parts ? { parts: parts.map(([a, b]) => [toSec(a), toSec(b + 1)]), method: 'energy' } : null;
  }
  // map each Han character to its Edge word, then split multi-character words by energy
  const out = [];
  let ci = 0;
  for (const word of words) {
    const wordChars = [...word.text].filter((c) => HAN.test(c));
    if (!wordChars.length) continue;
    if (wordChars.join('') !== chars.slice(ci, ci + wordChars.length).join('')) return null;
    const lo = Math.max(0, Math.round(word.startMs / 10));
    const hi = Math.min(rms.length - 1, Math.round((word.startMs + word.durationMs) / 10));
    if (wordChars.length === 1) out.push([toSec(lo), toSec(hi + 1)]);
    else {
      const parts = segment(rms, f0, wordChars.length, lo, hi);
      if (!parts) return null;
      for (const [a, b] of parts) out.push([toSec(a), toSec(b + 1)]);
    }
    ci += wordChars.length;
  }
  return ci === chars.length ? { parts: out, method: 'edge-words+energy' } : null;
}

const pos = (i, n) => (n === 1 ? 'single' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'mid');
let written = 0;
let skipped = 0;

const slugFor = (source, voice, rate, kind, text) =>
  `wav/${source}-${voice.replace(/[^A-Za-z0-9]/g, '')}-${rate}-${kind}-${Buffer.from(text).toString('hex').slice(0, 40)}.wav`;

async function emitBatch(items, kind, voice, rate) {
  const pending = items.filter((item) => !done.has(slugFor('say', voice, rate, kind, item.text)));
  if (!pending.length) return;
  let pieces = null;
  try {
    pieces = await sayBatch(
      pending.map((item) => item.text),
      voice,
      rate,
    );
  } catch (error) {
    skipped += pending.length;
    console.warn(`[skip] say batch (${voice}): ${error.message}`);
    return;
  }
  if (!pieces) {
    skipped += pending.length;
    return;
  }
  for (let i = 0; i < pending.length; i += 1) await emit(pending[i], kind, voice, rate, null, 'say', pieces[i]);
}

async function emit({ text, tones }, kind, voice, rate, synth, source, decoded = null) {
  const file = slugFor(source, voice, rate, kind, text);
  if (done.has(file)) return;
  try {
    let pcm = decoded;
    let words = null;
    if (!pcm) {
      const result = await synth(text, voice, rate);
      words = result.words;
      pcm = await decodeToPcm(result.audio);
    }
    const found = boundaries(
      pcm,
      tones.map((t) => t.char),
      words,
    );
    if (!found) {
      skipped += 1;
      return;
    }
    fs.writeFileSync(path.join(OUT, file), pcmWav(pcm));
    const row = {
      file,
      text,
      voice,
      rate,
      source,
      kind,
      boundaryMethod: found.method,
      syllables: tones.map((t, i) => ({
        char: t.char,
        tone: t.tone,
        start: found.parts[i][0],
        end: found.parts[i][1],
        pos: pos(i, tones.length),
      })),
    };
    manifest.write(`${JSON.stringify(row)}\n`);
    done.add(file);
    written += 1;
    if (written % 100 === 0) console.log(`${written} utterances written, ${skipped} skipped`);
  } catch (error) {
    skipped += 1;
    if (skipped % 50 === 1) console.warn(`[skip] ${kind} ${text} (${voice}): ${error.message}`);
  }
}

async function pool(items, worker, size) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

if (isMain) {
  prepareOutput();
  const chars = pickChars();
  const words = pickWords();
  const sentences = pickSentences();
  console.log(`${chars.length} syllables · ${words.length} words · ${sentences.length} sentences`);

  if (useSay) {
    const batches = [];
    const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
    for (const voice of SAY_VOICES)
      for (const rate of SAY_RATES) {
        for (const items of chunk(chars, 16)) batches.push({ items, kind: 'char', voice, rate });
        for (const items of chunk(words, 12)) batches.push({ items, kind: 'word', voice, rate });
        if (rate === SAY_RATES[0]) for (const items of chunk(sentences, 5)) batches.push({ items, kind: 'sentence', voice, rate });
      }
    console.log(`say: ${batches.length} batches`);
    await pool(batches, (job) => emitBatch(job.items, job.kind, job.voice, job.rate), 3);
    const singles = [];
    const every = (list, n) => list.filter((_, i) => i % Math.max(1, Math.floor(list.length / n)) === 0).slice(0, n);
    for (const voice of SAY_SINGLE_VOICES) {
      for (const item of chars) singles.push({ item, kind: 'char', voice, rate: 160 });
      for (const item of every(words, SINGLE_WORDS)) singles.push({ item, kind: 'word', voice, rate: 160 });
      for (const item of every(sentences, SINGLE_SENTENCES)) singles.push({ item, kind: 'sentence', voice, rate: 160 });
    }
    console.log(`say (one item per call): ${singles.length} utterances`);
    await pool(singles, (job) => emit(job.item, job.kind, job.voice, job.rate, sayAudio, 'say'), 8);
  }
  if (useEdge) {
    const jobs = [];
    for (const voice of EDGE_VOICES) {
      for (const item of words) jobs.push({ item, kind: 'word', voice, rate: 1 });
      for (const item of sentences) jobs.push({ item, kind: 'sentence', voice, rate: 1 });
      for (const item of sentences.slice(0, Math.floor(sentences.length / 2))) jobs.push({ item, kind: 'sentence', voice, rate: 0.85 });
      for (const item of chars) jobs.push({ item, kind: 'char', voice, rate: 1 });
    }
    console.log(`edge: ${jobs.length} utterances`);
    await pool(jobs, (job) => emit(job.item, job.kind, job.voice, job.rate, edgeAudio, 'edge'), 3);
  }
  manifest.end();
  console.log(`done: ${written} written, ${skipped} skipped → ${manifestFile}`);
}
