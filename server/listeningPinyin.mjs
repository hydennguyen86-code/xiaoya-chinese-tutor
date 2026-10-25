// Adapted from supplied AI content utilities; validation only, never rewrites authored pinyin.
// Sinh pinyin cho một câu/đoạn chữ Hán, dùng chung cho các generator nội dung.
// Pinyin luôn lấy từ pinyin-pro theo cả câu (nên phân biệt được đa âm), rồi mới áp:
//   - thanh nhẹ cho từ từ điển ghi đọc nhẹ + hư từ cuối câu (theo người soạn)
//   - biến điệu 3+3: chế độ allSandhi hạ MỌI cặp thanh 3 liền nhau trong cùng cụm hơi,
//     nên pinyin xuất ra là dạng đọc thật (只好 → zhí hǎo); dấu câu chặn biến điệu.
// Biến điệu của 一 và 不 không cần tự áp: pinyin-pro đã trả dạng đọc thành tiếng.
// Dấu thanh xử lý theo mã Unicode (0x0300–0x036f) để không ghi ký tự tổ hợp trực tiếp trong nguồn.

import { pinyin } from 'pinyin-pro';
import { HAN, NEUTRAL_LEXICAL as NEUTRAL, NEUTRAL_SUFFIX, neutralPositions } from './coursePinyin.mjs';

export { HAN, NEUTRAL, NEUTRAL_SUFFIX };
export const PAUSE = new Set(['，', '。', '！', '？', '、', '；', '：', '…', '—', ',', '.', '!', '?', ';', ':']);

/** Vị trí chữ Hán (đếm từ 0) mà ngay sau nó là dấu câu → không biến điệu bắc qua. */
export function pauseAfter(text) {
  const out = new Set();
  let h = -1;
  for (const ch of text) {
    if (HAN.test(ch)) {
      h += 1;
    } else if (PAUSE.has(ch) && h >= 0) {
      out.add(h);
    }
  }
  return out;
}

const TONE_BY_CODE = { 0x0300: 4, 0x0301: 2, 0x0304: 1, 0x030c: 3 };
const CODE_BY_TONE = { 1: 0x0304, 2: 0x0301, 3: 0x030c, 4: 0x0300 };

const isCombining = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0x0300 && c <= 0x036f;
};

// Từ có hai thanh 3 đi liền NHƯNG thuộc cùng một từ → bắt buộc biến điệu 3+3 khi nói.
// Chỉ dùng ở chế độ mặc định; các generator nội dung mới dùng allSandhi=true.
export const SANDHI_33_WORDS = [
  '你好',
  '哪里',
  '很好',
  '很少',
  '好久',
  '老板',
  '法语',
  '缓解',
  '演讲',
  '管理',
  '所以',
  '只好',
  '有点',
  '早点',
  '往往',
  '处理',
  '水果',
  '雨伞',
  '保险',
  '洗澡',
  '小姐',
];

export const hanOnly = (s) => [...s].filter((c) => HAN.test(c)).join('');

/** nguyên âm mang dấu: a → o → e → quy tắc iu/ui → nguyên âm cuối */
function toneVowelIndex(letters) {
  const chars = [...letters.toLowerCase()];
  const isV = (c) => 'aeiouü'.includes(c);
  const pick = (want) => chars.findIndex((c) => c === want);
  for (const v of ['a', 'o', 'e']) {
    const i = pick(v);
    if (i >= 0) return i;
  }
  const joined = chars.join('');
  if (joined.includes('iu')) return chars.lastIndexOf('u');
  if (joined.includes('ui')) return chars.lastIndexOf('i');
  for (let i = chars.length - 1; i >= 0; i -= 1) if (isV(chars[i])) return i;
  return -1;
}

export function addToneMark(letters, tone) {
  const code = CODE_BY_TONE[tone];
  if (!code) return letters;
  const chars = [...letters.normalize('NFD')].filter((c) => !isCombining(c));
  const idx = toneVowelIndex(chars.map((c) => c.toLowerCase()).join(''));
  if (idx < 0 || idx >= chars.length) return letters;
  chars.splice(idx + 1, 0, String.fromCharCode(code));
  return chars.join('').normalize('NFC');
}

/** { letters: bỏ dấu thanh, giữ ü; tone: 1-4, 5 nếu không dấu } */
export function strip(s) {
  let tone = 0;
  let out = '';
  for (const ch of s.normalize('NFD')) {
    if (isCombining(ch)) {
      tone = TONE_BY_CODE[ch.charCodeAt(0)] || tone;
      continue;
    }
    out += ch;
  }
  return { letters: out.normalize('NFC').toLowerCase().replace(/v/g, 'ü'), tone: tone || 5 };
}

/**
 * Đọc một chuỗi chữ Hán.
 * @param {string} text chuỗi chữ Hán, không dấu câu
 * @param {number[]} sandhiAt vị trí bắt đầu cặp 3+3 được áp biến điệu (chế độ mặc định)
 * @param {number[]} extraNeutral vị trí đọc nhẹ do người soạn chỉ định
 * @param {{ allSandhi?: boolean, pauses?: Set<number> }} options
 *   allSandhi: hạ mọi cặp 3+3 liền nhau (trừ vị trí có pauses) → pinyin là dạng đọc thật
 *   pauses: vị trí chữ Hán cuối cụm hơi, lấy từ pauseAfter(text có dấu câu)
 */
export function readSentence(text, sandhiAt = [], extraNeutral = [], options = {}) {
  const { allSandhi = false, pauses = new Set() } = options;
  const chars = [...text];
  const parsed = pinyin(text, { pattern: 'tone', type: 'array' }).map(strip);
  const dict = parsed.map((p) => p.tone);

  const neutral = new Set([...neutralPositions(text), ...extraNeutral]);

  // "trích dẫn" = pinyin-pro + thanh nhẹ, CHƯA biến điệu 3+3
  const citation = [...dict];
  for (const i of neutral) if (i < citation.length) citation[i] = 5;

  const chosen = [...citation];
  const lowered = [];
  const canLower = (i) => !pauses.has(i) && chosen[i] === 3 && chosen[i + 1] === 3;
  if (allSandhi) {
    // 3-3-3 → 2-2-3: hạ từng cặp từ trái sang phải
    for (let i = 0; i + 1 < chosen.length; i += 1) {
      if (canLower(i)) {
        chosen[i] = 2;
        lowered.push(i);
      }
    }
  } else {
    const sandhiPos = new Set(sandhiAt);
    for (const w of SANDHI_33_WORDS) {
      let start = text.indexOf(w);
      while (start >= 0) {
        sandhiPos.add(start);
        start = text.indexOf(w, start + w.length);
      }
    }
    for (const i of sandhiPos) {
      if (canLower(i)) {
        chosen[i] = 2;
        lowered.push(i);
      }
    }
  }
  lowered.sort((a, b) => a - b);

  // dạng "hạ hết" dùng cho acceptTones (app chấp nhận khi người học đọc liền)
  const full = [...citation];
  for (let i = 0; i + 1 < full.length; i += 1) {
    if (!pauses.has(i) && full[i] === 3 && full[i + 1] === 3) full[i] = 2;
  }

  const renderTone = (t, p) => (t === 5 ? p.letters : addToneMark(p.letters, t));
  const render = (tones) => tones.map((t, i) => renderTone(t, parsed[i])).join(' ');
  return {
    pinyin: render(chosen),
    parts: chosen.map((t, i) => renderTone(t, parsed[i])),
    citationParts: citation.map((t, i) => renderTone(t, parsed[i])),
    tones: chosen,
    citation,
    full,
    dict,
    lowered,
    neutral: [...neutral].sort((a, b) => a - b),
    count: parsed.length,
  };
}

/** Tách đoạn thành cụm hơi theo dấu câu; offset tính theo chuỗi chỉ-chữ-Hán của cả đoạn. */
export function splitChunks(text) {
  const HARD = new Set(['。', '？', '！', '…']);
  const SOFT = new Set(['，', '、', '；', '：']);
  const chunks = [];
  let buf = '';
  let offset = 0;
  for (const ch of text) {
    if (HAN.test(ch)) {
      buf += ch;
      continue;
    }
    if (HARD.has(ch) || SOFT.has(ch)) {
      if (!buf) continue;
      chunks.push({ hanzi: buf, offset, pause: HARD.has(ch) ? 'hard' : 'soft' });
      offset += buf.length;
      buf = '';
    }
  }
  if (buf) chunks.push({ hanzi: buf, offset, pause: '' });
  return chunks;
}
