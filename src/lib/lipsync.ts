import { pinyin } from 'pinyin-pro';
import type { TtsWord } from '../types';

const HAN = /\p{Script=Han}/u;

const INITIAL_VISEME: Record<string, string> = {
  b: 'PP',
  p: 'PP',
  m: 'PP',
  f: 'FF',
  d: 'DD',
  t: 'DD',
  n: 'nn',
  l: 'RR',
  g: 'kk',
  k: 'kk',
  h: 'kk',
  j: 'CH',
  q: 'CH',
  x: 'CH',
  zh: 'CH',
  ch: 'CH',
  sh: 'CH',
  r: 'RR',
  z: 'SS',
  c: 'SS',
  s: 'SS',
};

const FINAL_VISEME: Record<string, string> = {
  a: 'aa',
  ai: 'aa',
  an: 'aa',
  ang: 'aa',
  ao: 'aa',
  ia: 'aa',
  ian: 'aa',
  iang: 'aa',
  iao: 'aa',
  ua: 'aa',
  uai: 'aa',
  uan: 'aa',
  uang: 'aa',
  e: 'E',
  ei: 'E',
  en: 'E',
  eng: 'E',
  er: 'E',
  ie: 'E',
  üe: 'Y',
  i: 'I',
  in: 'I',
  ing: 'I',
  iu: 'I',
  o: 'O',
  ong: 'O',
  ou: 'O',
  uo: 'O',
  iong: 'O',
  u: 'U',
  ü: 'Y',
  un: 'U',
  ui: 'U',
  üan: 'Y',
  ün: 'Y',
};

interface VisemeEvent {
  viseme: string;
  time: number;
  duration: number;
}

interface Unit {
  text: string;
  startMs: number;
  durationMs: number;
}

function finalToViseme(final: string) {
  if (!final) return 'aa';
  if (FINAL_VISEME[final]) return FINAL_VISEME[final];
  if (final.includes('a')) return 'aa';
  if (final.includes('o')) return 'O';
  if (final.includes('e')) return 'E';
  if (final.includes('i')) return 'I';
  if (final.includes('ü') || final.includes('v')) return 'Y';
  if (final.includes('u')) return 'U';
  return 'aa';
}

function latinToViseme(text: string) {
  const lower = text.toLowerCase();
  if (/[aeiou]/.test(lower)) {
    if (lower.includes('a')) return 'aa';
    if (lower.includes('e')) return 'E';
    if (lower.includes('i')) return 'I';
    if (lower.includes('o')) return 'O';
    return 'U';
  }
  return 'aa';
}

function addWordVisemes(events: VisemeEvent[], word: TtsWord) {
  const chars = Array.from(word.text);
  const hanChars = chars.filter((ch) => HAN.test(ch));
  const t0 = Math.max(0, word.startMs);
  const wordDuration = Math.max(60, word.durationMs);

  if (hanChars.length === 0) {
    if (/[a-zA-Z]/.test(word.text)) {
      events.push({
        viseme: latinToViseme(word.text),
        time: t0,
        duration: wordDuration,
      });
    }
    return;
  }

  const slice = wordDuration / hanChars.length;
  let index = 0;

  for (const ch of chars) {
    if (!HAN.test(ch)) continue;
    const time = t0 + index * slice;
    index += 1;

    let initial = '';
    let final = '';
    try {
      initial = pinyin(ch, { pattern: 'initial', toneType: 'none' });
      final = pinyin(ch, { pattern: 'final', toneType: 'none' });
    } catch {
      initial = '';
      final = '';
    }

    // pinyin-pro writes yu/yue/yun/yuan with a plain u, although these
    // syllables have the front rounded vowel ü. Apical -i after retroflex
    // and dental initials is also different from the spread vowel in yi.
    const apicalI = final === 'i' && /^(zh|ch|sh|r|z|c|s)$/.test(initial);
    const frontRounded = initial === 'y' && /^(u|ue|un|uan)$/.test(final);
    if (initial === 'y' || initial === 'w') initial = '';
    const initialViseme = INITIAL_VISEME[initial];
    const vowelViseme = apicalI
      ? (initialViseme ?? 'SS')
      : frontRounded ? 'Y' : finalToViseme(final);

    if (!initialViseme || slice < 95) {
      events.push({
        viseme: vowelViseme,
        time,
        duration: Math.max(50, Math.min(slice, 260)),
      });
      continue;
    }

    const initialDuration = Math.min(80, Math.max(35, slice * 0.3));
    const vowelDuration = Math.max(45, slice - initialDuration - 12);

    events.push({ viseme: initialViseme, time, duration: initialDuration });
    events.push({
      viseme: vowelViseme,
      time: time + initialDuration,
      duration: vowelDuration,
    });
  }
}

function approximateUnits(text: string, durationMs: number): Unit[] {
  const units: { text: string; weight: number }[] = [];
  let latin = '';

  const flushLatin = () => {
    if (!latin) return;
    units.push({ text: latin, weight: Math.max(1, Math.min(4, Math.ceil(latin.length / 3))) });
    latin = '';
  };

  for (const ch of Array.from(text)) {
    if (HAN.test(ch)) {
      flushLatin();
      units.push({ text: ch, weight: 1 });
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      latin += ch;
    } else {
      flushLatin();
    }
  }
  flushLatin();

  if (!units.length) {
    const clean = text.trim();
    if (!clean) return [];
    units.push({ text: clean, weight: 1 });
  }

  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
  const start = Math.min(120, durationMs * 0.15);
  const available = Math.max(180, durationMs * 0.9 - start);
  let cursor = start;

  return units.map((unit) => {
    const slice = (unit.weight / totalWeight) * available;
    const item = {
      text: unit.text,
      startMs: Math.round(cursor),
      durationMs: Math.round(slice),
    };
    cursor += slice;
    return item;
  });
}

export interface SpeechTimeline {
  words: string[];
  wtimes: number[];
  wdurations: number[];
  visemes: string[];
  vtimes: number[];
  vdurations: number[];
}

export function buildSpeechTimeline(
  text: string,
  words: TtsWord[],
  audioDurationMs: number,
): SpeechTimeline {
  const durationMs = Math.max(300, audioDurationMs || 0);
  const units: Unit[] =
    words.length > 0
      ? words.map((word) => ({
          text: word.text,
          startMs: word.startMs,
          durationMs: word.durationMs,
        }))
      : approximateUnits(text, durationMs);

  const events: VisemeEvent[] = [];
  for (const unit of units) {
    addWordVisemes(events, unit);
  }
  events.sort((a, b) => a.time - b.time);

  const visemes: string[] = [];
  const vtimes: number[] = [];
  const vdurations: number[] = [];

  const pushViseme = (viseme: string, time: number, duration: number) => {
    if (!Number.isFinite(time) || !Number.isFinite(duration)) return;
    const safeTime = Math.max(0, Math.round(time));
    const safeDuration = Math.max(40, Math.round(duration));
    if (safeTime >= durationMs) return;
    visemes.push(viseme);
    vtimes.push(safeTime);
    vdurations.push(Math.min(safeDuration, durationMs - safeTime));
  };

  let previousEnd = 0;
  for (const event of events) {
    const gap = event.time - previousEnd;
    if (gap > 190) {
      const silenceStart = previousEnd + Math.min(70, gap * 0.35);
      const silenceDuration = Math.min(220, gap - 80);
      if (silenceDuration > 50) {
        pushViseme('sil', silenceStart, silenceDuration);
      }
    }
    pushViseme(event.viseme, event.time, event.duration);
    previousEnd = Math.max(previousEnd, event.time + event.duration);
  }

  if (durationMs - previousEnd > 150) {
    pushViseme('sil', previousEnd + 40, Math.min(300, durationMs - previousEnd - 40));
  }

  return {
    words: units.map((unit) => unit.text),
    wtimes: units.map((unit) => Math.max(0, Math.round(unit.startMs))),
    wdurations: units.map((unit) => Math.max(40, Math.round(unit.durationMs))),
    visemes,
    vtimes,
    vdurations,
  };
}
