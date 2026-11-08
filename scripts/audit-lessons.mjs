// Rà lỗi học liệu tự động: node scripts/audit-lessons.mjs [--json] [--section=a,b] [--all]
//
// Kiểm tra (không sửa file nào):
//  struct   trường bắt buộc thiếu / rỗng, đáp án nghe ngoài phạm vi, dịch thiếu
//  pinyin   pinyin lưu trong bài lệch pinyinCitation (pinyin-pro + thanh nhẹ + POLYPHONE_LOCKS)
//  dup      cùng một từ được dạy ở nhiều buổi khác nhau trong cùng khoá
//  level    từ trong ví dụ/đối thoại chưa dạy ở bài nào trước đó và vượt băng mức (hsk-standard)
//  meaning  nghĩa tiếng Việt rỗng/khả nghi, hoặc một từ có nghĩa mâu thuẫn giữa các bài
//  dialog   đối thoại nghe thiếu bản dịch / số lượt lời không khớp
//  aux      lessons/listening/course, reading, benchmark: thiếu file, thiếu nghĩa, pinyin lệch
//
// Các phát hiện là DANH SÁCH ĐỂ XEM TAY; thanh nhẹ ngoài danh sách chính sách, 一/不 và đa âm
// có thể là báo động giả. Mã thoát 0 nếu chạy xong (đây là công cụ rà soát, không phải cổng).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAN, pinyinCitation } from '../src/lib/coursePinyin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COURSES = path.join(ROOT, 'lessons', 'courses');
const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const SECTIONS = (args.find((a) => a.startsWith('--section='))?.slice(10) ?? 'struct,pinyin,dup,level,meaning,dialog,aux').split(',');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const summaryStyle = []; // bản dịch dạng tóm tắt (không tách lượt) — đặc điểm thiết kế, thống kê riêng
const findings = []; // {section, file, where, msg}
const add = (section, file, where, msg) => findings.push({ section, file, where, msg });

// ---- nạp bài ----
const files = fs
  .readdirSync(COURSES)
  .filter((n) => /-d\d+\.json$/.test(n))
  .sort();
const lessons = files
  .map((name) => ({ name: name.replace(/\.json$/, ''), data: rd(path.join(COURSES, name)) }))
  .sort((a, b) => a.data.volumeId.localeCompare(b.data.volumeId) || a.data.lessonNo - b.data.lessonNo || a.data.day - b.data.day);

const TRACK_BAND = {
  'pinyin-intro': 2,
  'hsk1-practical': 2,
  'hsk3-practical': 4,
  'hsk5-practical': 6,
  'misu30-1': 2,
  'misu30-2': 4,
  'misu30-3': 6,
};

// ---- chuẩn HSK ----
const stdWords = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'eval', 'hsk-standard.words.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const e = JSON.parse(line);
  const lv = [e.old, e.new, e.newest].filter((x) => Number.isInteger(x));
  if (lv.length) stdWords.set(e.w, { min: Math.min(...lv), max: Math.max(...lv) });
}

// ---- tiện ích ----
const isPunct = (t) => !/[\p{L}\p{N}]/u.test(t);
const toks = (s) => String(s ?? '').trim().split(/\s+/).filter((t) => t && !isPunct(t)).map((t) => t.toLowerCase());
const hasHan = (s) => HAN.test(String(s ?? ''));
const blank = (s) => typeof s !== 'string' || !s.trim();
function cite(zh) {
  try {
    return toks(pinyinCitation(zh));
  } catch (e) {
    return null;
  }
}
function cmpPinyin(file, where, zh, stored, joined = false) {
  if (blank(stored) || blank(zh)) return;
  const want = cite(zh);
  if (!want) return;
  // Bỏ phần chú thích sau mũi tên/ngoặc trong thẻ phát âm
  const got = toks(String(stored).split(/→|\(|（/)[0]);
  if (joined) {
    // Glossary đọc-hiểu ghi pinyin liền (wǒmen): so sánh sau khi bỏ khoảng trắng.
    if (want.join('') === got.join('')) return;
  }
  if (want.join(' ') !== got.join(' ')) {
    const diff = [];
    const n = Math.max(want.length, got.length);
    for (let i = 0; i < n; i += 1) if (want[i] !== got[i]) diff.push(`#${i + 1}: bài="${got[i] ?? '∅'}" pinyin-pro="${want[i] ?? '∅'}"`);
    add('pinyin', file, where, `${zh} | ${diff.slice(0, 4).join('; ')}`);
  }
}

// ---- 1. struct + dialog + pinyin ----
const REQ_TOP = ['volumeId', 'lessonNo', 'lessonTitle', 'day', 'level', 'vocab', 'patterns', 'roleplay', 'freeTalk', 'listening', 'speaking', 'transferTask'];
const speakerRe = /[甲乙丙丁][：:]/g;
function checkLesson({ name, data: d }) {
  for (const k of REQ_TOP) if (d[k] === undefined || d[k] === null) add('struct', name, k, 'thiếu trường');
  if (d.reviewed === false && !/chưa/i.test(d.editorialStatus ?? '')) add('struct', name, 'editorialStatus', 'chưa duyệt nhưng thiếu nhãn "chưa duyệt"');
  if (!Array.isArray(d.vocab) || !d.vocab.length) add('struct', name, 'vocab', 'vocab rỗng');
  (d.vocab ?? []).forEach((v, i) => {
    const w = `vocab[${i}] ${v.word ?? ''}`;
    for (const k of ['word', 'meaning', 'example', 'exampleVi', 'pinyin', 'examplePinyin']) if (blank(v[k])) add('struct', name, w, `thiếu/rỗng ${k}`);
    if (!blank(v.example) && !blank(v.word) && !v.example.includes(v.word)) add('struct', name, w, `câu ví dụ không chứa từ: ${v.example}`);
    if (SEC.pinyin) {
      cmpPinyin(name, `${w}.pinyin`, v.word, v.pinyin);
      cmpPinyin(name, `${w}.examplePinyin`, v.example, v.examplePinyin);
    }
  });
  (d.patterns ?? []).forEach((p, i) => {
    const w = `patterns[${i}] ${p.pattern ?? ''}`;
    for (const k of ['pattern', 'explanation', 'example', 'exampleVi', 'examplePinyin']) if (blank(p[k])) add('struct', name, w, `thiếu/rỗng ${k}`);
    if (SEC.pinyin) cmpPinyin(name, `${w}.examplePinyin`, p.example, p.examplePinyin);
  });
  const rp = d.roleplay ?? {};
  for (const k of ['setting', 'avatarRole', 'learnerRole', 'opening', 'openingVi']) if (blank(rp[k])) add('struct', name, `roleplay.${k}`, 'thiếu/rỗng');
  if (!Array.isArray(rp.goals) || !rp.goals.length) add('struct', name, 'roleplay.goals', 'thiếu mục tiêu');
  for (const k of ['question', 'questionVi']) if (blank(d.freeTalk?.[k])) add('struct', name, `freeTalk.${k}`, 'thiếu/rỗng');
  if (blank(d.transferTask)) add('struct', name, 'transferTask', 'rỗng');
  if (!Array.isArray(d.learningNotes) || !d.learningNotes.length) add('struct', name, 'learningNotes', 'thiếu ghi chú học');
  const hasPron = /^(pinyin-intro|hsk1-practical|hsk3-practical)$/.test(d.volumeId);
  if (hasPron && !(d.pronunciation?.length > 0)) add('struct', name, 'pronunciation', 'thiếu thẻ phát âm (lộ trình này có thẻ)');
  (d.pronunciation ?? []).forEach((p, i) => {
    for (const k of ['text', 'pinyin', 'hint']) if (blank(p[k])) add('struct', name, `pronunciation[${i}]`, `thiếu ${k}`);
    checkHint(name, `pronunciation[${i}] ${p.text}`, p);
    if (hasHan(p.text) && /^[\p{Script=Han}]+$/u.test(p.text)) cmpPinyin(name, `pronunciation[${i}].pinyin`, p.text, p.pinyin);
  });
  const listens = [['listening', d.listening, true], ...(d.checkpoint?.listening ?? []).map((l, i) => [`checkpoint.listening[${i}]`, l, false])];
  for (const [w, L, needTitle] of listens) checkListening(name, w, L, d, needTitle);
  const speaks = [['speaking', d.speaking], ['checkpoint.speaking', d.checkpoint?.speaking]];
  for (const [w, arr] of speaks) {
    if (w === 'speaking' && !arr?.length) add('struct', name, w, 'không có nhiệm vụ nói');
    (arr ?? []).forEach((s, i) => {
      const at = `${w}[${i}]`;
      for (const k of ['kind', 'prompt', 'checklist']) if (blank(s[k]) && !(Array.isArray(s[k]) && s[k].length)) add('struct', name, at, `thiếu ${k}`);
      if (!s.reference && !s.sampleZh) add('struct', name, at, 'thiếu reference/sampleZh');
      if (s.sampleZh && blank(s.sampleVi)) add('dialog', name, at, 'có sampleZh nhưng thiếu sampleVi');
      const zh = s.audioText ?? (hasHan(s.reference) ? s.reference : null);
      if (s.pinyin && zh) cmpPinyin(name, `${at}.pinyin`, zh, s.pinyin);
      if (s.kind === 'repeat' && blank(s.audioText)) add('struct', name, at, 'kind=repeat nhưng thiếu audioText');
    });
  }
  if (d.checkpoint) {
    for (const g of d.checkpoint.glossary ?? []) {
      if (blank(g.word) || blank(g.meaningVi) || blank(g.pinyin)) add('struct', name, `checkpoint.glossary ${g.word ?? ''}`, 'thiếu word/pinyin/meaningVi');
      else cmpPinyin(name, `checkpoint.glossary ${g.word}`, g.word, g.pinyin);
    }
  }
}
// Lời gợi ý phát âm nói "hai thanh N liền nhau" thì pinyin của thẻ phải thực sự có hai âm thanh N liền nhau.
const TONE_MARK = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
const toneOf = (syl) => {
  for (const c of syl.normalize('NFD')) if (TONE_MARK[c]) return TONE_MARK[c];
  return 0;
};
function checkHint(file, where, p) {
  if (blank(p.hint) || blank(p.pinyin)) return;
  const tones = String(p.pinyin).split(/→|\(/)[0].trim().split(/\s+/).filter((x) => /\p{L}/u.test(x)).map(toneOf);
  // Bỏ các mệnh đề phủ định ("đừng đọc cả hai thành thanh 1") trước khi so.
  const h = p.hint.toLowerCase().split(/[;,.]/).filter((c) => !/đừng|không phải|chứ không/.test(c)).join(';');
  for (const t of [1, 2, 3, 4]) {
    if (new RegExp(`(?:hai|cả hai)[^.;:]{0,18}thanh ${t}`, 'i').test(h) && tones.length === 2 && !tones.every((x) => x === t || x === 0) && /liền|liên|đều|cả hai/.test(h))
      add('pinyin', file, where, `gợi ý nói "hai thanh ${t}" nhưng pinyin ${p.pinyin} có thanh ${tones.join('+')}: ${p.hint}`);
  }
  if (/đọc nhẹ|thanh nhẹ/.test(h) && !tones.includes(0) && !/个|\bgè\b|\bma\b|\bba\b|\bne\b/.test(`${h} ${p.text} ${p.hint}`))
    add('pinyin', file, where, `gợi ý nhắc thanh nhẹ nhưng pinyin ${p.pinyin} không có âm nhẹ: ${p.hint}`);
}
function checkListening(name, w, L, d, needTitle) {
  if (!L) return;
  for (const k of ['transcript', 'translation']) if (blank(L[k])) add('dialog', name, `${w}.${k}`, 'thiếu/rỗng');
  if (needTitle && blank(L.title)) add('struct', name, `${w}.title`, 'thiếu title');
  if (!Number.isInteger(L.playLimit) || L.playLimit < 1) add('struct', name, `${w}.playLimit`, 'playLimit không hợp lệ');
  const turns = (L.transcript?.match(speakerRe) ?? []).length;
  const viTurns = (String(L.translation ?? '').match(/(?:^|[\s.!?。！？])[A-D][:：]/g) ?? []).length;
  if (turns && viTurns && turns !== viTurns) add('dialog', name, `${w}`, `số lượt lời lệch: transcript ${turns} / translation ${viTurns}`);
  if (turns && !viTurns) summaryStyle.push(`${name} ${w}`);
  if (L.pinyin !== undefined && SEC.pinyin) cmpPinyin(name, `${w}.pinyin`, L.transcript, L.pinyin);
  if (L.pinyin === undefined && d.volumeId !== 'hsk5-practical' && !d.volumeId.startsWith('misu30-2') && !d.volumeId.startsWith('misu30-3'))
    add('struct', name, `${w}.pinyin`, 'thiếu pinyin cho bản nghe (các bậc này có pinyin)');
  const qs = L.questions ?? [];
  if (!qs.length) add('struct', name, `${w}.questions`, 'không có câu hỏi nghe');
  qs.forEach((q, i) => {
    const at = `${w}.questions[${i}]`;
    if (blank(q.prompt) || blank(q.explanation)) add('struct', name, at, 'thiếu prompt/explanation');
    if (!Array.isArray(q.options) || q.options.length < 2) add('struct', name, at, 'options < 2');
    else {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) add('struct', name, at, `answer ngoài phạm vi (${q.answer})`);
      if (new Set(q.options).size !== q.options.length) add('struct', name, at, 'options trùng nhau');
      if (q.options.some(blank)) add('struct', name, at, 'option rỗng');
    }
  });
  // Phân bố đáp án: nếu mọi câu cùng một vị trí
}

// ---- 2. dup ----
function checkDup() {
  const seen = new Map(); // vol -> word -> [{file}]
  for (const { name, data: d } of lessons) {
    const m = seen.get(d.volumeId) ?? new Map();
    seen.set(d.volumeId, m);
    for (const v of d.vocab ?? []) m.set(v.word, [...(m.get(v.word) ?? []), name]);
  }
  let samePair = 0;
  for (const [vol, m] of seen) {
    for (const [word, list] of m) {
      if (list.length < 2) continue;
      const lessonsOf = new Set(list.map((n) => n.replace(/-d\d+$/, '')));
      if (lessonsOf.size === 1) {
        samePair += 1; // buổi 2 nhắc lại từ buổi 1: thiết kế có chủ đích
        continue;
      }
      add('dup', vol, word, `${lessonsOf.size} bài: ${[...lessonsOf].map((n) => n.replace(/^.*practical-|^misu30-/, '')).join(', ')}`);
    }
  }
  if (samePair) add('dup', 'tổng hợp', 'cùng bài', `${samePair} từ lặp giữa buổi 1 và buổi 2 của cùng một bài (thiết kế: buổi 2 ôn lại buổi 1, không tính là lỗi)`);
  // Trùng nội dung giữa các khoá
  const all = new Map();
  for (const { name, data: d } of lessons) for (const v of d.vocab ?? []) all.set(v.word, [...(all.get(v.word) ?? []), d.volumeId]);
  return all;
}

// ---- 3. level ----
const dictWords = new Set(stdWords.keys());
for (const { data: d } of lessons) for (const v of d.vocab ?? []) dictWords.add(v.word);
for (const { data: d } of lessons) for (const g of d.checkpoint?.glossary ?? []) dictWords.add(g.word);
const maxWord = Math.max(...[...dictWords].map((w) => w.length));
// Tách từ hai lượt: (1) khớp dài nhất chỉ với từ đã dạy + từ trong băng mức, (2) phần còn lại
// (các chữ ngoài băng) gom thành đoạn rồi mới tách bằng toàn bộ danh sách để gọi tên từ.
function fmm(run, dict) {
  const out = [];
  let i = 0;
  while (i < run.length) {
    let len = Math.min(maxWord, run.length - i);
    while (len > 1 && !dict.has(run.slice(i, i + len))) len -= 1;
    out.push(run.slice(i, i + len));
    i += len;
  }
  return out;
}
function segment(text, inDict) {
  const out = [];
  for (const run of text.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (!inDict) {
      out.push(...fmm(run, dictWords));
      continue;
    }
    let pending = '';
    const flush = () => {
      if (pending) out.push(...fmm(pending, dictWords));
      pending = '';
    };
    for (const t of fmm(run, inDict)) {
      if (t.length === 1 && !inDict.has(t)) pending += t;
      else {
        flush();
        out.push(t);
      }
    }
    flush();
  }
  return out;
}
const NAME_OK = new Set(['小安', '小林', '小王', '小李', '小明', '安', '甲', '乙', '丙', '丁', '中国', '越南', '北京', '上海', '河内', '胡志明', '美国', '日本', '韩国', '英国', '法国', '德国']);
function checkLevel() {
  const band = new Map();
  const taught = new Map(); // vol -> Set(words) (kể cả buổi hiện tại)
  const volLessons = new Map();
  for (const l of lessons) volLessons.set(l.data.volumeId, [...(volLessons.get(l.data.volumeId) ?? []), l]);
  const taughtChars = (set) => new Set([...set].flatMap((w) => [...w]));
  for (const [vol, list] of volLessons) {
    const top = TRACK_BAND[vol] ?? 6;
    const known = new Set();
    for (const { name, data: d } of list) {
      for (const v of d.vocab ?? []) known.add(v.word);
      for (const g of d.checkpoint?.glossary ?? []) known.add(g.word);
      const chars = taughtChars(known);
      const fields = [];
      (d.vocab ?? []).forEach((v, i) => fields.push([`vocab[${i}].example`, v.example]));
      (d.patterns ?? []).forEach((p, i) => fields.push([`patterns[${i}].example`, p.example]));
      fields.push(['roleplay.opening', d.roleplay?.opening], ['freeTalk.question', d.freeTalk?.question], ['listening.transcript', d.listening?.transcript]);
      (d.listening?.questions ?? []).forEach((q, i) => fields.push([`listening.q[${i}]`, q.prompt]));
      (d.speaking ?? []).forEach((s, i) => fields.push([`speaking[${i}]`, s.audioText ?? s.reference], [`speaking[${i}].sample`, s.sampleZh]));
      const flagged = new Map();
      const inDict = new Set(known);
      for (const [w, e] of stdWords) if (e.min <= top) inDict.add(w);
      for (const [where, text] of fields) {
        if (!hasHan(text)) continue;
        for (const w of segment(text, inDict)) {
          if (known.has(w) || NAME_OK.has(w)) continue;
          const std = stdWords.get(w);
          if (std && std.min <= top) {
            // trong băng mức nhưng chưa dạy: chỉ ghi nhận số lượng (info)
            continue;
          }
          if (w.length > 1 && [...w].every((c) => chars.has(c)) && !std) continue; // ghép từ các chữ đã dạy
          if (!flagged.has(w)) flagged.set(w, { where, std });
        }
      }
      for (const [w, { where, std }] of flagged) {
        add('level', name, where, `${w.length === 1 ? '[chữ lẻ] ' : ''}${w} ${std ? `(HSK ${std.min}${std.max !== std.min ? '–' + std.max : ''}, băng ${top}) vượt băng` : '(ngoài danh sách HSK)'} — chưa dạy ở buổi nào trước đó`);
      }
    }
  }
}

// ---- 4. meaning ----
const VI_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
function checkMeaning() {
  const byWord = new Map(); // word -> Map(meaning -> [files])
  const note = (word, meaning, file) => {
    if (blank(word) || blank(meaning)) return;
    const m = byWord.get(word) ?? new Map();
    byWord.set(word, m);
    const k = meaning.trim().toLowerCase();
    m.set(k, [...(m.get(k) ?? []), file]);
  };
  for (const { name, data: d } of lessons) {
    for (const v of d.vocab ?? []) {
      note(v.word, v.meaning, name);
      checkMeaningText(name, `vocab ${v.word}.meaning`, v.meaning);
      checkMeaningText(name, `vocab ${v.word}.exampleVi`, v.exampleVi, true);
    }
    for (const g of d.checkpoint?.glossary ?? []) {
      note(g.word, g.meaningVi, name + ' (checkpoint)');
      checkMeaningText(name, `glossary ${g.word}`, g.meaningVi);
    }
    for (const p of d.patterns ?? []) {
      checkMeaningText(name, `pattern ${p.pattern}.exampleVi`, p.exampleVi, true);
      checkMeaningText(name, `pattern ${p.pattern}.explanation`, p.explanation, true);
    }
    checkMeaningText(name, 'roleplay.openingVi', d.roleplay?.openingVi, true);
    checkMeaningText(name, 'freeTalk.questionVi', d.freeTalk?.questionVi, true);
    checkMeaningText(name, 'listening.translation', d.listening?.translation, true);
  }
  for (const [word, m] of byWord) {
    if (m.size < 2) continue;
    // mâu thuẫn "mạnh": các nghĩa không chia sẻ từ nào
    const sets = [...m.keys()].map((k) => new Set(k.split(/[;,/()]+|\s+/).map((x) => x.trim()).filter((x) => x.length > 1)));
    const disjoint = sets.some((a, i) => sets.some((b, j) => j > i && ![...a].some((x) => b.has(x))));
    const detail = [...m].map(([k, f]) => `"${k}" [${[...new Set(f)].slice(0, 3).join(', ')}${f.length > 3 ? ', …' : ''}]`).join(' ≠ ');
    add('meaning', word, disjoint ? 'mâu thuẫn' : 'khác cách ghi', detail);
  }
}
function checkMeaningText(file, where, text, sentence = false) {
  if (typeof text !== 'string') return;
  if (!text.trim()) return add('meaning', file, where, 'nghĩa rỗng');
  if (hasHan(text) && !/^[^，。]*[（(][^）)]*\p{Script=Han}[^）)]*[）)]/u.test(text) && !sentence) add('meaning', file, where, `nghĩa chứa chữ Hán: ${text}`);
  if (!sentence && !VI_DIACRITIC.test(text) && /\b(the|and|of|to|is|a|an|with|for|your|you|my|not|be)\b/i.test(text) && /^[A-Za-z ;,'()-]+$/.test(text)) add('meaning', file, where, `nghĩa không có dấu tiếng Việt (tiếng Anh/ASCII?): ${text}`);
  if (/(?<![\p{L}])(\p{L}{3,})\s+\1(?![\p{L}])/iu.test(text)) add('meaning', file, where, `lặp từ liền nhau: ${text}`);
  if (/\?\?|\u00ef\u00bf|\ufffd|TODO|xxx/i.test(text)) add('meaning', file, where, `ký tự lỗi/đánh dấu tạm: ${text}`);
  if (/ {2,}|^\s|\s$/.test(text)) add('meaning', file, where, `khoảng trắng thừa: "${text}"`);
}

// ---- 5. aux ----
function checkAux() {
  const dir = path.join(ROOT, 'lessons', 'listening', 'course');
  for (const { name, data: d } of lessons) {
    if (!d.volumeId.startsWith('misu30') && !fs.existsSync(path.join(dir, `${name}.json`))) add('aux', name, 'listening/course', 'thiếu file nghe riêng');
  }
  for (const f of fs.readdirSync(dir)) {
    const L = rd(path.join(dir, f));
    const nm = `listening/course/${f.replace(/\.json$/, '')}`;
    if (!L.dictation?.length) add('aux', nm, 'dictation', 'không có mục chép chính tả');
    if (!L.shadowing?.length) add('aux', nm, 'shadowing', 'không có đoạn nhắc lại');
    for (const it of L.dictation ?? []) {
      if (blank(it.meaningVi)) add('aux', nm, it.id, 'thiếu meaningVi');
      else checkMeaningText(nm, it.id + '.meaningVi', it.meaningVi, true);
    }
    for (const it of L.shadowing ?? []) {
      if (blank(it.meaningVi)) add('aux', nm, it.id, 'thiếu meaningVi');
      else checkMeaningText(nm, it.id + '.meaningVi', it.meaningVi, true);
    }
  }
  const rp = path.join(ROOT, 'lessons', 'reading', 'hsk1.json');
  if (fs.existsSync(rp)) {
    for (const p of rd(rp).passages) {
      const nm = `reading/${p.id}`;
      for (const s of p.sentences ?? []) {
        if (blank(s.vi)) add('aux', nm, s.hanzi, 'câu thiếu bản dịch');
        for (const w of segment(s.hanzi)) if (!p.glossary?.[w] && ![...w].every((c) => p.glossary?.[c])) add('aux', nm, s.hanzi, `từ "${w}" không có trong glossary của bài`);
      }
      for (const [w, g] of Object.entries(p.glossary ?? {})) {
        if (blank(g.meaning)) add('aux', nm, w, 'glossary thiếu nghĩa');
        cmpPinyin(nm, `glossary ${w}`, w, g.pinyin, true);
      }
      const q = p.question;
      if (!q || !(q.answer >= 0 && q.answer < q.options.length)) add('aux', nm, 'question', 'đáp án ngoài phạm vi');
    }
  }
  const bp = path.join(ROOT, 'lessons', 'benchmark', 'hsk1.json');
  if (fs.existsSync(bp)) {
    const b = rd(bp);
    for (const it of [...b.listening, ...b.speaking]) cmpPinyin('benchmark', it.id, it.word, it.pinyin);
    for (const it of b.meaning) if (!(it.answer >= 0 && it.answer < it.options.length)) add('aux', 'benchmark', it.id, 'đáp án ngoài phạm vi');
  }
}

// ---- chạy ----
const SEC = Object.fromEntries(SECTIONS.map((s) => [s, true]));
for (const l of lessons) checkLesson(l);
if (SEC.dup) checkDup();
if (SEC.level) checkLevel();
if (SEC.meaning) checkMeaning();
if (SEC.aux) checkAux();

if (summaryStyle.length) add('dialog', 'tổng hợp', 'translation', `${summaryStyle.length} bản nghe có bản dịch dạng TÓM TẮT, không dịch từng lượt lời (ví dụ ${summaryStyle.slice(0, 3).join('; ')})`);
const shown = findings.filter((f) => SEC[f.section]);
if (AS_JSON) {
  console.log(JSON.stringify(shown, null, 2));
} else {
  const by = {};
  for (const f of shown) (by[f.section] ??= []).push(f);
  const limit = args.includes('--all') ? Infinity : 60;
  for (const s of SECTIONS) {
    const list = by[s] ?? [];
    console.log(`\n=== ${s}: ${list.length} phát hiện ===`);
    for (const f of list.slice(0, limit)) console.log(`- ${f.file} :: ${f.where} :: ${f.msg}`);
    if (list.length > limit) console.log(`  … còn ${list.length - limit} (dùng --all)`);
  }
  console.log(`\nTổng: ${shown.length} phát hiện trên ${lessons.length} buổi. Đây là danh sách để xem tay, không phải kết luận.`);
}
