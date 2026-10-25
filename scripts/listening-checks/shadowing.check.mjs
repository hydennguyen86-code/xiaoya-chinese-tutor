// Kiểm tra content-for-misu/shadowing.json
//
// Kiểm tra: cấu trúc file, id duy nhất theo bậc, pinyin khớp từng chữ theo pinyin-pro
// (kể cả các dạng chấp nhận được của biến điệu 3+3 và thanh nhẹ), cụm hơi cắt đúng,
// nghĩa tiếng Việt có dấu, focus không rỗng, pace hợp lệ, độ dài đoạn tăng dần trong bậc.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../../lessons/listening/shadowing.json');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
// Từ tiếng Anh hay lọt vào bản dịch (tiếng Việt vốn viết bằng ký tự Latin nên không thể cấm a-z).
const FOREIGN_WORD = /\b(and|the|memorize|interest|very|good|bad|work|money|but|because|about|with|from|this|that)\b/iu;
const TONE_BY_CODE = { 0x0300: 4, 0x0301: 2, 0x0304: 1, 0x030C: 3 };

const isCombining = (ch) => {
  const c = ch.charCodeAt(0);
  return c >= 0x0300 && c <= 0x036f;
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

const hanOnly = (s) => [...s].filter((c) => HAN.test(c)).join('');

// Phải khớp NEUTRAL trong _pinyin-utils.mjs.
const NEUTRAL_LEXICAL = ['朋友', '妈妈', '爸爸', '哥哥', '姐姐', '弟弟', '妹妹', '什么', '桌子', '椅子', '东西', '谢谢', '觉得', '知道', '时候', '漂亮', '衣服', '玻璃', '豆腐', '萝卜', '葡萄', '客气', '便宜', '休息', '名字', '右边', '左边', '爷爷', '奶奶', '早上', '晚上', '商量', '明白'];
const NEUTRAL_SUFFIX = new Set(['们', '么', '的', '了', '吧', '吗', '呢', '啊', '呀', '哦', '嘛']);

/** Tập hợp chuỗi thanh mà mục này có thể mang: pinyin-pro + nhẹ + biến điệu 3+3. */
function allowedToneForms(text) {
  const chars = [...text];
  const dict = pinyin(text, { pattern: 'tone', type: 'array' }).map(stripTone).map((p) => p.tone);
  const neutralPos = new Set();
  for (const w of NEUTRAL_LEXICAL) {
    let start = text.indexOf(w);
    while (start >= 0) {
      neutralPos.add(start + w.length - 1);
      start = text.indexOf(w, start + w.length);
    }
  }
  chars.forEach((c, i) => {
    if (i > 0 && NEUTRAL_SUFFIX.has(c)) neutralPos.add(i);
  });
  const nIdx = [...neutralPos].filter((i) => i < dict.length).sort((a, b) => a - b);
  const trios = [];
  for (let i = 0; i + 1 < dict.length; i += 1) if (dict[i] === 3 && dict[i + 1] === 3) trios.push(i);

  const forms = new Set();
  const base = [...dict];
  for (const i of nIdx) base[i] = 5;
  // mọi tập con các cặp 3+3 được hạ xuống thanh 2 (2^k, k nhỏ)
  for (let mask = 0; mask < (1 << trios.length); mask += 1) {
    const t = [...base];
    for (let b = 0; b < trios.length; b += 1) {
      if (mask & (1 << b)) {
        const i = trios[b];
        if (t[i] === 3) t[i] = 2;
      }
    }
    forms.add(t.join('-'));
  }
  return { dict: dict.join('-'), forms };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

if (data.source !== 'AI soạn, chưa duyệt') fail('file', `source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'shadowing') fail('file', 'kind phải là "shadowing"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) fail('file', 'thiếu levels (3 bậc)');
if (!data.schema) fail('file', 'thiếu mô tả schema');
if (!data.note) fail('file', 'thiếu note giải thích cách dùng');

const items = Array.isArray(data.items) ? data.items : [];
if (items.length !== 60) fail('file', `cần 60 đoạn, đang có ${items.length}`);

const PER_LEVEL = 20;
const perLevel = {};
const lengths = {};
const seenId = new Set();
const seenText = new Map();

for (const it of items) {
  const id = it?.id ?? '(không id)';
  if (!/^sh-[123]-\d{2}$/.test(String(it.id))) fail(id, 'id sai định dạng sh-<1|2|3>-<2 chữ số>');
  if (seenId.has(it.id)) fail(id, 'trùng id');
  seenId.add(it.id);

  const prefix = String(it.id).slice(3, 4);
  const expectLevel = { 1: 'HSK1-2', 2: 'HSK3-4', 3: 'HSK5-6' }[prefix];
  if (it.level !== expectLevel) fail(id, `level "${it.level}" không khớp id (phải là ${expectLevel})`);
  perLevel[it.level] = (perLevel[it.level] ?? 0) + 1;

  // 1) chữ Hán + cắt cụm hơi
  const text = String(it.text ?? '');
  const textHan = hanOnly(text);
  if (!textHan) fail(id, 'text không có chữ Hán');
  if (/[a-zA-Z]/.test(text)) fail(id, 'text lẫn ký tự Latin');
  const chunks = Array.isArray(it.chunks) ? it.chunks : null;
  if (!chunks || !chunks.length) {
    fail(id, 'chunks phải là mảng không rỗng');
    continue;
  }
  if (chunks.length < 3) fail(id, `cần ít nhất 3 cụm hơi, đang có ${chunks.length}`);
  if (chunks.length > 12) warn(id, `${chunks.length} cụm hơi — đoạn dài, cân nhắc tách`);
  const joined = chunks.map((c) => String(c.hanzi ?? '')).join('');
  if (joined !== textHan) fail(id, `nối chunks ≠ chữ Hán của đoạn ("${joined}" vs "${textHan}")`);
  for (const c of chunks) {
    if (!/^(soft|hard|end)$/.test(String(c.pause))) fail(id, `chunk "${c.hanzi}" có pause "${c.pause}" (soft|hard|end)`);
  }
  if (chunks[chunks.length - 1].pause !== 'end') fail(id, 'chunk cuối phải có pause=end');

  // 2) pinyin
  const syls = String(it.pinyin ?? '').trim().split(/\s+/).filter(Boolean);
  if (syls.length !== textHan.length) fail(id, `pinyin có ${syls.length} âm tiết nhưng đoạn có ${textHan.length} chữ Hán`);
  const ref = pinyin(textHan, { pattern: 'tone', type: 'array' }).map(stripTone);
  syls.forEach((s, i) => {
    const { letters, tone } = stripTone(s);
    if (!ref[i]) return;
    if (letters !== ref[i].letters) fail(id, `pinyin "${s}" không khớp chữ "${textHan[i]}" (pinyin-pro: ${ref[i].letters}${ref[i].tone})`);
  });
  const allowed = allowedToneForms(textHan);
  const tones = syls.map((s) => stripTone(s).tone);
  if (syls.length === textHan.length && !allowed.forms.has(tones.join('-'))) {
    fail(id, `chuỗi thanh ${tones.join('-')} không nằm trong các dạng chấp nhận được (gốc: ${allowed.dict})`);
  }
  // pinyin của từng chunk phải là lát cắt của pinyin cả đoạn
  let cursor = 0;
  for (const c of chunks) {
    const n = hanOnly(String(c.hanzi ?? '')).length;
    const want = syls.slice(cursor, cursor + n).join(' ');
    cursor += n;
    if (String(c.pinyin ?? '').trim() !== want) fail(id, `chunk "${c.hanzi}" có pinyin khác lát cắt của pinyin đoạn`);
  }
  if (it.syllables !== cursor) fail(id, `syllables=${it.syllables} nhưng đoạn có ${cursor} âm tiết`);

  if (it.sandhi === true) {
    if (tones.join('-') === allowed.dict) fail(id, 'sandhi=true nhưng chuỗi thanh không khác pinyin-pro');
    if (!Array.isArray(it.baseTones)) fail(id, 'sandhi=true mà thiếu baseTones');
    else if (it.baseTones.join('-') !== allowed.dict && !allowed.forms.has(it.baseTones.join('-'))) {
      fail(id, `baseTones [${it.baseTones}] không khớp thanh gốc ${allowed.dict}`);
    }
    if (!it.hint) warn(id, 'sandhi=true nên kèm hint');
  } else if (tones.join('-') !== allowed.dict && !allowed.forms.has(tones.join('-'))) {
    warn(id, 'dạng thanh khác pinyin-pro — nên đặt sandhi=true');
  }

  // 3) nghĩa tiếng Việt
  const meaning = String(it.meaningVi ?? '');
  if (HAN.test(meaning)) fail(id, 'meaningVi lẫn chữ Hán');
  if (FOREIGN_WORD.test(` ${meaning} `)) warn(id, 'meaningVi lẫn từ tiếng Anh — nghĩa phải viết bằng tiếng Việt');
  if (!VI_DIACRITICS.test(meaning)) fail(id, 'meaningVi thiếu dấu tiếng Việt');
  if (meaning.trim().length < 15) fail(id, 'meaningVi quá ngắn cho một đoạn shadowing');

  // 4) focus + pace
  const focus = Array.isArray(it.focus) ? it.focus : null;
  if (!focus || !focus.length) fail(id, 'focus phải là mảng không rỗng');
  else {
    for (const f of focus) {
      if (typeof f !== 'string' || f.trim().length < 8) fail(id, `focus "${f}" quá ngắn`);
      if (typeof f === 'string' && /\?\s*—/.test(f)) fail(id, `focus "${f}" còn dấu vết bản nháp`);
    }
  }
  if (!/^(chậm|vừa|nhanh)$/.test(String(it.pace))) fail(id, `pace "${it.pace}" phải là chậm|vừa|nhanh`);
  if (it.uncertain === true && !it.uncertainReason) fail(id, 'uncertain=true mà thiếu uncertainReason');
  if (it.uncertain === true) warn(id, `uncertain: ${it.uncertainReason}`);

  const prev = seenText.get(textHan);
  if (prev) fail(id, `trùng đoạn với ${prev}`);
  seenText.set(textHan, id);

  (lengths[it.level] ??= []).push({ id, n: textHan.length });
}

for (const l of data.levels ?? []) {
  const n = perLevel[l] ?? 0;
  if (n !== PER_LEVEL) fail('file', `${l}: cần ${PER_LEVEL} đoạn, đang có ${n}`);
}
const extra = Object.keys(perLevel).filter((l) => !(data.levels ?? []).includes(l));
if (extra.length) fail('file', `level không khai báo: ${extra.join(', ')}`);

for (const [level, list] of Object.entries(lengths)) {
  for (let i = 1; i < list.length; i += 1) {
    const drop = list[i - 1].n - list[i].n;
    if (drop > 3) warn(level, `${list[i].id} ngắn hơn ${drop} âm tiết so với ${list[i - 1].id} — chưa đúng thứ tự ngắn → dài`);
  }
}

console.log(`File: ${FILE}`);
console.log(`Số đoạn: ${items.length}`);
for (const l of data.levels ?? []) {
  const ns = (lengths[l] ?? []).map((x) => x.n);
  const lvl = items.filter((i) => i.level === l);
  const totalChunks = lvl.reduce((a, i) => a + (i.chunks?.length ?? 0), 0);
  if (ns.length) console.log(`  ${l}: ${perLevel[l] ?? 0} đoạn, ${Math.min(...ns)}–${Math.max(...ns)} âm tiết, ${(totalChunks / lvl.length).toFixed(1)} cụm hơi/đoạn`);
}
const uncertain = items.filter((i) => i.uncertain === true).map((i) => i.id);
console.log(`Mục uncertain (${uncertain.length}): ${uncertain.join(', ') || '—'}`);
console.log(`Đoạn có biến điệu (sandhi=true): ${items.filter((i) => i.sandhi === true).length}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: cấu trúc, id, pinyin-pro, cụm hơi, nghĩa tiếng Việt và focus đều hợp lệ.');
