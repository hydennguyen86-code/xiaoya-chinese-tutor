import data from '../data/hanviet-unihan.json' with { type: 'json' };
import bank from '../../lessons/listening/hanviet-traps.json' with { type: 'json' };
const readings: Record<string, string[]> = data.readings;
const via: Record<string, string[]> = data.via;
export const HANVIET_SOURCE = { version: data.version, property: data.property, url: data.source };
export function hanVietParts(word: string) {
  return [...word].filter((c) => /\p{Script=Han}/u.test(c)).map((char) => ({ char, readings: readings[char] || [], via: via[char] || [] }));
}
export function hanVietText(word: string) {
  return hanVietParts(word)
    .map((p) =>
      p.readings.length === 0 ? `${p.char}(chưa có dữ liệu)` : p.readings.length === 1 ? p.readings[0] : `[${p.readings.join(' / ')}]`,
    )
    .join(' ');
}
export function wordTraps(word: string) {
  return bank.items.filter((t) => t.hanzi === word || (t.trap !== 'nghĩa' && [...t.hanzi].length === 1 && word.includes(t.hanzi)));
}
export const hanVietBank = bank;
