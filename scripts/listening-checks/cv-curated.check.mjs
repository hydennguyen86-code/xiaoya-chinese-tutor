// Kiểm tra content-for-misu/cv-curated.json
//
// Đọc lại TSV Common Voice (CHỈ ĐỌC) để xác nhận từng sentence_id có thật và đúng câu.
// Kiểm tra: metadata, đúng 4 trường mỗi mục, id 64 hex duy nhất, câu không trùng,
// level hợp lệ và đủ mỗi bậc, meaningVi tiếng Việt có dấu, focus không rỗng,
// không có trường cấm (path/client_id/audio/sentence...), và lọc sơ câu bách khoa/địa danh.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../../lessons/listening/cv-curated.json');
const DIR = process.env.XIAOYA_COMMON_VOICE_DIR;
if (!DIR) { console.error('Set XIAOYA_COMMON_VOICE_DIR to the external corpus (read only).'); process.exit(1); }

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const PUNCT = /[，。！？、；：""''（）…—\s]/u;
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const FOREIGN = /\b(please|sorry|hello|thank|thanks|and|the|with|from|this|that|people|time|audio|file)\b/i;
const TRAD = new Set([...'們個這說時間學國會對開關麼樣現實發經過還進來裡後兒幾聽話語讀寫買賣錢車門問題歡覺讓給帶頭長準妳']);
const ENCYCLO = /位于|成立于|建立于|建于|被誉为|被称为|进士|皇帝|总统|总理|主教|教区|寺院|活佛|政党|议员|部长|将军|司令|公里|千米|平方|人口|面积|省|市|县|镇|岛|山脉/u;
const ALLOWED_KEYS = ['sentence_id', 'level', 'meaningVi', 'focus'];

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

if (data.source !== 'AI soạn, chưa duyệt') fail('file', `source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'cv-curated') fail('file', 'kind phải là "cv-curated"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) fail('file', 'thiếu levels (3 bậc)');
if (!data.schema) fail('file', 'thiếu mô tả schema');
if (!data.note) fail('file', 'thiếu note giải thích cách dùng');

// đọc lại TSV, chỉ giữ sentence_id -> sentence
const corpus = new Map();
for (const split of ['train', 'dev', 'test']) {
  const file = path.join(DIR, `${split}.tsv`);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`Không đọc được ${file} (chỉ đọc): ${e.message}`);
    process.exit(1);
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split('\t');
  const iId = head.indexOf('sentence_id');
  const iSentence = head.indexOf('sentence');
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const id = c[iId] ?? '';
    if (/^[0-9a-f]{64}$/.test(id)) corpus.set(id, (c[iSentence] ?? '').trim());
  }
}

const items = Array.isArray(data.items) ? data.items : [];
if (items.length < 150 || items.length > 300) fail('file', `cần 150–300 câu, đang có ${items.length}`);

const perLevel = {};
const seenId = new Set();
const seenText = new Map();

items.forEach((it, i) => {
  const label = it?.sentence_id ? `#${i + 1} ${String(it.sentence_id).slice(0, 8)}` : `#${i + 1}`;
  const keys = Object.keys(it ?? {}).sort();
  if (keys.length !== ALLOWED_KEYS.length || !ALLOWED_KEYS.every((k) => keys.includes(k))) {
    fail(label, `mỗi mục chỉ được có ${ALLOWED_KEYS.join(', ')}; đang có ${keys.join(', ')}`);
  }
  for (const forbidden of ['path', 'client_id', 'audio', 'sentence', 'hanzi', 'text', 'pinyin']) {
    if (forbidden in (it ?? {})) fail(label, `không được chứa trường "${forbidden}"`);
  }

  const id = String(it.sentence_id ?? '');
  if (!/^[0-9a-f]{64}$/.test(id)) fail(label, 'sentence_id phải là 64 ký tự hex thường');
  if (seenId.has(id)) fail(label, 'trùng sentence_id');
  seenId.add(id);

  const sentence = corpus.get(id);
  if (sentence === undefined) {
    fail(label, `sentence_id không có trong TSV (${id})`);
    return;
  }
  if (!sentence) fail(label, 'câu trong TSV rỗng');
  if (/[A-Za-z0-9]/.test(sentence)) fail(label, `câu trong TSV còn chữ Latin/số: "${sentence}"`);
  if ([...sentence].some((ch) => !HAN.test(ch) && !PUNCT.test(ch))) fail(label, `câu có ký tự lạ: "${sentence}"`);
  if ([...sentence].some((ch) => TRAD.has(ch))) fail(label, `câu có chữ phồn thể: "${sentence}"`);
  const hanCount = [...sentence].filter((ch) => HAN.test(ch)).length;
  if (hanCount < 4 || hanCount > 32) fail(label, `câu có ${hanCount} chữ Hán — cần 4–32`);
  if (ENCYCLO.test(sentence)) warn(label, `câu còn dấu hiệu bách khoa/địa danh: "${sentence}"`);
  if (seenText.has(sentence)) fail(label, `trùng câu với ${seenText.get(sentence)}`);
  seenText.set(sentence, label);

  if (!(data.levels ?? []).includes(it.level)) fail(label, `level "${it.level}" không nằm trong levels`);
  perLevel[it.level] = (perLevel[it.level] ?? 0) + 1;

  const meaning = String(it.meaningVi ?? '').trim();
  if (!meaning) fail(label, 'thiếu meaningVi');
  if (HAN.test(meaning)) fail(label, 'meaningVi lẫn chữ Hán');
  if (FOREIGN.test(` ${meaning} `)) warn(label, 'meaningVi lẫn từ tiếng Anh — nghĩa phải viết bằng tiếng Việt');
  if (!VI_DIACRITICS.test(meaning) && meaning.length >= 12) fail(label, 'meaningVi thiếu dấu tiếng Việt');
  if (meaning.length < 8) fail(label, 'meaningVi quá ngắn');

  const focus = Array.isArray(it.focus) ? it.focus : null;
  if (!focus || !focus.length) fail(label, 'focus phải là mảng không rỗng');
  else {
    if (focus.length > 3) warn(label, `${focus.length} dòng focus — nên gọn còn 1–3`);
    for (const f of focus) {
      if (typeof f !== 'string' || f.trim().length < 8) fail(label, `focus "${f}" quá ngắn`);
      if (typeof f === 'string' && FOREIGN.test(` ${f} `)) warn(label, `focus "${f}" lẫn từ tiếng Anh`);
      if (typeof f === 'string' && /\?\s*—/.test(f)) fail(label, `focus "${f}" còn dấu vết bản nháp`);
    }
  }
});

for (const l of data.levels ?? []) {
  if ((perLevel[l] ?? 0) < 20) fail('file', `${l}: chỉ có ${perLevel[l] ?? 0} câu — mỗi bậc cần ít nhất 20`);
}

console.log(`File: ${FILE}`);
console.log(`Số câu: ${items.length}`);
for (const l of data.levels ?? []) console.log(`  ${l}: ${perLevel[l] ?? 0}`);
console.log(`ID duy nhất: ${seenId.size}; câu duy nhất: ${seenText.size}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: metadata, 4 trường, sentence_id, câu gốc, bậc, nghĩa và focus đều hợp lệ.');
