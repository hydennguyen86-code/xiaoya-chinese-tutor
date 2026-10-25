import { compareDictation } from './listeningCorpus.ts';
export interface DictationItem {
  id: string;
  level: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  focus?: string[];
  baseTones?: number[];
  acceptTones?: number[][];
  uncertain?: boolean;
}
export function syllable(value: string) {
  const marks: Record<string, number> = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
  let tone = Number(value.match(/[1-5]$/)?.[0] || 0);
  const plain = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0304\u030c]/g, (m) => {
      tone = marks[m];
      return '';
    })
    .normalize('NFC')
    .replace(/[1-5]/g, '')
    .replace(/ü/g, 'v');
  return { plain, tone };
}
export function gradeDictation(item: DictationItem, answer: string) {
  const expected = item.pinyin
    .trim()
    .split(/\s+/)
    .filter((s) => /\p{Script=Latin}/u.test(s))
    .map(syllable);
  const plainAnswer = /\p{Script=Han}/u.test(answer)
    ? answer
    : answer
        .trim()
        .split(/\s+/)
        .map((s) => syllable(s).plain)
        .join(' ');
  const parts = compareDictation(
    item.hanzi,
    plainAnswer,
    expected.map((s) => s.plain),
  );
  if (/\p{Script=Han}/u.test(answer)) return { parts, tonesCorrect: true, correct: parts.every((p) => p.ok) };
  const actual = answer.trim().split(/\s+/).map(syllable);
  const variants = item.acceptTones?.length ? item.acceptTones : [expected.map((s) => s.tone || 5)];
  const tonesCorrect = variants.some((v) => actual.length === v.length && actual.every((s, i) => !s.tone || s.tone === v[i]));
  return { parts, tonesCorrect, correct: parts.every((p) => p.ok) && tonesCorrect };
}

export interface ShadowingItem {
  id: string;
  level: string;
  text: string;
  pinyin: string;
  meaningVi: string;
  syllables: number;
  pace: string;
  chunks: Array<{ hanzi: string; pinyin: string; pause: string }>;
  focus: string[];
  uncertain?: boolean;
  baseTones?: number[];
  acceptTones?: number[][];
}
