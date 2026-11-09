// Dựng phần nghe của một buổi từ file soạn tay (lessons/authoring/<khoá>/<buổi>.json):
//   1. lessons/courses/<buổi>.json → khối `listening` (hội thoại 甲/乙, bản dịch từng lượt A:/B:,
//      pinyin trích dẫn, câu hỏi nghe hiểu)
//   2. lessons/listening/course/<buổi>.json → dictation + shadowing (pinyin dạng đọc thật,
//      biến điệu 3+3, cụm hơi), id cấp tự động và giữ nguyên ở lần dựng lại.
// Người soạn chỉ viết chữ Hán, nghĩa và ghi chú; mọi pinyin đều sinh bằng cùng hàm mà
// checker dùng, nên không có chuyện gõ tay lệch. Pinyin sinh tự động vẫn có thể sai ở chữ
// đa âm: khai báo `readings` (chữ → pinyin mong muốn) để script báo khi lệch.
//
// Dùng: node scripts/build-course-listening.mjs lessons/authoring/misu30/*.json [--check]
//   --check: chỉ kiểm, không ghi file.   --print: in pinyin sinh ra để soát ghi chú phát âm.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hanOnly, pauseAfter, readSentence, splitChunks } from '../server/listeningPinyin.mjs';
import { pinyinCitation, syllableCount, syllableIndexMap, HAN } from '../src/lib/coursePinyin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COURSES = path.join(ROOT, 'lessons/courses');
const LISTEN = path.join(ROOT, 'lessons/listening/course');
const VI = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const LEVEL_PREFIX = { 'HSK1-2': 1, 'HSK3-4': 2, 'HSK5-6': 3 };
const TURNS = { 'HSK1-2': [6, 10], 'HSK3-4': [8, 12], 'HSK5-6': [8, 14] };
const PACE = { 'HSK1-2': 'chậm', 'HSK3-4': 'vừa', 'HSK5-6': 'vừa' };
const NOTE =
  'Nghe gắn với bài: dictation dùng đúng schema items của lessons/listening/dictation.json; shadowing dùng đúng schema items của lessons/listening/shadowing.json. File không chứa audio. Pinyin ở dạng đọc thành tiếng: đã áp biến điệu 一/不, thanh nhẹ và mọi cặp 3+3 trong cùng cụm hơi (dấu câu chặn biến điệu).';
const OLD_NOTE = /^Bài nghe nhận nghĩa dùng câu ví dụ của bài/;
const NEW_NOTE =
  'Bài nghe là một hội thoại ngắn dùng từ và mẫu câu của bài: nghe trước, trả lời câu hỏi, rồi mới mở bản dịch. Phần chép chính tả và nói đuổi đi kèm dùng lại các từ mới.';
const TRAPS = ['目的', '的确', '了解', '电子', '王子', '男子', '女子', '学子', '弟子', '子孙', '子女'];

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const PRINT = args.includes('--print');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('Cần ít nhất một file soạn.');
  process.exit(2);
}

// Id đã dùng ở các file nghe không nằm trong lượt dựng này.
const building = new Set(files.map((f) => path.basename(f, '.json')));
const used = new Set();
const bankIds = (file) => {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const items = Array.isArray(d) ? d : (d.items ?? [...(d.dictation ?? []), ...(d.shadowing ?? [])]);
  for (const it of items) used.add(it.id);
};
for (const f of fs.readdirSync(LISTEN)) if (f.endsWith('.json') && !building.has(f.replace(/\.json$/, ''))) bankIds(path.join(LISTEN, f));
for (const f of ['dictation.json', 'shadowing.json']) bankIds(path.join(ROOT, 'lessons/listening', f));
// Cấp id mới sau id lớn nhất đang có của cùng loại/cấp (không lấp chỗ trống, để id cũ đã
// xoá không bị tái dùng cho câu khác).
function nextId(kind, prefix) {
  const width = kind === 'dt' ? 3 : 2;
  const re = new RegExp(`^${kind}-${prefix}-(\\d+)$`);
  const max = Math.max(0, ...[...used].map((id) => Number(String(id).match(re)?.[1] ?? 0)));
  for (let n = max + 1; ; n += 1) {
    const id = `${kind}-${prefix}-${String(n).padStart(width, '0')}`;
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
}

const problems = [];
const bad = (file, msg) => problems.push(`${file}: ${msg}`);

function surface(text) {
  const han = hanOnly(text);
  const r = readSentence(han, [], [], { allSandhi: true, pauses: pauseAfter(text) });
  const extra = {};
  if (r.lowered.length) {
    extra.sandhi = true;
    extra.baseTones = r.citation;
    extra.acceptTones = [r.tones, r.citation];
  }
  return { han, r, extra };
}

function checkReadings(file, where, text, readings) {
  if (!readings) return;
  const chars = [...text];
  const toks = pinyinCitation(text).split(/\s+/);
  // Ghép token với chữ Hán (bỏ dấu câu/儿 hoá như pinyinCitation)
  let t = 0;
  chars.forEach((c, i) => {
    if (!HAN.test(c)) {
      if (toks[t] !== undefined && !/\p{L}/u.test(toks[t])) t += 1;
      else if (/[A-Za-z0-9]/.test(c)) t += 0; // Latin gộp, hiếm
      return;
    }
    if (c === '儿' && /r$/.test(toks[t - 1] ?? '') && ['点', '这', '哪', '那', '会', '事'].includes(chars[i - 1])) return;
    const want = readings[c];
    const got = toks[t];
    if (want && got && got.replace(/r$/, '') !== want && got !== want)
      bad(file, `${where}: chữ ${c} sinh "${got}", người soạn muốn "${want}" — "${text}"`);
    t += 1;
  });
}

for (const src of files) {
  const a = JSON.parse(fs.readFileSync(src, 'utf8'));
  const name = a.lesson ?? path.basename(src, '.json');
  const lessonPath = path.join(COURSES, `${name}.json`);
  if (!fs.existsSync(lessonPath)) {
    bad(name, 'không có file bài tương ứng');
    continue;
  }
  const lesson = JSON.parse(fs.readFileSync(lessonPath, 'utf8'));
  const level = lesson.level;
  const prefix = LEVEL_PREFIX[level];
  const vocab = lesson.vocab.map((v) => v.word);

  // ---- hội thoại ----
  const turns = a.dialogue ?? [];
  const [minT, maxT] = TURNS[level];
  if (turns.length < minT || turns.length > maxT) bad(name, `hội thoại có ${turns.length} lượt, cần ${minT}–${maxT}`);
  turns.forEach((t, i) => {
    if (!['甲', '乙'].includes(t.speaker)) bad(name, `lượt ${i + 1}: speaker phải là 甲 hoặc 乙`);
    if (!HAN.test(t.zh ?? '') || !/[。？！]$/.test(t.zh ?? '')) bad(name, `lượt ${i + 1}: câu Trung rỗng hoặc thiếu dấu kết`);
    if (/[：:]/.test(t.zh ?? '')) bad(name, `lượt ${i + 1}: câu Trung không được chứa dấu hai chấm (lẫn với tên người nói)`);
    if (!VI.test(t.vi ?? '') || HAN.test(t.vi ?? '')) bad(name, `lượt ${i + 1}: bản dịch thiếu dấu tiếng Việt hoặc lẫn chữ Hán`);
    if (/(^|\s)[A-D][:：]/.test(t.vi ?? '')) bad(name, `lượt ${i + 1}: bản dịch không tự ghi "A:/B:"`);
    if (i && t.speaker === turns[i - 1].speaker) bad(name, `lượt ${i + 1}: hai lượt liền cùng một người nói`);
    checkReadings(name, `lượt ${i + 1}`, t.zh ?? '', a.readings);
  });
  const transcript = turns.map((t) => `${t.speaker}：${t.zh}`).join('');
  const dialogueVocab = vocab.filter((w) => transcript.includes(w));
  if (dialogueVocab.length < Math.min(5, vocab.length))
    bad(name, `hội thoại chỉ dùng ${dialogueVocab.length} từ của bài (${dialogueVocab.join(', ')}), cần ≥5`);
  for (const w of TRAPS) if (transcript.includes(w)) bad(name, `hội thoại chứa "${w}" — chính sách âm nhẹ đọc sai`);

  const qs = a.questions ?? [];
  if (qs.length < 3 || qs.length > 4) bad(name, `cần 3–4 câu hỏi, đang có ${qs.length}`);
  qs.forEach((q, i) => {
    if (!VI.test(q.prompt ?? '')) bad(name, `câu hỏi ${i + 1}: prompt thiếu tiếng Việt`);
    if (/nghĩa (là )?gì/.test(q.prompt ?? '')) bad(name, `câu hỏi ${i + 1}: hỏi nội dung, không hỏi nghĩa từ`);
    if (!Array.isArray(q.options) || q.options.length !== 3 || new Set(q.options).size !== 3)
      bad(name, `câu hỏi ${i + 1}: cần đúng 3 lựa chọn khác nhau`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) bad(name, `câu hỏi ${i + 1}: answer phải là 0–2`);
    if (!VI.test(q.explanation ?? '')) bad(name, `câu hỏi ${i + 1}: thiếu giải thích tiếng Việt`);
  });
  if (qs.length >= 3 && new Set(qs.map((q) => q.answer)).size === 1) bad(name, 'mọi đáp án cùng một vị trí');

  const listening = {
    title: a.title ?? `Nghe hội thoại: ${String(lesson.lessonTitle).split('·').pop().trim()}`,
    playLimit: level === 'HSK1-2' ? 2 : 1,
    transcript,
    translation: turns.map((t) => `${t.speaker === '甲' ? 'A' : 'B'}: ${t.vi.trim()}`).join(' '),
    pinyin: pinyinCitation(transcript),
    questions: qs.map((q) => ({ prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation })),
  };

  // ---- dictation / shadowing ----
  const outPath = path.join(LISTEN, `${name}.json`);
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
  const prevDt = (prev?.dictation ?? []).map((d) => d.id).filter((id) => String(id).split('-')[1] === String(prefix));
  const prevSh = (prev?.shadowing ?? []).map((d) => d.id).filter((id) => String(id).split('-')[1] === String(prefix));
  for (const id of [...prevDt, ...prevSh]) {
    if (used.has(id)) bad(name, `id cũ ${id} đã bị file khác dùng`);
    used.add(id);
  }
  const covered = new Set();
  const dictation = (a.dictation ?? []).map((d, i) => {
    const { han, r, extra } = surface(d.hanzi);
    if (!/[，。？！]/.test(d.hanzi)) bad(name, `dictation ${i + 1}: thiếu dấu câu`);
    const hit = vocab.filter((w) => han.includes(w));
    if (!hit.length) bad(name, `dictation ${i + 1}: không dùng từ nào của bài`);
    hit.forEach((w) => covered.add(w));
    if (!VI.test(d.meaningVi ?? '')) bad(name, `dictation ${i + 1}: meaningVi thiếu dấu`);
    if (!Array.isArray(d.focus) || !d.focus.length) bad(name, `dictation ${i + 1}: thiếu focus`);
    checkReadings(name, `dictation ${i + 1}`, d.hanzi, a.readings);
    for (const w of TRAPS) if (han.includes(w)) bad(name, `dictation ${i + 1}: chứa "${w}"`);
    const item = {
      id: prevDt[i] ?? nextId('dt', prefix),
      level,
      hanzi: d.hanzi,
      pinyin: r.pinyin,
      meaningVi: d.meaningVi,
      focus: d.focus,
      ...extra,
    };
    if (d.hint) item.hint = d.hint;
    return item;
  });
  if (dictation.length < 3 || dictation.length > 5) bad(name, `dictation cần 3–5 câu, đang có ${dictation.length}`);

  const s = a.shadowing ?? {};
  const { han, r, extra } = surface(s.text ?? '');
  const sylMap = syllableIndexMap(han);
  let offset = 0;
  const raw = splitChunks(s.text ?? '');
  const chunks = raw.map((c, i) => {
    const n = [...c.hanzi].length;
    const from = sylMap[offset];
    const to = sylMap[offset + n - 1] + 1;
    offset += n;
    return { hanzi: c.hanzi, pinyin: r.parts.slice(from, to).join(' '), pause: i === raw.length - 1 ? 'end' : c.pause };
  });
  if (chunks.length < 3) bad(name, `shadowing cần ≥3 cụm hơi (tách theo dấu câu), đang có ${chunks.length}`);
  const shHit = vocab.filter((w) => han.includes(w));
  shHit.forEach((w) => covered.add(w));
  if (shHit.length < 2) bad(name, `shadowing chỉ dùng ${shHit.length} từ của bài`);
  for (const w of TRAPS) if (han.includes(w)) bad(name, `shadowing chứa "${w}"`);
  checkReadings(name, 'shadowing', s.text ?? '', a.readings);
  const missing = vocab.filter((w) => !covered.has(w));
  if (missing.length) bad(name, `từ của bài chưa có trong dictation/shadowing: ${missing.join(', ')}`);
  const texts = [...dictation.map((d) => hanOnly(d.hanzi)), han];
  if (new Set(texts).size !== texts.length) bad(name, 'trùng câu giữa dictation/shadowing');

  const shadowing = [
    {
      id: prevSh[0] ?? nextId('sh', prefix),
      level,
      text: s.text,
      pinyin: r.pinyin,
      meaningVi: s.meaningVi,
      syllables: syllableCount(han),
      pace: s.pace ?? PACE[level],
      chunks,
      focus: s.focus,
      ...extra,
      ...(s.hint ? { hint: s.hint } : {}),
    },
  ];

  if (PRINT) {
    console.log(`\n== ${name}`);
    turns.forEach((t) => console.log(`  ${t.speaker} ${t.zh}\n     ${pinyinCitation(t.zh)}`));
    dictation.forEach((d) => console.log(`  [dt] ${d.hanzi}\n     ${d.pinyin}`));
    console.log(`  [sh] ${s.text}\n     ${r.pinyin}`);
  }
  if (CHECK) continue;
  // Giữ thứ tự khoá của bài; chỉ thay khối listening và ghi chú cũ về bài nghe.
  lesson.listening = listening;
  if (Array.isArray(lesson.learningNotes)) lesson.learningNotes = lesson.learningNotes.map((n) => (OLD_NOTE.test(n) ? NEW_NOTE : n));
  fs.writeFileSync(lessonPath, JSON.stringify(lesson, null, 2) + '\n');
  const doc = {
    source: 'AI soạn, chưa duyệt',
    kind: 'course-listening',
    version: 1,
    lesson: name,
    level,
    title: lesson.lessonTitle,
    note: NOTE,
    dictation,
    shadowing,
  };
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
}

if (problems.length) {
  console.log(`LỖI (${problems.length})`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log(`OK: ${files.length} buổi${CHECK ? ' (chỉ kiểm)' : ' đã ghi'}.`);
