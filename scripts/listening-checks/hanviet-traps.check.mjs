// Kiểm tra content-for-misu/hanviet-traps.json
//
// Kiểm tra: cấu trúc hai nhóm (mẹo âm / bẫy nghĩa), id tuần tự, pinyin khớp chữ Hán
// theo pinyin-pro, âm Hán Việt đúng dạng (chữ thường, có dấu), nghĩa tiếng Việt không
// lẫn chữ Hán, mẹo âm phải ghi "gần đúng", bẫy nghĩa phải nhắc lại đúng âm Hán Việt,
// và phân bố bậc hợp lý.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../../lessons/listening/hanviet-traps.json');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const TONE_BY_CODE = { 0x300: 4, 0x301: 2, 0x304: 1, 0x30c: 3 };

const isCombining = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0x300 && c <= 0x36f;
};

function stripTone(syllable) {
  let tone = 0;
  let out = '';
  for (const ch of syllable.normalize('NFD')) {
    if (isCombining(ch)) {
      tone = TONE_BY_CODE[ch.charCodeAt(0)] || tone;
      continue;
    }
    out += ch;
  }
  return { letters: out.normalize('NFC').toLowerCase().replace(/v/g, 'ü'), tone: tone || 5 };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

if (data.source !== 'AI soạn, chưa duyệt') fail('file', `source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'hanviet-traps') fail('file', 'kind phải là "hanviet-traps"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) fail('file', 'thiếu levels (3 bậc)');
if (!data.schema) fail('file', 'thiếu mô tả schema');
if (!data.note) fail('file', 'thiếu note giải thích cách dùng');

const GROUPS = ['âm', 'nghĩa'];
if (!Array.isArray(data.groups) || data.groups.length !== 2) {
  fail('file', 'cần groups mô tả đúng 2 nhóm: âm và nghĩa');
} else {
  const declared = data.groups.map((g) => g?.trap);
  for (const g of GROUPS) {
    if (!declared.includes(g)) fail('file', `groups thiếu nhóm "${g}"`);
  }
  for (const g of data.groups) {
    if (!GROUPS.includes(g?.trap)) fail('file', `groups có trap lạ ${JSON.stringify(g?.trap)}`);
    if (!String(g?.title ?? '').trim()) fail('file', `nhóm "${g?.trap}" thiếu title`);
    if (String(g?.description ?? '').trim().length < 40) fail('file', `nhóm "${g?.trap}" thiếu description đủ rõ`);
  }
}

const items = Array.isArray(data.items) ? data.items : [];
if (items.length < 30) fail('file', `chỉ có ${items.length} mục — quá ít để thành bộ nội dung`);

const perLevel = {};
const seenHanzi = new Map();
const seenId = new Set();
const trapCounts = {};
let seenMeaning = false;

items.forEach((it, i) => {
  const id = it?.id ?? '(không id)';
  const expectId = `hv-${String(i + 1).padStart(3, '0')}`;
  if (it.id !== expectId) fail(id, `id phải là ${expectId} (thứ tự liên tục)`);
  if (seenId.has(it.id)) fail(id, 'trùng id');
  seenId.add(it.id);

  if (!(data.levels ?? []).includes(it.level)) fail(id, `level "${it.level}" không nằm trong levels`);
  perLevel[it.level] = (perLevel[it.level] ?? 0) + 1;

  const hanzi = String(it.hanzi ?? '');
  if (!hanzi || [...hanzi].some((c) => !HAN.test(c))) fail(id, 'hanzi phải là chữ Hán (1–3 chữ)');
  if ([...hanzi].length > 3) fail(id, 'hanzi dài quá 3 chữ');
  if (seenHanzi.has(hanzi)) fail(id, `trùng mục với ${seenHanzi.get(hanzi)}`);
  else seenHanzi.set(hanzi, id);

  // pinyin khớp pinyin-pro
  const ref = pinyin(hanzi, { pattern: 'tone', type: 'array' }).map(stripTone);
  const syls = String(it.pinyin ?? '').trim().split(/\s+/).filter(Boolean);
  if (syls.length !== ref.length) fail(id, `pinyin có ${syls.length} âm tiết nhưng hanzi có ${ref.length} chữ`);
  syls.forEach((s, k) => {
    const { letters, tone } = stripTone(s);
    if (!ref[k]) return;
    if (letters !== ref[k].letters) fail(id, `"${s}" không khớp chữ "${hanzi[k]}" (pinyin-pro: ${ref[k].letters}${ref[k].tone})`);
    else if (tone !== ref[k].tone && !(tone === 5 || (tone === 2 && ref[k].tone === 3))) {
      fail(id, `dấu thanh của "${s}" (=${tone}) khác pinyin-pro (=${ref[k].tone})`);
    }
  });

  // âm Hán Việt
  const hv = String(it.hanViet ?? '');
  if (!hv) fail(id, 'thiếu hanViet');
  if (HAN.test(hv)) fail(id, 'hanViet lẫn chữ Hán');
  if (/[A-Z]/.test(hv)) fail(id, 'hanViet phải viết chữ thường');
  if (!/^[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\s]+$/.test(hv)) {
    fail(id, `hanViet "${hv}" chứa ký tự không hợp lệ`);
  }
  // Thanh ngang (không dấu) là hợp lệ: hoa, xe, sinh, tri… Chỉ nghi thiếu dấu khi
  // âm gốc là thanh 3/4 mà âm Hán Việt vẫn không có dấu và không phải âm nhập (đuôi c/ch/p/t).
  const hvSyls = hv.trim().split(/\s+/).filter(Boolean);
  const stopFinal = hvSyls.some((s) => /(c|ch|p|t)$/.test(s));
  if (!VI_DIACRITICS.test(hv) && !stopFinal && ref.length && ref.every((r) => r.tone === 3 || r.tone === 4)) {
    fail(id, `hanViet "${hv}" không có dấu dù âm gốc thanh 3/4 — nhiều khả năng thiếu dấu`);
  }

  // nghĩa: thanh ngang không dấu là hợp lệ (hoa, xe, tay, vui…), nên chỉ cảnh báo khi
  // cả cụm nhiều âm tiết đều không có dấu.
  const meaning = String(it.meaningVi ?? '');
  if (HAN.test(meaning)) fail(id, 'meaningVi lẫn chữ Hán');
  if (meaning.trim().length < 2) fail(id, 'meaningVi quá ngắn');
  const meaningSyls = meaning.split(/[,\s;()/]+/).filter(Boolean);
  if (!VI_DIACRITICS.test(meaning) && meaningSyls.length >= 2) {
    warn(id, `meaningVi "${meaning}" không có dấu nào — kiểm tra lại xem có phải từ thanh ngang thật không`);
  }
  const FOREIGN = /\b(please|sorry|hello|thank|thanks|and|the|with|from|this|that|people|time)\b/i;
  if (FOREIGN.test(meaning)) fail(id, 'meaningVi có lẫn từ tiếng Anh');

  // bẫy + ghi chú
  const trap = String(it.trap ?? '');
  if (!GROUPS.includes(trap)) fail(id, `trap "${trap}" phải là ${GROUPS.join('|')}`);
  trapCounts[trap] = (trapCounts[trap] ?? 0) + 1;
  if (trap === 'âm' && seenMeaning) fail(id, 'mục "âm" nằm sau nhóm "nghĩa" — phải gom hai nhóm liền nhau');
  if (trap === 'nghĩa') seenMeaning = true;
  if (trap === 'âm' && hv.toLowerCase() === meaning.trim().toLowerCase()) {
    warn(id, `hanViet trùng meaningVi ("${hv}") — hợp lý vì đây là mẹo âm, không phải bẫy nghĩa`);
  }
  const note = String(it.noteVi ?? '');
  if (note.trim().length < 25) fail(id, 'noteVi quá ngắn để giải thích bẫy');
  if (trap === 'âm' && !/gần đúng/i.test(note)) {
    fail(id, 'mẹo âm phải ghi rõ "gần đúng" trong noteVi');
  }
  if (trap === 'nghĩa') {
    if (!note.toLowerCase().includes(hv.toLowerCase())) fail(id, `noteVi của bẫy nghĩa phải nhắc lại âm Hán Việt "${hv}"`);
    const tokens = meaning.toLowerCase().split(/[,\s;()/]+/).filter((t) => t.length >= 2);
    if (tokens.length && !tokens.some((t) => note.toLowerCase().includes(t))) {
      warn(id, `noteVi chưa nói rõ nghĩa hiện đại ("${meaning}") khác âm Hán Việt thế nào`);
    }
  }
  if (it.uncertain === true && !it.uncertainReason) fail(id, 'uncertain=true mà thiếu uncertainReason');
  if (it.uncertain === true) warn(id, `uncertain: ${it.uncertainReason}`);
});

for (const l of data.levels ?? []) {
  if ((perLevel[l] ?? 0) < 3) fail('file', `${l}: chỉ có ${perLevel[l] ?? 0} mục — mỗi bậc cần ít nhất 3`);
}
if ((trapCounts['âm'] ?? 0) < 20) fail('file', `chỉ có ${trapCounts['âm'] ?? 0} mẹo âm — cần ít nhất 20`);
if ((trapCounts['nghĩa'] ?? 0) < 10) fail('file', `chỉ có ${trapCounts['nghĩa'] ?? 0} bẫy nghĩa — cần ít nhất 10`);

console.log(`File: ${FILE}`);
console.log(`Số mục: ${items.length}`);
for (const l of data.levels ?? []) console.log(`  ${l}: ${perLevel[l] ?? 0} mục`);
for (const g of data.groups ?? []) console.log(`  ${g.title}: ${trapCounts[g.trap] ?? 0} mục`);
const uncertain = items.filter((i) => i.uncertain === true).map((i) => `${i.id} (${i.hanzi})`);
console.log(`Mục uncertain (${uncertain.length}): ${uncertain.join(', ') || '—'}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: cấu trúc, id, pinyin-pro, âm Hán Việt, nghĩa và ghi chú bẫy đều hợp lệ.');
