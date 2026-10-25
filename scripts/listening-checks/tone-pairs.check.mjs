// Kiểm tra content-for-misu/tone-pairs.json
//        hoặc `node content-for-misu/tone-pairs.check.mjs` nếu máy có node trên PATH
//
// Chống chéo: cấu trúc bắt buộc, id duy nhất, không trùng nội dung, phương án gây nhiễu,
// nghĩa tiếng Việt, và pinyin/dấu thanh khớp chữ Hán theo pinyin-pro — có mô hình hoá
// biến điệu 一/不, biến điệu 3+3 và âm tiết đọc nhẹ.
// exit code 1 khi có LỖI; CẢNH BÁO không làm hỏng script nhưng nên xem lại.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../../lessons/listening/tone-pairs.json');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const LEVEL_BY_PREFIX = { 1: 'HSK1-2', 2: 'HSK3-4', 3: 'HSK5-6' };
const TONES = new Set([1, 2, 3, 4, 5]);
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const REQUIRED = ['id', 'level', 'type', 'hanzi', 'pinyin', 'tone', 'distractors', 'meaningVi'];
const OPTIONAL = ['baseTone', 'sandhi', 'hint', 'uncertain', 'uncertainReason', 'acceptTones'];

// Từ điển ghi âm tiết thứ hai đọc nhẹ, còn pinyin-pro báo thanh gốc.
const NEUTRAL_LEXICAL = new Set(['朋友', '妈妈', '爸爸', '椅子', '桌子', '什么', '觉得', '谢谢', '东西']);
const NEUTRAL_SUFFIX = new Set(['们', '么', '的', '了', '吧', '吗', '呢', '子', '头']);

// Chữ có nhiều dạng đọc hợp lệ mà pinyin-pro chỉ báo một. Giá trị: letters + số thanh.
const ALTERNATE_READINGS = {
  谁: ['shei2', 'shui2'],
};

// Cặp thanh người Việt hay nghe nhầm; mỗi mục phải có gây nhiễu "gần đúng" cho từng vị trí.
const PARTNER = { 2: [3, 4], 3: [2], 4: [2] };

// ---- pinyin: tách dấu thanh ----
const TONE_MARK = { '\u0300': 4, '\u0301': 2, '\u0304': 1, '\u030C': 3 };

/** { letters: bỏ dấu thanh, giữ ü, NFC, chữ thường; tone: 1-4, hoặc 5 khi không có dấu } */
function stripTone(syllable) {
  let tone = 0;
  let out = '';
  for (const ch of syllable.normalize('NFD')) {
    if (TONE_MARK[ch]) {
      tone = TONE_MARK[ch];
      continue;
    }
    if (ch === '\u0308') {
      out += ch; // umlaut là một phần của chữ ü, không phải dấu thanh
      continue;
    }
    if (ch >= '\u0300' && ch <= '\u036f') continue;
    out += ch;
  }
  return { letters: out.normalize('NFC').toLowerCase().replace(/v/g, 'ü'), tone: tone || 5 };
}

const countToneMarks = (syllable) => [...syllable.normalize('NFD')].filter((c) => TONE_MARK[c]).length;

/**
 * Âm tham chiếu cho một xâu Hán tự.
 * dict    = pinyin-pro theo từ (phân biệt đa âm: 睡觉 jiào, 音乐 yuè; đã gộp biến điệu 一/不)
 * base    = dict nhưng 一/不 đưa về thanh gốc 1/4
 * surface = dict + biến điệu 3+3 — dạng người học thực sự nghe
 */
function reference(hanzi, chars) {
  const syls = pinyin(hanzi, { pattern: 'tone', type: 'array' });
  const dict = syls.map((s) => stripTone(s).tone);
  const base = dict.map((t, i) => (chars[i] === '一' ? 1 : chars[i] === '不' ? 4 : t));
  const surface = [...dict];
  for (let i = 0; i + 1 < surface.length; i += 1) if (surface[i] === 3 && surface[i + 1] === 3) surface[i] = 2;
  return { letters: syls.map((s) => stripTone(s).letters), dict, base, surface };
}

// ---- đọc file ----
let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

if (data.source !== 'AI soạn, chưa duyệt') fail('file', `source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'tone-pairs') fail('file', 'kind phải là "tone-pairs"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) fail('file', 'thiếu levels (3 bậc)');
if (!data.schema) fail('file', 'thiếu mô tả schema');
if (!Array.isArray(data.items) || !data.items.length) {
  console.error('items rỗng');
  process.exit(1);
}

const items = data.items;
const seenId = new Map();
const seenContent = new Map();
const perLevel = {};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shape = (v) => JSON.stringify(Array.isArray(v) ? v : [v]);

for (const [index, it] of items.entries()) {
  const id = it?.id ?? `#${index}`;
  perLevel[it?.level] = (perLevel[it?.level] ?? 0) + 1;

  // ---------- cấu trúc ----------
  for (const key of REQUIRED) if (it[key] === undefined) fail(id, `thiếu trường ${key}`);
  if (!/^tp-[123]-\d{3}$/.test(String(it.id))) fail(id, 'id sai định dạng tp-<1|2|3>-<3 chữ số>');
  if (LEVEL_BY_PREFIX[String(it.id).split('-')[1]] !== it.level) fail(id, `id ${it.id} không khớp level ${it.level}`);
  if (!Object.values(LEVEL_BY_PREFIX).includes(it.level)) fail(id, `level không thuộc danh sách: ${it.level}`);
  if (!['single', 'word'].includes(it.type)) fail(id, 'type phải là single|word');
  if (it.uncertain === true && !it.uncertainReason) fail(id, 'uncertain=true mà thiếu uncertainReason');
  const unknown = Object.keys(it).filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k));
  if (unknown.length) fail(id, `trường không có trong schema: ${unknown.join(', ')}`);
  if (seenId.has(it.id)) fail(id, `trùng id với mục ${seenId.get(it.id)}`);
  seenId.set(it.id, index);

  const chars = [...String(it.hanzi)].filter((c) => HAN.test(c));
  const contentKey = `${it.hanzi}|${it.pinyin}`;
  if (seenContent.has(contentKey)) fail(id, `trùng nội dung (hanzi+pinyin) với ${seenContent.get(contentKey)}`);
  seenContent.set(contentKey, id);

  // ---------- số âm tiết ----------
  const toneArr = Array.isArray(it.tone) ? it.tone : [it.tone];
  if (it.type === 'single' && chars.length !== 1) fail(id, 'type single nhưng hanzi không phải 1 chữ');
  if (it.type === 'word' && chars.length < 2) fail(id, 'type word nhưng hanzi ít hơn 2 chữ');
  if (it.type === 'single' && Array.isArray(it.tone)) fail(id, 'type single thì tone phải là một số');
  if (toneArr.length !== chars.length) fail(id, `tone có ${toneArr.length} phần, hanzi có ${chars.length} chữ`);
  for (const t of toneArr) if (!TONES.has(t)) fail(id, `tone ${t} ngoài 1-5`);
  toneArr.forEach((t, i) => {
    if (t === 5 && !(i > 0 && (NEUTRAL_SUFFIX.has(chars[i]) || NEUTRAL_LEXICAL.has(String(it.hanzi))))) {
      warn(id, `âm tiết nhẹ (thanh 5) ở "${chars[i]}" không thuộc nhóm hậu tố nhẹ / từ điển ghi nhẹ`);
    }
  });

  // ---------- phương án gây nhiễu ----------
  if (!Array.isArray(it.distractors)) fail(id, 'distractors phải là mảng');
  else {
    if (it.distractors.length < 2) fail(id, 'cần ít nhất 2 phương án gây nhiễu');
    if (new Set(it.distractors.map(shape)).size !== it.distractors.length) fail(id, 'distractors trùng nhau');
    for (const d of it.distractors) {
      if (shape(d) === shape(it.tone)) fail(id, `distractors chứa chính đáp án ${shape(d)}`);
      if (Array.isArray(it.acceptTones) && it.acceptTones.some((a) => shape(a) === shape(d))) {
        fail(id, `distractors ${shape(d)} trùng một đáp án chấp nhận được trong acceptTones`);
      }
      const dd = Array.isArray(d) ? d : [d];
      if (dd.length !== toneArr.length) fail(id, `distractor ${shape(d)} sai số âm tiết`);
      for (const t of dd) if (!TONES.has(t)) fail(id, `distractor chứa thanh ${t} ngoài 1-5`);
    }
    const nearMiss = it.distractors.filter((d) => {
      const dd = Array.isArray(d) ? d : [d];
      return dd.length === toneArr.length && dd.filter((t, i) => t !== toneArr[i]).length === 1;
    });
    if (!nearMiss.length) warn(id, 'không có gây nhiễu chỉ khác 1 thanh (người học dễ đoán bừa)');
    // với mỗi âm tiết thanh 2/3/4 phải có gây nhiễu đổi đúng chỗ đó sang thanh dễ nhầm
    if (it.uncertain !== true) {
      toneArr.forEach((t, i) => {
        const partners = PARTNER[t];
        if (!partners) return;
        const covered = it.distractors.some((d) => {
          const dd = Array.isArray(d) ? d : [d];
          return dd.length === toneArr.length
            && dd.filter((x, j) => x !== toneArr[j]).length === 1
            && dd[i] !== t
            && partners.includes(dd[i]);
        });
        if (!covered) warn(id, `âm tiết ${i + 1} thanh ${t} thiếu gây nhiễu đổi đúng chỗ này sang thanh ${partners.join('/')}`);
      });
    }
  }

  // ---------- nghĩa tiếng Việt ----------
  const meaning = String(it.meaningVi ?? '');
  if (HAN.test(meaning)) fail(id, 'meaningVi lẫn chữ Hán');
  if (!VI_DIACRITICS.test(meaning)) fail(id, 'meaningVi thiếu dấu tiếng Việt');
  if (meaning.trim().length < 2) fail(id, 'meaningVi rỗng');

  // ---------- pinyin ↔ chữ Hán ----------
  const syls = String(it.pinyin).trim().split(/\s+/);
  if (syls.length !== chars.length) {
    fail(id, `pinyin có ${syls.length} âm tiết, hanzi có ${chars.length} chữ`);
    continue;
  }
  const ref = reference(it.hanzi, chars);
  const readingVariants = ALTERNATE_READINGS[String(it.hanzi)] ?? [];
  syls.forEach((s, i) => {
    const { letters, tone } = stripTone(s);
    if (letters !== ref.letters[i] && !readingVariants.includes(`${letters}${tone}`)) {
      fail(id, `âm tiết "${s}" không khớp chữ "${chars[i]}" (pinyin-pro: ${ref.letters[i]}${ref.dict[i]})`);
    }
    if (tone !== toneArr[i]) fail(id, `dấu thanh của "${s}" (=${tone}) không khớp tone [${toneArr}]`);
    if (tone !== 5 && countToneMarks(s) !== 1) warn(id, `"${s}" có ${countToneMarks(s)} dấu thanh — nên đúng 1 dấu, hoặc không dấu khi đọc nhẹ`);
  });

  // ---------- thanh gốc / bề mặt / biến điệu ----------
  const neutralAllowed = (i) => i > 0 && (NEUTRAL_SUFFIX.has(chars[i]) || NEUTRAL_LEXICAL.has(String(it.hanzi)));
  const withNeutral = (arr) => {
    const out = [arr];
    arr.forEach((_, i) => {
      if (neutralAllowed(i)) out.push(arr.map((t, j) => (j === i ? 5 : t)));
    });
    return out;
  };
  const allowed = new Set([ref.base, ref.dict, ref.surface].flatMap(withNeutral).map(shape));

  if (!allowed.has(shape(it.tone))) {
    const msg = `tone [${toneArr}] không khớp thanh gốc [${ref.base}], pinyin-pro [${ref.dict}] hay bề mặt [${ref.surface}]`;
    if (it.uncertain === true) warn(id, msg);
    else fail(id, msg);
  }
  if (Array.isArray(it.acceptTones)) {
    for (const a of it.acceptTones) if (!allowed.has(shape(a))) fail(id, `acceptTones ${shape(a)} không khớp thanh gốc/bề mặt của từ`);
    if (!it.acceptTones.some((a) => shape(a) === shape(it.tone))) fail(id, 'tone phải nằm trong acceptTones');
  }
  if (it.sandhi === true) {
    if (!same(toneArr, ref.surface)) fail(id, `sandhi=true nhưng tone [${toneArr}] != bề mặt [${ref.surface}]`);
    if (!it.baseTone) fail(id, 'sandhi=true mà thiếu baseTone');
    else if (!same(it.baseTone, ref.base)) fail(id, `baseTone [${it.baseTone}] != thanh gốc [${ref.base}]`);
    if (same(ref.base, ref.surface)) fail(id, 'sandhi=true nhưng thanh gốc và bề mặt giống nhau');
  } else if (it.baseTone && !same(it.baseTone, ref.base)) {
    fail(id, `baseTone [${it.baseTone}] != thanh gốc [${ref.base}]`);
  }
  const isCitationOnly = !same(toneArr, ref.surface) && same(toneArr, ref.base) && !same(ref.base, ref.surface);
  if (it.sandhi !== true && isCitationOnly && !Array.isArray(it.acceptTones)) {
    warn(id, `đang ghi thanh gốc [${toneArr}], đọc tự nhiên ra [${ref.surface}] — nên đặt sandhi=true hoặc thêm acceptTones`);
  }
  if (it.uncertain === true) warn(id, `mục uncertain: ${it.uncertainReason}`);
}

// ---- báo cáo ----
console.log(`File: ${FILE}`);
console.log(`Số mục: ${items.length}`);
for (const l of data.levels ?? []) console.log(`  ${l}: ${perLevel[l] ?? 0}`);
const extraLevels = Object.keys(perLevel).filter((l) => !(data.levels ?? []).includes(l));
if (extraLevels.length) fail('file', `level không khai báo ở levels: ${extraLevels.join(', ')}`);
const uncertain = items.filter((i) => i.uncertain === true).map((i) => `${i.id} (${i.hanzi})`);
console.log(`Uncertain (${uncertain.length}): ${uncertain.join(', ') || '—'}`);
console.log(`sandhi=true: ${items.filter((i) => i.sandhi === true).length}; acceptTones: ${items.filter((i) => i.acceptTones).length}; thanh nhẹ (tone 5): ${items.filter((i) => Array(i.tone).flat().includes(5)).length}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: cấu trúc, id, pinyin-pro và biến điệu đều hợp lệ.');
