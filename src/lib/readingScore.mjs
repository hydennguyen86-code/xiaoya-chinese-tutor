// Chấm đọc theo ÂM (pinyin) khi đã biết câu mẫu: so từng âm tiết, không so chữ Hán.
// Đồng âm khác chữ (事/是, 他/她/它) là đúng âm; thanh sai tách riêng. Thanh suy ra từ chữ
// mà máy nhận dạng đoán theo ngữ cảnh, nên "sai thanh" chỉ là GỢI Ý, không phải kết luận.
// Dùng chung cách đọc với bộ chấm thanh (coursePinyin.mjs) để hiển thị và chấm không lệch.

import { pinyin } from 'pinyin-pro';
import { HAN, applyPolyphoneLocks, erhuaIndices, neutralPositions, toneLabel } from './coursePinyin.mjs';
import { hasDigits, numberCandidates } from './hanziNumbers.mjs';

const TONE_MARK = { 0x0304: 1, 0x0301: 2, 0x030c: 3, 0x0300: 4 };

/** Tách âm tiết pinyin có dấu → { base (bỏ dấu, giữ ü), tone 0-4 }. */
function parseSyllable(py) {
  let tone = 0;
  const base = [...String(py).normalize('NFD')]
    .filter((c) => {
      const t = TONE_MARK[c.codePointAt(0)];
      if (t) tone = t;
      return !t;
    })
    .join('')
    .normalize('NFC')
    .toLowerCase();
  return { base, tone };
}

/**
 * Âm tiết của phần chữ Hán trong chuỗi: [{ char, pinyin, base, tone, erhua? }].
 * Bỏ dấu câu/chữ khác. 儿 hoá (哪儿) gộp vào âm tiết trước; base không kể "r" nên
 * máy nhận "哪" hay "哪儿" đều khớp.
 */
export function syllablesOf(text) {
  const chars = [...String(text ?? '')];
  if (!chars.some((c) => HAN.test(c))) return [];
  const toks = applyPolyphoneLocks(chars, pinyin(chars.join(''), { pattern: 'tone', type: 'array' }));
  if (toks.length !== chars.length) return [];
  const neutral = neutralPositions(chars.join(''));
  const erhua = erhuaIndices(chars.join(''));
  const out = [];
  let h = -1;
  chars.forEach((c, i) => {
    if (!HAN.test(c)) return;
    h += 1;
    if (erhua.has(i) && out.length) {
      const last = out[out.length - 1];
      last.char += c;
      last.pinyin += 'r';
      last.erhua = true;
      return;
    }
    let py = toks[i];
    if (neutral.has(h)) py = parseSyllable(py).base;
    const { base, tone } = parseSyllable(py);
    out.push({ char: c, pinyin: py, base, tone });
  });
  return out;
}

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

function splitBase(base) {
  const initial = INITIALS.find((i) => base.startsWith(i) && base.length > i.length) ?? '';
  return { initial, final: base.slice(initial.length) };
}

// Cặp hay lẫn của người Việt (hai chiều).
const NEAR_INITIALS = [
  ['z', 'zh'],
  ['c', 'ch'],
  ['s', 'sh'],
  ['n', 'l'],
  ['f', 'h'],
];
const NEAR_FINALS = [
  ['in', 'ing'],
  ['en', 'eng'],
  ['an', 'ang'],
];
const inPairs = (pairs, a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Hai âm tiết khác base nhưng "gần" nhau? Trả { kind, from, to } theo hướng mẫu → nghe được. */
export function nearConfusion(targetBase, heardBase) {
  if (targetBase === heardBase) return null;
  const t = splitBase(targetBase);
  const h = splitBase(heardBase);
  if (t.final === h.final && inPairs(NEAR_INITIALS, t.initial, h.initial)) {
    return { kind: 'initial', from: t.initial, to: h.initial };
  }
  if (t.initial === h.initial && inPairs(NEAR_FINALS, t.final, h.final)) {
    return { kind: 'final', from: t.final, to: h.final };
  }
  return null;
}

const toneWord = (tone) => (tone ? `thanh ${tone}` : 'thanh nhẹ');

function subCost(t, h) {
  if (t.base === h.base) return t.tone === 0 || t.tone === h.tone ? 0 : 0.01;
  return nearConfusion(t.base, h.base) ? 0.5 : 1;
}

/**
 * Gióng hàng âm tiết mẫu với âm tiết nghe được (Needleman-Wunsch, chèn/xoá = 1).
 * Mỗi âm mẫu: status 'match' | 'tone' | 'near' | 'wrong' | 'missing'; extra = âm nghe thừa.
 */
export function alignSyllables(targetSyls, heardSyls) {
  const n = targetSyls.length;
  const m = heardSyls.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) d[i][0] = i;
  for (let j = 1; j <= m; j += 1) d[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      d[i][j] = Math.min(d[i - 1][j - 1] + subCost(targetSyls[i - 1], heardSyls[j - 1]), d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const syllables = new Array(n);
  const extra = [];
  let i = n;
  let j = m;
  const EPS = 1e-9;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + subCost(targetSyls[i - 1], heardSyls[j - 1]))) < EPS) {
      const t = targetSyls[i - 1];
      const h = heardSyls[j - 1];
      const entry = { target: t, heard: h };
      if (t.base === h.base) {
        entry.status = t.tone === 0 || t.tone === h.tone ? 'match' : 'tone';
      } else {
        const near = nearConfusion(t.base, h.base);
        if (near) {
          entry.status = 'near';
          entry.near = near;
          entry.toneDiff = !(t.tone === 0 || t.tone === h.tone);
        } else entry.status = 'wrong';
      }
      syllables[i - 1] = entry;
      i -= 1;
      j -= 1;
    } else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + 1)) < EPS) {
      syllables[i - 1] = { target: targetSyls[i - 1], status: 'missing' };
      i -= 1;
    } else {
      extra.unshift(heardSyls[j - 1]);
      j -= 1;
    }
  }
  return { syllables, extra };
}

const WEIGHT = { match: 1, tone: 0.7, near: 0.4, wrong: 0, missing: 0 };
const EXTRA_PENALTY = 0.25;

function issueText(s) {
  const t = s.target;
  if (s.status === 'tone') return `“${t.base}” nghe như ${toneWord(s.heard.tone)}, cần ${toneWord(t.tone)}`;
  if (s.status === 'near') {
    const what = s.near.kind === 'initial' ? 'âm' : 'vần';
    const tone = s.toneDiff ? ` (và ${toneWord(s.heard.tone)} thay vì ${toneWord(t.tone)})` : '';
    return `${what} “${s.near.from}” trong “${t.base}” nghe thành “${s.near.to}”${tone}`;
  }
  if (s.status === 'wrong') return `“${t.pinyin}” nghe thành “${s.heard.pinyin}”`;
  if (s.status === 'missing') return `thiếu âm “${t.pinyin}”`;
  return '';
}

function scoreSyllables(targetSyls, heardSyls) {
  const total = targetSyls.length;
  if (!total) {
    return { syllables: [], extra: [], matched: 0, total: 0, score: 0, ok: false, summary: 'Không có chữ Hán để chấm.' };
  }
  const { syllables, extra } = alignSyllables(targetSyls, heardSyls);
  const matched = syllables.filter((s) => s.status === 'match').length;
  const weight = syllables.reduce((sum, s) => sum + WEIGHT[s.status], 0) - extra.length * EXTRA_PENALTY;
  const score = Math.max(0, Math.round((weight / total) * 100));
  const wrongOrMissing = syllables.filter((s) => s.status === 'wrong' || s.status === 'missing').length;
  const ok = score >= (total <= 4 ? 80 : 85) && wrongOrMissing <= 1;
  const issues = syllables.map(issueText).filter(Boolean);
  for (const e of extra) issues.push(`thừa âm “${e.pinyin}”`);
  let summary;
  if (!issues.length) summary = 'Mình nghe đúng rồi.';
  else {
    summary = `${issues.slice(0, 3).join('; ')}.`;
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    if (syllables.some((s) => s.status === 'tone' || s.toneDiff)) {
      summary += ' Thanh chỉ là gợi ý vì máy đoán chữ theo ngữ cảnh.';
    }
  }
  return { syllables, extra, matched, total, score, ok, summary };
}

const better = (r, best) => !best || r.score > best.score || (r.score === best.score && r.ok && !best.ok);

// Bản chép có chữ số (25岁, 3点半): thử mọi cách đọc bằng chữ Hán, giữ cách khớp câu mẫu nhất.
function bestOverNumbers(heardText, score) {
  if (!hasDigits(heardText)) return { result: score(heardText), text: heardText };
  let best = null;
  let text = heardText;
  for (const c of numberCandidates(heardText)) {
    const r = score(c);
    if (better(r, best)) {
      best = r;
      text = c;
    }
  }
  return { result: best, text };
}

/** Chấm cả câu nghe được so với câu mẫu. */
export function scoreReading(target, heardText) {
  const t = syllablesOf(target);
  return bestOverNumbers(heardText, (h) => scoreSyllables(t, syllablesOf(h))).result;
}

/**
 * Bản chép đã đổi chữ số về chữ Hán theo cách đọc khớp câu mẫu nhất (không có chữ số thì giữ nguyên).
 * Dùng khi cần đếm âm tiết lời nghe, ví dụ server so số âm tiết trước khi chấm thanh.
 */
export function normalizeHeard(target, heardText, { within = false } = {}) {
  const t = syllablesOf(target);
  return bestOverNumbers(heardText, (h) => (within ? containsSyllables(t, syllablesOf(h)) : scoreSyllables(t, syllablesOf(h)))).text;
}

/** Mục tiêu NẰM TRONG câu nói dài: trượt cửa sổ độ dài n-1..n+1 trong lời nghe, lấy cửa sổ tốt nhất. */
export function containsReading(target, heardText) {
  const t = syllablesOf(target);
  return bestOverNumbers(heardText, (h) => containsSyllables(t, syllablesOf(h))).result;
}

function containsSyllables(t, h) {
  const n = t.length;
  if (!n) return scoreSyllables(t, h);
  let best = null;
  for (let len = Math.max(1, n - 1); len <= n + 1; len += 1) {
    const last = Math.max(0, h.length - len);
    for (let start = 0; start <= last; start += 1) {
      const r = scoreSyllables(t, h.slice(start, start + len));
      if (better(r, best)) best = r;
    }
  }
  return best ?? scoreSyllables(t, h);
}

const PUNCT = /[\s，。！？、；：,.!?;:“”"'‘’…（）()《》-]/gu;
const bare = (s) => String(s ?? '').replace(PUNCT, '');

/**
 * Cổng đúng/sai cho giao diện: chữ giống hệt luôn đúng; còn lại xét theo âm.
 * Mục tiêu không có chữ Hán (số, chữ Latin) thì quay về so chuỗi.
 */
export function readingOk(target, heardText, { within = false } = {}) {
  const a = bare(target);
  const b = bare(heardText);
  if (!a) return false;
  if (within ? b.includes(a) : a === b) return true;
  const r = within ? containsReading(target, heardText) : scoreReading(target, heardText);
  return r.total > 0 && r.ok;
}

export { toneLabel };
