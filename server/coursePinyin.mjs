// Chính sách pinyin dùng chung cho học liệu trong lessons/courses/.
// Quy ước: pinyin từ vựng/câu ví dụ/transcript là dạng trích dẫn từ điển —
// giữ thanh gốc, chỉ bỏ dấu ở âm tiết đọc nhẹ; KHÔNG áp biến điệu 3+3.
// Biến điệu 一/不 vẫn giữ dạng đọc bề mặt do pinyin-pro trả về.
// Chi tiết và lý do: lessons/courses/policies/neutral-tone-policy.md.

import { pinyin } from 'pinyin-pro';

export const HAN = /\p{Script=Han}/u;

// Từ điển ghi âm tiết thứ hai (hoặc các vị trí liệt kê) là thanh nhẹ.
// Đây là nguồn duy nhất; mọi script kiểm tra phải import danh sách này.
import policy from '../lessons/courses/policies/neutral-tone-policy.json' with { type: 'json' };
export const NEUTRAL_LEXICAL = policy.lexicalNeutral;
export const NEUTRAL_SUFFIX = new Set(policy.suffixNeutral);

const isCombining = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0x0300 && c <= 0x036f;
};

function stripTone(s) {
  return [...s.normalize('NFD')]
    .filter((c) => !isCombining(c))
    .join('')
    .normalize('NFC');
}

/** Vị trí âm tiết Hán (đếm từ 0) cần đọc nhẹ. */
export function neutralPositions(text) {
  const chars = [...text];
  const hanPos = [];
  let h = -1;
  chars.forEach((c, i) => {
    if (HAN.test(c)) {
      h += 1;
      hanPos[i] = h;
    }
  });
  const neutral = new Set();
  for (const [word, idxs] of Object.entries(NEUTRAL_LEXICAL)) {
    let start = text.indexOf(word);
    while (start >= 0) {
      let k = 0;
      for (let i = start; i < start + word.length; i += 1) {
        if (HAN.test(chars[i])) {
          if (idxs.includes(k)) neutral.add(hanPos[i]);
          k += 1;
        }
      }
      start = text.indexOf(word, start + word.length);
    }
  }
  chars.forEach((c, i) => {
    if (HAN.test(c) && i > 0 && NEUTRAL_SUFFIX.has(c)) neutral.add(hanPos[i]);
  });
  return neutral;
}

/** Pinyin dạng trích dẫn: thanh từ điển, âm nhẹ không dấu, không biến điệu 3+3. */
export function pinyinCitation(text) {
  const toks = pinyin(text, { pattern: 'tone', type: 'array' });
  const chars = [...text];
  if (toks.length !== chars.length) {
    throw new Error(`pinyin-pro lệch số token: ${text}`);
  }
  const neutral = neutralPositions(text);
  let h = -1;
  return chars
    .map((c, i) => {
      if (!HAN.test(c)) return toks[i];
      h += 1;
      return neutral.has(h) ? stripTone(toks[i]) : toks[i];
    })
    .join(' ');
}

/** Pinyin của một từ/âm tiết đơn lẻ, cùng quy ước trích dẫn. */
export function pinyinWord(word) {
  return pinyinCitation(word);
}
