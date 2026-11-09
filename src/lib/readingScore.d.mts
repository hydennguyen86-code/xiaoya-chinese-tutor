export interface ReadingSyllable {
  char: string;
  pinyin: string;
  base: string;
  tone: 0 | 1 | 2 | 3 | 4;
  erhua?: boolean;
}
export type SyllableStatus = 'match' | 'tone' | 'near' | 'wrong' | 'missing';
export interface NearConfusion {
  kind: 'initial' | 'final';
  from: string;
  to: string;
}
export interface AlignedSyllable {
  target: ReadingSyllable;
  status: SyllableStatus;
  heard?: ReadingSyllable;
  near?: NearConfusion;
  toneDiff?: boolean;
}
export interface ReadingScore {
  syllables: AlignedSyllable[];
  extra: ReadingSyllable[];
  matched: number;
  total: number;
  score: number;
  ok: boolean;
  summary: string;
}
export function syllablesOf(text: string): ReadingSyllable[];
export function nearConfusion(targetBase: string, heardBase: string): NearConfusion | null;
export function alignSyllables(
  targetSyls: ReadingSyllable[],
  heardSyls: ReadingSyllable[],
): { syllables: AlignedSyllable[]; extra: ReadingSyllable[] };
export function scoreReading(target: string, heardText: string): ReadingScore;
export function containsReading(target: string, heardText: string): ReadingScore;
export function normalizeHeard(target: string, heardText: string, opts?: { within?: boolean }): string;
export function readingOk(target: string, heardText: string, opts?: { within?: boolean }): boolean;
export function toneLabel(text: string): string;
