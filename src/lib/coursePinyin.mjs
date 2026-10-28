// Chính sách pinyin dùng chung cho học liệu trong lessons/courses/.
// Quy ước: pinyin từ vựng/câu ví dụ/transcript là dạng trích dẫn từ điển —
// giữ thanh gốc, chỉ bỏ dấu ở âm tiết đọc nhẹ; KHÔNG áp biến điệu 3+3.
// Biến điệu 一/不 vẫn giữ dạng đọc bề mặt do pinyin-pro trả về.
// Chi tiết và lý do: lessons/courses/policies/neutral-tone-policy.md.

import { pinyin } from 'pinyin-pro';

export const HAN = /\p{Script=Han}/u;

// 儿 hoá "r" khi đi sau các chữ này (哪儿 → nǎr, 一点儿 → yì diǎnr): một âm tiết,
// không phải hai. Bảng đóng cho học liệu hiện tại; 儿子/女儿/儿科 giữ 儿 riêng
// (ér) vì không nằm trong bảng. Áp dụng cho cả pinyinCitation lẫn readSentence
// và bộ chấm thanh (expectedTones) để hiển thị và chấm không lệch nhau.
export const ERHUA = new Set(['点儿', '这儿', '哪儿', '那儿', '会儿', '事儿']);

/** Vị trí (đếm theo ký tự) của chữ 儿 hoá "r" trong chuỗi. */
export function erhuaIndices(text) {
  const chars = [...text];
  const out = new Set();
  for (let i = 1; i < chars.length; i += 1) {
    if (chars[i] === '儿' && ERHUA.has(chars[i - 1] + chars[i])) out.add(i);
  }
  return out;
}

/** Số âm tiết Hán sau khi gộp 儿 hoá (mỗi chữ Hán một âm tiết, trừ 儿 hoá). */
export function syllableCount(text) {
  return [...text].filter((c) => HAN.test(c)).length - erhuaIndices(text).size;
}

/** Bảng chiếu vị trí ký tự → vị trí âm tiết sau khi gộp 儿 hoá (chữ 儿 gộp nhận -1). */
export function syllableIndexMap(text) {
  const erhua = erhuaIndices(text);
  const map = [];
  let s = -1;
  [...text].forEach((c, i) => {
    if (!erhua.has(i)) s += 1;
    map[i] = s;
  });
  return map;
}

// pinyin-pro suy ra đa âm theo ngữ cảnh và thỉnh thoảng đọc sai một từ mà chính nó tra
// đúng khi từ đó đứng một mình (银行人 → yín xíng rén, 别着急 → zhe jí). Học liệu khoá
// cách đọc cho những chuỗi hay gặp ở đây; bảng áp dụng cho cả pinyinCitation lẫn readSentence
// để chữ hiển thị và bộ chấm thanh không lệch nhau.
export const POLYPHONE_LOCKS = {
  银行: ['yín', 'háng'],
  着急: ['zháo', 'jí'],
  钥匙: ['yào', 'shi'],
  便宜: ['pián', 'yi'],
  还是: ['hái', 'shì'],
  // 不 chỉ hoá bú trước thanh 4; pinyin-pro hạ nó thành bú trước 便宜 (thanh 2).
  不便: ['bù', 'pián'],
  // 一起 luôn đọc yì qǐ, nhưng pinyin-pro để mất biến điệu sau một số ngữ cảnh (周六一起看).
  一起: ['yì', 'qǐ'],
  // 得 đứng ngay sau động từ/tính từ là bổ ngữ tố, đọc nhẹ; pinyin-pro thường ghi thành dé.
  写得: ['xiě', 'de'],
  说得: ['shuō', 'de'],
  跑得: ['pǎo', 'de'],
  冷得: ['lěng', 'de'],
  好得: ['hǎo', 'de'],
  用得: ['yòng', 'de'],
  坐得: ['zuò', 'de'],
  担得: ['dān', 'de'],
  睡得: ['shuì', 'de'],
  练得: ['liàn', 'de'],
  背得: ['bèi', 'de'],
  行得: ['xíng', 'de'],
  多得: ['duō', 'de'],
  // 得 = "phải" (đứng sau chủ ngữ/trạng từ hoặc đầu về) là děi, không phải dé.
  // Khoá cả chữ đứng sau: 我得… sẽ bắt nhầm 我得到 (dé), còn 得早… sẽ bắt nhầm 觉得早上.
  我得加: ['wǒ', 'děi', 'jiā'],
  我得决: ['wǒ', 'děi', 'jué'],
  就得用: ['jiù', 'děi', 'yòng'],
  就得站: ['jiù', 'děi', 'zhàn'],
  还得看: ['hái', 'děi', 'kàn'],
  '，得改': ['，', 'děi', 'gǎi'],
  '，得早': ['，', 'děi', 'zǎo'],
  // 空 = "rảnh, còn trống" đọc kòng thanh 4; pinyin-pro ghi nhầm kōng thanh 1.
  有空: ['yǒu', 'kòng'],
  空着: ['kòng', 'zhe'],
  // 只 = "chỉ" là zhǐ; pinyin-pro ghi nhầm zhī trước một số động từ (只送/只看/只统计/只访问).
  只送: ['zhǐ', 'sòng'],
  只看: ['zhǐ', 'kàn'],
  只统计: ['zhǐ', 'tǒng', 'jì'],
  只访问: ['zhǐ', 'fǎng', 'wèn'],
  // 一千 luôn đọc yì qiān; pinyin-pro có câu trả yī (一千八百块 trong câu dài).
  一千: ['yì', 'qiān'],
  // 还 cuối câu sau 时候 = "trả lại" (huán); pinyin-pro ghi hái. Kèm dấu câu để không bắt nhầm 的时候还没… (hái).
  '时候还。': ['shí', 'hou', 'huán', '。'],
};

/** Thay cách đọc của các chuỗi trong POLYPHONE_LOCKS ngay tại chỗ; toks thẳng hàng với chars. */
export function applyPolyphoneLocks(chars, toks) {
  for (const [word, readings] of Object.entries(POLYPHONE_LOCKS)) {
    const w = [...word];
    for (let i = 0; i + w.length <= chars.length; i += 1) {
      if (w.every((c, k) => chars[i + k] === c)) readings.forEach((r, k) => (toks[i + k] = r));
    }
  }
  return toks;
}

/** Vị trí âm tiết Hán (đếm từ 0) bị khoá đọc nhẹ — như 得 sau động từ, 钥匙. */
export function lockNeutralPositions(text) {
  const chars = [...text];
  const hanPos = [];
  let h = -1;
  chars.forEach((c, i) => {
    if (HAN.test(c)) {
      h += 1;
      hanPos[i] = h;
    }
  });
  const out = new Set();
  for (const [word, readings] of Object.entries(POLYPHONE_LOCKS)) {
    const w = [...word];
    for (let i = 0; i + w.length <= chars.length; i += 1) {
      if (w.every((c, k) => chars[i + k] === c)) {
        readings.forEach((r, k) => {
          if (stripTone(r) === r && hanPos[i + k] !== undefined) out.add(hanPos[i + k]);
        });
      }
    }
  }
  return out;
}


// Từ điển ghi âm tiết thứ hai (hoặc các vị trí liệt kê) là thanh nhẹ.
// Đây là nguồn duy nhất; mọi script kiểm tra phải import danh sách này.
import policy from '../../lessons/courses/policies/neutral-tone-policy.json' with { type: 'json' };
export const NEUTRAL_LEXICAL = policy.lexicalNeutral;
export const NEUTRAL_SUFFIX = new Set(policy.suffixNeutral);

const isCombining = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0x0300 && c <= 0x036f && c !== 0x0308;
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
  // A known full-tone compound overrides a neutral substring (not general word segmentation).
  for (const phrase of ['东西方']) {
    let start = text.indexOf(phrase);
    while (start >= 0) {
      for (let i = start; i < start + phrase.length; i++) neutral.delete(hanPos[i]);
      start = text.indexOf(phrase, start + phrase.length);
    }
  }
  return neutral;
}

/** Pinyin dạng trích dẫn: thanh từ điển, âm nhẹ không dấu, không biến điệu 3+3. */
export function pinyinCitation(text) {
  const chars = [...text];
  const toks = applyPolyphoneLocks(chars, pinyin(text, { pattern: 'tone', type: 'array' }));
  if (toks.length !== chars.length) {
    throw new Error(`pinyin-pro lệch số token: ${text}`);
  }
  const neutral = neutralPositions(text);
  const erhua = erhuaIndices(text);
  let h = -1;
  const out = [];
  chars.forEach((c, i) => {
    let tok;
    if (HAN.test(c)) {
      h += 1;
      tok = neutral.has(h) ? stripTone(toks[i]) : toks[i];
    } else {
      tok = toks[i];
      // Chuỗi Latin trong câu (HSK, B超…) là một từ, không phải từng âm tiết rời.
      const prev = chars[i - 1];
      if (prev && /^[A-Za-z]$/.test(c) && /^[A-Za-z]$/.test(prev)) {
        out[out.length - 1] += tok;
        return;
      }
    }
    if (erhua.has(i)) {
      out[out.length - 1] += 'r';
      return;
    }
    out.push(tok);
  });
  return out.join(' ');
}

/** Pinyin của một từ/âm tiết đơn lẻ, cùng quy ước trích dẫn. */
export function pinyinWord(word) {
  return pinyinCitation(word);
}

const TONE_NUM = { 0x0304: 1, 0x0301: 2, 0x030c: 3, 0x0300: 4 };

/** Nhãn thanh điệu của một chuỗi pinyin: 'thanh 1'…'thanh 4', hoặc 'thanh nhẹ' khi không có dấu. */
export function toneLabel(text) {
  const mark = [...String(text).normalize('NFD')].find((c) => c.codePointAt(0) in TONE_NUM);
  const tone = mark ? TONE_NUM[mark.codePointAt(0)] : 0;
  return tone ? `thanh ${tone}` : 'thanh nhẹ';
}

/** Hai chuỗi pinyin có cùng âm tiết gốc không (chỉ bỏ dấu thanh, giữ nguyên ü)? Rỗng là không so được. */
export function sameSyllable(a, b) {
  const dropTone = (s) =>
    [...String(s).normalize('NFD')]
      .filter((c) => !(c.codePointAt(0) in TONE_NUM))
      .join('')
      .normalize('NFC');
  const x = dropTone(a);
  return Boolean(x) && x === dropTone(b);
}
