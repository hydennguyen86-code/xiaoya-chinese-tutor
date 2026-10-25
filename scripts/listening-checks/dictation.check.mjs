// Kiểm tra content-for-misu/dictation.json
// Chạy:  ELECTRON_RUN_AS_NODE=1 /Applications/Qoder.app/Contents/MacOS/Qoder content-for-misu/dictation.check.mjs [đường-dẫn-json]
//
// Kiểm tra: cấu trúc, id duy nhất, số câu mỗi bậc, pinyin khớp chữ Hán theo pinyin-pro
// (chấp nhận thanh bề mặt sau biến điệu 一/不 và 3+3), meaningVi thuần tiếng Việt có dấu,
// focus không rỗng, và độ dài câu tăng dần trong từng bậc.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'dictation.json');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const LEVEL_BY_PREFIX = { 1: 'HSK1-2', 2: 'HSK3-4', 3: 'HSK5-6' };
const PER_LEVEL = 60;
const SAME = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Âm tiết viết không dấu = thanh nhẹ; chỉ chấp nhận ở chữ/hậu tố thường đọc nhẹ.
// Hai danh sách dưới đây phải khớp NEUTRAL / NEUTRAL_SUFFIX trong _make-dictation.mjs.
const NEUTRAL_SUFFIX = new Set(['们', '么', '的', '了', '吧', '吗', '呢', '啊', '呀', '哦', '嘛']);
const NEUTRAL_LEXICAL = {
  朋友: [1], 妈妈: [1], 爸爸: [1], 哥哥: [1], 姐姐: [1], 弟弟: [1], 妹妹: [1],
  什么: [1], 桌子: [1], 椅子: [1], 东西: [1], 谢谢: [1], 觉得: [1], 知道: [1],
  时候: [1], 漂亮: [1], 衣服: [1], 玻璃: [1], 豆腐: [1], 萝卜: [1], 葡萄: [1],
  客气: [1], 便宜: [1], 休息: [1], 名字: [1], 右边: [1], 左边: [1], 爷爷: [1], 奶奶: [1],
  早上: [1], 晚上: [1], 商量: [1], 明白: [1],
};

/** các vị trí âm tiết được phép đọc nhẹ trong câu */
function neutralSlots(text) {
  const allowed = new Set();
  for (const [word, idxs] of Object.entries(NEUTRAL_LEXICAL)) {
    let start = text.indexOf(word);
    while (start >= 0) {
      for (const k of idxs) allowed.add(start + k);
      start = text.indexOf(word, start + word.length);
    }
  }
  [...text].forEach((c, i) => {
    if (i > 0 && NEUTRAL_SUFFIX.has(c)) allowed.add(i);
  });
  return allowed;
}

const TONE_MARK = { '\u0300': 4, '\u0301': 2, '\u0304': 1, '\u030C': 3 };

/** { letters: bỏ dấu thanh, giữ ü; tone: 1-4 hoặc 5 khi không có dấu } */
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

const hanOnly = (str) => [...String(str)].filter((c) => HAN.test(c)).join('');

// pinyin-pro theo cả câu: tự phân từ nên phân biệt đa âm (银行 vs 行走) và đã gộp biến điệu 一/不.
// Nó KHÔNG áp biến điệu 3+3, nên surface bên dưới mới thêm.
function reference(text) {
  const parsed = pinyin(text, { pattern: 'tone', type: 'array' }).map((s) => stripTone(s));
  const letters = parsed.map((p) => p.letters);
  const dict = parsed.map((p) => p.tone);
  const chars = [...text];
  const base = dict.map((t, i) => (chars[i] === '一' ? 1 : chars[i] === '不' ? 4 : t));
  const surface = [...dict];
  for (let i = 0; i + 1 < surface.length; i += 1) if (surface[i] === 3 && surface[i + 1] === 3) surface[i] = 2;
  return { letters, dict, base, surface, chars };
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

if (data.source !== 'AI soạn, chưa duyệt') fail('file', `source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'dictation') fail('file', 'kind phải là "dictation"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) fail('file', 'thiếu levels (3 bậc)');
if (!data.schema) fail('file', 'thiếu mô tả schema');
if (!Array.isArray(data.items) || !data.items.length) {
  console.error('items rỗng');
  process.exit(1);
}

const REQUIRED = ['id', 'level', 'hanzi', 'pinyin', 'meaningVi', 'focus'];
const OPTIONAL = ['sandhi', 'baseTones', 'hint', 'uncertain', 'uncertainReason', 'acceptTones'];

const items = data.items;
const seenId = new Map();
const seenHanzi = new Map();
const perLevel = {};
const lengths = {};

for (const [index, it] of items.entries()) {
  const id = it?.id ?? `#${index}`;
  perLevel[it?.level] = (perLevel[it?.level] ?? 0) + 1;

  for (const key of REQUIRED) if (it[key] === undefined) fail(id, `thiếu trường ${key}`);
  for (const key of Object.keys(it)) {
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) fail(id, `trường không có trong schema: ${key}`);
  }
  if (!/^dt-[123]-\d{3}$/.test(String(it.id))) fail(id, 'id sai định dạng dt-<1|2|3>-<số 3 chữ số>');
  const prefix = String(it.id).split('-')[1];
  if (LEVEL_BY_PREFIX[prefix] !== it.level) fail(id, `id ${it.id} không khớp level ${it.level}`);
  if (!Object.values(LEVEL_BY_PREFIX).includes(it.level)) fail(id, `level không thuộc danh sách: ${it.level}`);
  if (seenId.has(it.id)) fail(id, `trùng id với mục ${seenId.get(it.id)}`);
  seenId.set(it.id, index);
  if (seenHanzi.has(it.hanzi)) fail(id, `trùng câu với ${seenHanzi.get(it.hanzi)}`);
  seenHanzi.set(it.hanzi, id);
  if (it.uncertain === true && !it.uncertainReason) fail(id, 'uncertain=true mà thiếu uncertainReason');

  const text = hanOnly(it.hanzi);
  const chars = [...text];
  const syls = String(it.pinyin).trim().split(/\s+/).filter(Boolean);
  (lengths[it.level] ??= []).push({ id, n: chars.length });

  if (!/[，。？！]/.test(String(it.hanzi))) warn(id, 'câu không có dấu câu — người học khó nhận ranh giới cụm');

  if (syls.length !== chars.length) {
    fail(id, `pinyin có ${syls.length} âm tiết nhưng câu có ${chars.length} chữ Hán`);
    continue;
  }

  const ref = reference(text);
  const tones = syls.map((s) => stripTone(s).tone);
  const allowedNeutral = neutralSlots(text);

  // 1) từng âm tiết khớp chữ Hán
  syls.forEach((s, i) => {
    const { letters, tone } = stripTone(s);
    if (letters !== ref.letters[i]) {
      fail(id, `"${s}" không khớp "${chars[i]}" (pinyin-pro: ${ref.letters[i]}${ref.dict[i]})`);
    }
    if (tone === 5 && ref.dict[i] !== 5 && !allowedNeutral.has(i)) {
      warn(id, `âm tiết nhẹ "${s}" ở chữ "${chars[i]}" — pinyin-pro báo thanh ${ref.dict[i]}`);
    }
  });

  // 2) cả chuỗi thanh phải là một dạng đọc hợp lệ: pinyin-pro + mọi tập con vị trí được đọc
  //    nhẹ + mọi tập con cặp 3+3 được biến điệu (biến điệu chỉ xảy ra trong phạm vi từ/cụm chặt).
  const neutralIdx = [...allowedNeutral].filter((i) => i > 0 && i < tones.length && tones[i] === 5);
  const pairs33 = [];
  for (let i = 0; i + 1 < ref.dict.length; i += 1) if (ref.dict[i] === 3 && ref.dict[i + 1] === 3) pairs33.push(i);
  const variants = new Set();
  for (let nm = 0; nm < 1 << neutralIdx.length; nm += 1) {
    for (let sm = 0; sm < 1 << Math.min(pairs33.length, 12); sm += 1) {
      const cand = [...ref.dict];
      neutralIdx.forEach((pos, b) => {
        if (nm & (1 << b)) cand[pos] = 5;
      });
      pairs33.forEach((pos, b) => {
        if (sm & (1 << b)) cand[pos] = 2;
      });
      variants.add(JSON.stringify(cand));
    }
  }
  for (const at of Array.isArray(it.acceptTones) ? it.acceptTones : []) variants.add(JSON.stringify(at));
  if (!variants.has(JSON.stringify(tones))) {
    const msg = `chuỗi thanh [${tones}] không khớp pinyin-pro [${ref.dict}] hay bề mặt sau biến điệu [${ref.surface}]`;
    if (it.uncertain === true) warn(id, msg);
    else fail(id, msg);
  }
  if (it.sandhi === true) {
    if (SAME(tones, ref.dict)) fail(id, 'sandhi=true nhưng chuỗi thanh không khác gì pinyin-pro');
    if (!Array.isArray(it.baseTones)) fail(id, 'sandhi=true mà thiếu baseTones');
    else if (!SAME(it.baseTones, ref.base) && !SAME(it.baseTones, ref.dict)) {
      fail(id, `baseTones [${it.baseTones}] không khớp thanh gốc [${ref.base}]`);
    }
    if (!it.hint) warn(id, 'sandhi=true nên kèm hint giải thích biến điệu');
  } else {
    const citation = [...ref.dict];
    for (const i of allowedNeutral) if (i > 0 && i < citation.length) citation[i] = 5;
    if (!SAME(tones, citation) && !SAME(tones, ref.dict)) {
      warn(id, 'dạng thanh khác pinyin-pro mà không đánh dấu sandhi — nên đặt sandhi=true kèm baseTones');
    }
  }

  // 3) nghĩa tiếng Việt
  const meaning = String(it.meaningVi ?? '');
  if (HAN.test(meaning)) fail(id, 'meaningVi lẫn chữ Hán');
  if (!VI_DIACRITICS.test(meaning)) fail(id, 'meaningVi thiếu dấu tiếng Việt');
  if (meaning.trim().length < 3) fail(id, 'meaningVi quá ngắn');

  // 4) focus
  const focus = Array.isArray(it.focus) ? it.focus : null;
  if (!focus) fail(id, 'focus phải là mảng');
  else {
    if (!focus.length) fail(id, 'focus rỗng — câu nào cũng phải nói rõ người học cần nghe gì');
    for (const f of focus) {
      if (typeof f !== 'string' || f.trim().length < 3) fail(id, `focus "${f}" không hợp lệ`);
      else if (!VI_DIACRITICS.test(f) && !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(f)) {
        fail(id, `focus "${f}" thiếu dấu (tiếng Việt hoặc pinyin)`);
      }
    }
  }
  if (it.uncertain === true) warn(id, `mục uncertain: ${it.uncertainReason}`);
}

for (const l of data.levels ?? []) {
  const n = perLevel[l] ?? 0;
  if (n !== PER_LEVEL) fail('file', `${l}: cần ${PER_LEVEL} câu, đang có ${n}`);
}
const extra = Object.keys(perLevel).filter((l) => !(data.levels ?? []).includes(l));
if (extra.length) fail('file', `level không khai báo: ${extra.join(', ')}`);

// 5) thứ tự ngắn → dài
for (const [level, list] of Object.entries(lengths)) {
  for (let i = 1; i < list.length; i += 1) {
    const drop = list[i - 1].n - list[i].n;
    if (drop > 2) warn(level, `${list[i].id} ngắn hơn ${drop} âm tiết so với ${list[i - 1].id} — chưa đúng thứ tự ngắn → dài`);
  }
  const half = Math.floor(list.length / 2);
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const first = med(list.slice(0, half).map((x) => x.n));
  const second = med(list.slice(half).map((x) => x.n));
  if (first > second) fail(level, 'nửa sau không dài hơn nửa đầu — sắp lại theo độ dài');
}

console.log(`File: ${FILE}`);
console.log(`Số câu: ${items.length}`);
for (const l of data.levels ?? []) {
  const n = (lengths[l] ?? []).map((x) => x.n);
  if (n.length) console.log(`  ${l}: ${perLevel[l] ?? 0} câu, ${Math.min(...n)}–${Math.max(...n)} âm tiết`);
}
const uncertain = items.filter((i) => i.uncertain === true).map((i) => i.id);
console.log(`Mục uncertain (${uncertain.length}): ${uncertain.join(', ') || '—'}`);
console.log(`Câu có biến điệu (sandhi=true): ${items.filter((i) => i.sandhi === true).length}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: cấu trúc, id, pinyin-pro, nghĩa tiếng Việt và thứ tự độ dài đều hợp lệ.');
