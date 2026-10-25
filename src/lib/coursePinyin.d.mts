export const HAN: RegExp;
export const NEUTRAL_LEXICAL: Record<string, number[]>;
export const NEUTRAL_SUFFIX: Set<string>;
export function neutralPositions(text: string): Set<number>;
export function pinyinCitation(text: string): string;
export function pinyinWord(text: string): string;
