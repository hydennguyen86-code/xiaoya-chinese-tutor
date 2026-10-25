// Kiểm tra content-for-misu/course-listening/ (48 file, mỗi bài trong lessons/courses một file).
//
// Kiểm tra: đủ/đúng file so với lessons/courses; 3–5 câu dictation + đúng 1 đoạn shadowing;
// schema và id của dictation.json / shadowing.json; pinyin-pro + thanh nhẹ + biến điệu 3+3;
// cụm hơi của shadowing; nghĩa tiếng Việt; focus; và mỗi câu/đoạn phải dùng từ của bài.
// Chỉ đọc lessons/courses của xiaoya, không sửa.
//
// Dùng: ELECTRON_RUN_AS_NODE=1 Qoder course-listening.check.mjs [thư-mục-course-listening]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAN, hanOnly, pauseAfter, readSentence, splitChunks, strip } from '../../server/listeningPinyin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../../lessons/listening/course');
const COURSES = process.env.XIAOYA_COURSES ? path.resolve(process.env.XIAOYA_COURSES) : path.resolve(HERE, '../../lessons/courses');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const VI = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const LEVEL_BY_PREFIX = { 1: 'HSK1-2', 3: 'HSK5-6' };
const PACE = new Set(['chậm', 'vừa', 'nhanh']);
const DT_REQUIRED = ['id', 'level', 'hanzi', 'pinyin', 'meaningVi', 'focus'];
const DT_OPTIONAL = ['sandhi', 'baseTones', 'hint', 'uncertain', 'uncertainReason', 'acceptTones'];
const SH_REQUIRED = ['id', 'level', 'text', 'pinyin', 'meaningVi', 'syllables', 'pace', 'chunks', 'focus'];
const SH_OPTIONAL = ['sandhi', 'baseTones', 'hint', 'uncertain', 'uncertainReason', 'acceptTones'];
const SAME = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Các từ mà chính sách hậu tố 的/了/子 sẽ đọc nhẹ sai. Nội dung mới không được dùng
// cho tới khi chính sách có ngoại lệ (xem review-codex.md A1).
// 目的: "项目的/题目的/节目的" là danh từ kết thúc bằng 目 + 的, không phải từ 目的.
const POLICY_TRAPS = [
  { word: '目的', re: /(?<![项题节科数])目的/ },
  { word: '的确', re: /的确/ },
  { word: '了解', re: /了解/ },
  { word: '电子', re: /电子/ },
  { word: '王子', re: /王子/ },
  { word: '男子', re: /男子/ },
  { word: '女子', re: /女子/ },
  { word: '学子', re: /学子/ },
  { word: '弟子', re: /弟子/ },
  { word: '子孙', re: /子孙/ },
  { word: '子女', re: /子女/ },
];

function courseFiles() {
  return fs
    .readdirSync(COURSES)
    .filter((f) => /^hsk[15]-practical-\d+-d[12]\.json$/.test(f))
    .sort((a, b) => {
      const parse = (s) =>
        s
          .match(/hsk(\d)-practical-(\d+)-d(\d)/)
          .slice(1)
          .map(Number);
      const A = parse(a);
      const B = parse(b);
      return A[0] - B[0] || A[1] - B[1] || A[2] - B[2];
    });
}

function checkToneSurface(id, item, r, label) {
  const syls = String(item.pinyin).trim().split(/\s+/).filter(Boolean);
  const tones = syls.map((s) => strip(s).tone);
  if (!SAME(tones, r.tones)) {
    fail(id, `${label} chuỗi thanh [${tones}] không khớp dạng đọc [${r.tones}]`);
    return;
  }
  if (r.lowered.length) {
    if (item.sandhi !== true) fail(id, 'có biến điệu 3+3 mà thiếu sandhi=true');
    if (!Array.isArray(item.baseTones)) fail(id, 'thiếu baseTones');
    else if (!SAME(item.baseTones, r.dict)) fail(id, `baseTones [${item.baseTones}] không khớp [${r.dict}]`);
    if (!Array.isArray(item.acceptTones) || !item.acceptTones.some((t) => SAME(t, r.tones))) {
      fail(id, 'acceptTones phải chứa dạng đọc thật');
    }
    if (!Array.isArray(item.acceptTones) || !item.acceptTones.some((t) => SAME(t, r.citation))) {
      fail(id, 'acceptTones phải chứa dạng trích dẫn');
    }
  } else {
    if (item.sandhi === true) fail(id, 'sandhi=true nhưng không có cặp 3+3 nào bị hạ');
    if (item.baseTones !== undefined) fail(id, 'có baseTones nhưng sandhi không bật');
  }
}

function checkMeaningAndFocus(id, item) {
  const meaning = String(item.meaningVi ?? '');
  if (HAN.test(meaning)) fail(id, 'meaningVi lẫn chữ Hán');
  if (!VI.test(meaning)) fail(id, 'meaningVi thiếu dấu tiếng Việt');
  if (meaning.trim().length < 3) fail(id, 'meaningVi quá ngắn');
  const focus = Array.isArray(item.focus) ? item.focus : null;
  if (!focus || !focus.length) fail(id, 'focus phải là mảng không rỗng');
  else
    for (const f of focus) {
      if (typeof f !== 'string' || f.trim().length < 3) fail(id, `focus "${f}" không hợp lệ`);
      else if (!VI.test(f) && !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(f)) fail(id, `focus "${f}" thiếu dấu`);
    }
}

// Dòng focus dạng "消息 xiāo xi: 息 nhẹ" phải khớp pinyin thật của mục.
// Chỉ nhận chữ cái pinyin (kể cả dấu thanh), để không bắt nhầm chữ Việt như "nhẹ ở chữ thứ hai".
const PY = '[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]+';
function checkNeutralClaims(id, item, text, syls) {
  for (const line of Array.isArray(item.focus) ? item.focus : []) {
    if (!/nhẹ/.test(line)) continue;
    const m = String(line).match(new RegExp(`([\\p{Script=Han}]{2,4})\\s+(${PY}(?:\\s+${PY})+)`, 'u'));
    if (!m) continue;
    const claim = m[2].split(/\s+/);
    if (strip(claim[claim.length - 1]).tone !== 5) continue;
    const pos = text.indexOf(m[1]);
    if (pos < 0) continue;
    const target = syls[pos + claim.length - 1];
    if (target && strip(target).tone !== 5) {
      fail(id, `focus nói "${m[1]} ${claim.join(' ')}" đọc nhẹ nhưng pinyin là "${target}"`);
    }
  }
}

if (!fs.existsSync(DIR)) {
  console.error(`Không có thư mục ${DIR}`);
  process.exit(1);
}

const expected = courseFiles().map((f) => f.replace(/\.json$/, ''));
const actual = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();
for (const f of expected) if (!actual.includes(f)) fail('file', `thiếu ${f}.json`);
for (const f of actual) if (!expected.includes(f)) fail('file', `thừa ${f}.json (không có bài tương ứng)`);
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) warn('file', `${f}: file không phải JSON — kiểm tra không đọc`);
}

const ids = new Map();
const texts = new Map();
const counts = { 'HSK1-2': 0, 'HSK5-6': 0 };
let totalDt = 0;
let totalSh = 0;

for (const file of expected) {
  const full = path.join(DIR, `${file}.json`);
  if (!fs.existsSync(full)) continue;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    fail(file, `JSON hỏng: ${e.message}`);
    continue;
  }
  const lesson = JSON.parse(fs.readFileSync(path.join(COURSES, `${file}.json`), 'utf8'));
  const level = file.startsWith('hsk1') ? 'HSK1-2' : 'HSK5-6';
  const prefix = file.startsWith('hsk1') ? 1 : 3;
  const vocab = lesson.vocab.map((v) => v.word);
  const prevFile = file.replace(/-d2$/, '-d1');
  const prevPath = path.join(COURSES, `${prevFile}.json`);
  const prevVocab =
    file.endsWith('-d2') && fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')).vocab.map((v) => v.word) : [];
  const newWords = vocab.filter((w) => !prevVocab.includes(w));
  const used = new Set();

  if (doc.source !== 'AI soạn, chưa duyệt') fail(file, `source phải là "AI soạn, chưa duyệt"`);
  if (doc.kind !== 'course-listening') fail(file, 'kind phải là "course-listening"');
  if (doc.lesson !== file) fail(file, `lesson phải là ${file}`);
  if (doc.level !== level) fail(file, `level phải là ${level}`);
  if (doc.title !== lesson.lessonTitle) warn(file, `title khác lessonTitle: ${JSON.stringify(doc.title)}`);

  const dt = doc.dictation;
  if (!Array.isArray(dt) || dt.length < 3 || dt.length > 5) {
    fail(file, `dictation phải có 3–5 câu, đang có ${Array.isArray(dt) ? dt.length : 0}`);
  } else {
    for (const [i, it] of dt.entries()) {
      const id = `${file}/dictation[${i}]`;
      for (const k of DT_REQUIRED) if (it[k] === undefined) fail(id, `thiếu ${k}`);
      for (const k of Object.keys(it)) if (!DT_REQUIRED.includes(k) && !DT_OPTIONAL.includes(k)) fail(id, `trường lạ ${k}`);
      if (!/^dt-[13]-\d{3}$/.test(String(it.id))) fail(id, `id sai định dạng dt-<1|3>-<3 số>`);
      if (String(it.id).split('-')[1] !== String(prefix)) fail(id, `id ${it.id} không khớp cấp ${prefix}`);
      if (ids.has(it.id)) fail(id, `trùng id với ${ids.get(it.id)}`);
      ids.set(it.id, file);
      if (it.level !== level) fail(id, `level phải là ${level}`);
      if (it.uncertain === true && !it.uncertainReason) fail(id, 'uncertain mà thiếu uncertainReason');
      if (!/[，。？！]/.test(String(it.hanzi))) warn(id, 'câu thiếu dấu câu');
      const text = hanOnly(it.hanzi);
      if (!text) {
        fail(id, 'không có chữ Hán');
        continue;
      }
      if (texts.has(text)) fail(id, `trùng câu với ${texts.get(text)}`);
      texts.set(text, file);
      for (const trap of POLICY_TRAPS)
        if (trap.re.test(text)) fail(id, `chứa "${trap.word}" — chính sách âm nhẹ sẽ đọc sai; đổi câu hoặc bổ sung ngoại lệ`);
      if (!vocab.some((w) => text.includes(w))) fail(id, 'không dùng từ nào của bài');
      else vocab.forEach((w) => text.includes(w) && used.add(w));

      const syls = String(it.pinyin).trim().split(/\s+/).filter(Boolean);
      if (/[，。？！、；：,.;:!?—…]/.test(it.pinyin)) fail(id, 'pinyin chứa dấu câu');
      if (/\s{2,}/.test(it.pinyin)) fail(id, 'pinyin có khoảng trắng liên tiếp');
      if (syls.length !== [...text].length) fail(id, `pinyin ${syls.length} âm tiết nhưng có ${text.length} chữ Hán`);
      else {
        const r = readSentence(text, [], [], { allSandhi: true, pauses: pauseAfter(it.hanzi) });
        if (it.pinyin !== r.pinyin) fail(id, `pinyin không khớp dạng sinh: "${it.pinyin}" ≠ "${r.pinyin}"`);
        checkToneSurface(id, it, r, 'dictation');
      }
      checkMeaningAndFocus(id, it);
      checkNeutralClaims(id, it, text, syls);
      counts[level] += 1;
      totalDt += 1;
    }
  }

  const sh = doc.shadowing;
  if (!Array.isArray(sh) || sh.length !== 1) {
    fail(file, `shadowing phải có đúng 1 đoạn, đang có ${Array.isArray(sh) ? sh.length : 0}`);
  } else {
    const it = sh[0];
    const id = `${file}/shadowing[0]`;
    for (const k of SH_REQUIRED) if (it[k] === undefined) fail(id, `thiếu ${k}`);
    for (const k of Object.keys(it)) if (!SH_REQUIRED.includes(k) && !SH_OPTIONAL.includes(k)) fail(id, `trường lạ ${k}`);
    if (!/^sh-[13]-\d{2}$/.test(String(it.id))) fail(id, 'id sai định dạng sh-<1|3>-<2 số>');
    if (String(it.id).split('-')[1] !== String(prefix)) fail(id, `id ${it.id} không khớp cấp ${prefix}`);
    if (ids.has(it.id)) fail(id, `trùng id với ${ids.get(it.id)}`);
    ids.set(it.id, file);
    if (it.level !== level) fail(id, `level phải là ${level}`);
    if (!PACE.has(it.pace)) fail(id, `pace phải là chậm/vừa/nhanh`);
    if (!/[。？！]/.test(String(it.text))) warn(id, 'đoạn thiếu dấu kết câu');
    const text = hanOnly(it.text);
    if (texts.has(text)) fail(id, `trùng đoạn với ${texts.get(text)}`);
    texts.set(text, file);
    for (const trap of POLICY_TRAPS) if (trap.re.test(text)) fail(id, `chứa "${trap.word}" — chính sách âm nhẹ sẽ đọc sai`);
    const hit = vocab.filter((w) => text.includes(w));
    hit.forEach((w) => used.add(w));
    if (hit.length < 2) fail(id, `chỉ dùng ${hit.length} từ của bài; cần ít nhất 2 (${vocab.join(', ')})`);
    if (newWords.length && !newWords.some((w) => text.includes(w))) {
      fail(id, `không dùng từ mới của buổi: ${newWords.join(', ')}`);
    }

    if (it.syllables !== [...text].length) fail(id, `syllables=${it.syllables}, thực tế ${text.length}`);
    const syls = String(it.pinyin).trim().split(/\s+/).filter(Boolean);
    if (/[，。？！、；：,.;:!?—…]/.test(it.pinyin)) fail(id, 'pinyin chứa dấu câu');
    if (/\s{2,}/.test(it.pinyin)) fail(id, 'pinyin có khoảng trắng liên tiếp');
    if (syls.length !== [...text].length) fail(id, `pinyin ${syls.length} âm tiết nhưng có ${text.length} chữ Hán`);

    const r = readSentence(text, [], [], { allSandhi: true, pauses: pauseAfter(it.text) });
    if (it.pinyin !== r.pinyin) fail(id, `pinyin không khớp dạng sinh: "${it.pinyin}" ≠ "${r.pinyin}"`);
    checkToneSurface(id, it, r, 'shadowing');

    const chunks = it.chunks;
    if (!Array.isArray(chunks) || chunks.length < 3)
      fail(id, `chunks phải có ≥3 cụm, đang có ${Array.isArray(chunks) ? chunks.length : 0}`);
    else {
      let offset = 0;
      for (const [i, c] of chunks.entries()) {
        if (typeof c.hanzi !== 'string' || !c.hanzi) fail(id, `chunks[${i}].hanzi rỗng`);
        if (!['soft', 'hard', 'end'].includes(c.pause)) fail(id, `chunks[${i}].pause không hợp lệ`);
        if (i === chunks.length - 1 && c.pause !== 'end') fail(id, 'cụm cuối phải pause=end');
        if (i < chunks.length - 1 && c.pause === 'end') fail(id, `chunks[${i}] pause=end nhưng chưa phải cụm cuối`);
        if (HAN.test(c.hanzi)) {
          const n = [...c.hanzi].length;
          const want = r.parts.slice(offset, offset + n).join(' ');
          if (String(c.pinyin).trim() !== want) fail(id, `chunks[${i}].pinyin không khớp pinyin cả đoạn`);
          if (text.slice(offset, offset + n) !== c.hanzi) fail(id, `chunks[${i}] lệch thứ tự chữ Hán`);
        }
        offset += [...c.hanzi].length;
      }
      if (chunks.map((c) => c.hanzi).join('') !== text) fail(id, 'ghép chunks không bằng chữ Hán của text');
      const expectedChunks = splitChunks(it.text).length;
      if (chunks.length !== expectedChunks) warn(id, `có ${chunks.length} cụm, tách theo dấu câu được ${expectedChunks}`);
    }
    checkMeaningAndFocus(id, it);
    checkNeutralClaims(id, it, text, syls);
    counts[level] += 1;
    totalSh += 1;
  }

  const missing = newWords.filter((w) => !used.has(w));
  if (missing.length) fail(file, `từ mới của buổi chưa xuất hiện ở đâu: ${missing.join(', ')}`);
}

console.log(`Thư mục: ${DIR}`);
console.log(`File: ${actual.length}/${expected.length}`);
console.log(`Dictation: ${totalDt} câu — HSK1-2 ${counts['HSK1-2']} (gồm cả shadowing), HSK5-6 ${counts['HSK5-6']}`);
console.log(`Shadowing: ${totalSh} đoạn`);
console.log(`ID duy nhất: ${ids.size}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: đủ file, schema, id, pinyin, cụm hơi, nghĩa và từ vựng của bài đều hợp lệ.');
