import authored from '../data/hanviet-authored.json' with { type: 'json' };
import data from '../data/hanviet-unihan.json' with { type: 'json' };
import bank from '../../lessons/listening/hanviet-traps.json' with { type: 'json' };

const authoredReadings = new Map<string, string[]>(authored.entries.map((entry) => [entry.char, entry.readings]));
const readings: Record<string, string[]> = data.readings;
const via: Record<string, string[]> = data.via;
export const HANVIET_SOURCE = { version: data.version, property: data.property, url: data.source };
export const HANVIET_AUTHORED_SOURCE = authored.source;

export function hanVietParts(word: string) {
  return [...word]
    .filter((c) => /\p{Script=Han}/u.test(c))
    .map((char) => {
      const authored = authoredReadings.get(char) || [];
      const unihan = readings[char] || [];
      return {
        char,
        readings: authored.length ? authored : unihan,
        via: via[char] || [],
        source: authored.length ? ('authored' as const) : unihan.length ? ('unihan' as const) : ('missing' as const),
      };
    });
}

export function hanVietText(word: string) {
  return hanVietParts(word)
    .filter((p) => p.readings.length > 0)
    .map((p) => (p.source === 'authored' ? p.readings[0] : p.readings.length === 1 ? p.readings[0] : `[${p.readings.join(' / ')}]`))
    .join(' ');
}

export function wordTraps(word: string) {
  return bank.items.filter((t) => t.hanzi === word);
}
export const hanVietBank = bank;
