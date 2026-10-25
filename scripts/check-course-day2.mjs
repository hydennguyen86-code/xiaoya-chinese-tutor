// Kiểm tra content-for-misu/course-day2/*.json
//
// Đối chiếu từng file với bản gốc (chỉ đọc) trong xiaoya-chinese-tutor:
// cấu trúc khóa, metadata, từ vựng buổi 1 còn đủ, tối đa 3 từ mở rộng,
// reviewed=false, pinyin sinh lại từ pinyin-pro theo chính sách thanh nhẹ,
// và không còn trường nhập vai/câu hỏi nào trùng buổi 1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAN, pinyinCitation } from '../server/coursePinyin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../lessons/courses');
const DIR = process.argv[2] ? path.resolve(process.argv[2]) : SRC;

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const HAN_ONLY = /^[\p{Script=Han}，。！？、；：…—\s“”‘’（）,.!?;:%]+$/u;

const pyText = pinyinCitation;

function keysOf(obj) {
  return Object.keys(obj ?? {});
}

function sameKeys(a, b, where) {
  const ka = keysOf(a).join('|');
  const kb = keysOf(b).join('|');
  if (ka !== kb) fail(where, `khóa khác bản gốc: [${ka}] vs [${kb}]`);
}

function checkPinyin(id, field, value, text) {
  const got = String(value ?? '').trim();
  let want;
  try {
    want = pyText(text);
  } catch (e) {
    fail(id, `${field}: ${e.message}`);
    return;
  }
  if (got !== want) {
    const gotS = got.split(' ');
    const wantS = want.split(' ');
    let at = 0;
    while (at < gotS.length && gotS[at] === wantS[at]) at += 1;
    fail(id, `${field} sai ở âm ${at + 1}: "${gotS[at] ?? '(thiếu)'}" ≠ "${wantS[at] ?? '(thừa)'}" (đúng: ${want})`);
  }
}

function hasHan(s) {
  return HAN.test(String(s ?? ''));
}

function requireVi(id, field, value, min = 2) {
  const s = String(value ?? '').trim();
  if (s.length < min) fail(id, `${field} quá ngắn`);
  if (hasHan(s)) fail(id, `${field} lẫn chữ Hán`);
  if (!VI_DIACRITICS.test(s)) fail(id, `${field} không có dấu tiếng Việt: "${s}"`);
}

// Câu tiếng Việt có trích dẫn chữ Hán (ví dụ: "B nói 请再说一遍.") — vẫn phải có dấu tiếng Việt.
function requireViAllowHan(id, field, value, min = 2) {
  const s = String(value ?? '').trim();
  if (s.length < min) fail(id, `${field} quá ngắn`);
  if (HAN_ONLY.test(s)) return; // HSK5 giữ chú giải thuần chữ Hán như bản gốc
  if (!VI_DIACRITICS.test(s)) fail(id, `${field} không có dấu tiếng Việt: "${s}"`);
}

function requireZh(id, field, value) {
  const s = String(value ?? '').trim();
  if (!hasHan(s)) fail(id, `${field} thiếu chữ Hán`);
  if (!HAN_ONLY.test(s)) fail(id, `${field} có ký tự ngoài chữ Hán/dấu câu: "${s}"`);
}

const METADATA_FIXED = [
  'volumeId',
  'volumeTitle',
  'lessonNo',
  'lessonTitle',
  'day',
  'days',
  'level',
  'targetLevel',
  'placeholder',
  'authored',
  'reviewed',
  'editorialStatus',
  'recommendedMinutes',
  'prerequisites',
  'learningNotes',
];
const TOP_KEYS = [
  'volumeId',
  'volumeTitle',
  'lessonNo',
  'lessonTitle',
  'day',
  'days',
  'level',
  'targetLevel',
  'placeholder',
  'authored',
  'reviewed',
  'editorialStatus',
  'recommendedMinutes',
  'vocab',
  'patterns',
  'roleplay',
  'freeTalk',
  'learningNotes',
  'prerequisites',
  'listening',
  'speaking',
  'transferTask',
  'pronunciation',
  'checkpoint',
];

const names = [];
for (const vol of ['hsk1-practical', 'hsk5-practical']) {
  for (let n = 1; n <= 12; n += 1) names.push(`${vol}-${n}`);
}

let extTotal = 0;
let pinyinFields = 0;
const dupStats = { opening: 0, freeTalk: 0, transfer: 0, speaking: 0 };
const changedFiles = [];

for (const base of names) {
  const name = `${base}-d2.json`;
  const outPath = path.join(DIR, name);
  if (!fs.existsSync(outPath)) {
    fail(name, 'thiếu file trong course-day2/');
    continue;
  }
  const orig = JSON.parse(fs.readFileSync(path.join(SRC, name), 'utf8'));
  const d1 = JSON.parse(fs.readFileSync(path.join(SRC, `${base}-d1.json`), 'utf8'));
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const id = name;

  sameKeys(orig, out, id);
  const outTop = keysOf(out);
  const expectTop = TOP_KEYS.filter((k) => k in orig);
  if (outTop.join('|') !== expectTop.join('|')) {
    fail(id, `thứ tự/khóa cấp 1 khác bản gốc: [${outTop.join('|')}]`);
  }

  for (const k of METADATA_FIXED) {
    if (JSON.stringify(out[k]) !== JSON.stringify(orig[k])) fail(id, `trường ${k} bị đổi so với bản gốc`);
  }
  if (out.day !== 2) fail(id, 'day phải là 2');
  if (out.reviewed !== false) fail(id, 'reviewed phải là false');
  if (out.authored !== true) fail(id, 'authored phải là true');
  if (!/chưa có giáo viên duyệt/i.test(out.editorialStatus ?? '')) fail(id, 'editorialStatus phải nói rõ chưa có giáo viên duyệt');
  if ('source' in out) fail(id, 'không thêm trường source vào file bài học (khác cấu trúc gốc)');

  // ── vocab ──
  if (!Array.isArray(out.vocab)) fail(id, 'vocab không phải mảng');
  else {
    if (out.vocab.length < orig.vocab.length) fail(id, 'vocab bị mất từ của buổi 1');
    if (out.vocab.length > orig.vocab.length + 3) fail(id, `thêm ${out.vocab.length - orig.vocab.length} từ, quá 3`);
    extTotal += out.vocab.length - orig.vocab.length;
    const seen = new Set();
    out.vocab.forEach((v, i) => {
      const vid = `${id} vocab[${i}] ${v.word ?? '?'}`;
      sameKeys(orig.vocab[0], v, vid);
      if (i < orig.vocab.length) {
        for (const k of ['word', 'meaning', 'example', 'exampleVi']) {
          if (v[k] !== orig.vocab[i][k]) fail(vid, `trường ${k} của từ buổi 1 bị đổi`);
        }
      } else {
        if (seen.has(v.word)) fail(vid, 'trùng từ');
        requireZh(vid, 'word', v.word);
        if (String(v.meaning ?? '').trim().length < 2) fail(vid, 'meaning quá ngắn');
        if (!VI_DIACRITICS.test(String(v.meaning ?? ''))) warn(vid, `meaning không có dấu tiếng Việt: "${v.meaning}"`);
        requireZh(vid, 'example', v.example);
        requireVi(vid, 'exampleVi', v.exampleVi, 4);
        const hay = [
          out.roleplay.opening,
          out.freeTalk.question,
          out.listening.transcript,
          out.transferTask,
          out.speaking.map((s) => [s.text, s.audioText, s.sampleZh].filter(Boolean).join(' ')).join(' '),
        ].join(' ');
        if (!hay.includes(v.word)) fail(vid, 'từ mở rộng không xuất hiện trong nội dung buổi 2');
      }
      seen.add(v.word);
      checkPinyin(vid, 'pinyin', v.pinyin, v.word);
      checkPinyin(vid, 'examplePinyin', v.examplePinyin, v.example);
    });
    // chính sách thanh nhẹ: các từ tiêu biểu phải ghi thanh nhẹ
    const byWord = new Map(out.vocab.map((v) => [v.word, v.pinyin]));
    const mustNeutral = new Map([
      ['谢谢', 'xiè xie'],
      ['朋友', 'péng you'],
      ['名字', 'míng zi'],
      ['学生', 'xué sheng'],
      ['晚上', 'wǎn shang'],
      ['什么', 'shén me'],
      ['喜欢', 'xǐ huan'],
      ['弟弟', 'dì di'],
      ['妹妹', 'mèi mei'],
      ['杯子', 'bēi zi'],
    ]);
    for (const [w, want] of mustNeutral) {
      if (byWord.has(w) && byWord.get(w) !== want) fail(id, `thanh nhẹ: ${w} phải là "${want}", đang là "${byWord.get(w)}"`);
    }
  }

  // ── patterns: chỉ pinyin được đổi ──
  if (!Array.isArray(out.patterns) || out.patterns.length !== orig.patterns.length) {
    fail(id, 'patterns đổi số lượng');
  } else {
    out.patterns.forEach((p, i) => {
      sameKeys(orig.patterns[i], p, `${id} patterns[${i}]`);
      for (const k of ['pattern', 'explanation', 'example', 'exampleVi']) {
        if (p[k] !== orig.patterns[i][k]) fail(id, `patterns[${i}].${k} bị đổi`);
      }
      checkPinyin(id, `patterns[${i}].examplePinyin`, p.examplePinyin, p.example);
    });
  }

  // ── roleplay ──
  if (!out.roleplay || typeof out.roleplay !== 'object') fail(id, 'thiếu roleplay');
  else {
    sameKeys(orig.roleplay, out.roleplay, `${id} roleplay`);
    requireVi(id, 'roleplay.setting', out.roleplay.setting, 30);
    if (!/buổi 2/i.test(out.roleplay.setting)) fail(id, 'roleplay.setting phải nêu rõ đây là buổi 2');
    if (/bắt đầu với tình huống buổi 1/i.test(out.roleplay.setting)) fail(id, 'setting còn câu "bắt đầu với tình huống buổi 1"');
    requireVi(id, 'roleplay.avatarRole', out.roleplay.avatarRole, 3);
    requireVi(id, 'roleplay.learnerRole', out.roleplay.learnerRole, 3);
    requireZh(id, 'roleplay.opening', out.roleplay.opening);
    requireVi(id, 'roleplay.openingVi', out.roleplay.openingVi, 4);
    if (!Array.isArray(out.roleplay.goals) || out.roleplay.goals.length < 2 || out.roleplay.goals.length > 3) {
      fail(id, 'roleplay.goals phải có 2–3 mục');
    } else {
      out.roleplay.goals.forEach((g, i) => requireVi(id, `roleplay.goals[${i}]`, g, 8));
      if (new Set(out.roleplay.goals).size !== out.roleplay.goals.length) fail(id, 'goal trùng nhau');
    }
    if (out.roleplay.opening === d1.roleplay.opening) fail(id, 'roleplay.opening vẫn trùng buổi 1');
  }

  // ── freeTalk ──
  sameKeys(orig.freeTalk, out.freeTalk, `${id} freeTalk`);
  requireZh(id, 'freeTalk.question', out.freeTalk.question);
  requireVi(id, 'freeTalk.questionVi', out.freeTalk.questionVi, 8);
  if (out.freeTalk.question === d1.freeTalk.question) {
    fail(id, 'freeTalk.question vẫn trùng buổi 1');
  }

  // ── transferTask ──
  requireViAllowHan(id, 'transferTask', out.transferTask, 40);
  if (out.transferTask === d1.transferTask) fail(id, 'transferTask vẫn trùng buổi 1');
  if (out.transferTask === out.roleplay.setting) fail(id, 'transferTask chỉ lặp lại setting, chưa nêu việc phải làm');

  // ── listening ──
  const L = out.listening;
  if (!L || typeof L !== 'object') fail(id, 'thiếu listening');
  else {
    sameKeys(orig.listening, L, `${id} listening`);
    requireZh(id, 'listening.transcript', L.transcript);
    requireVi(id, 'listening.translation', L.translation, 15);
    if (!Array.isArray(L.questions) || L.questions.length < 2) fail(id, 'listening cần ít nhất 2 câu hỏi');
    else {
      L.questions.forEach((q, qi) => {
        requireVi(id, `listening.questions[${qi}].prompt`, q.prompt, 4);
        if (!Array.isArray(q.options) || q.options.length !== 3) fail(id, `listening q${qi} phải có 3 lựa chọn`);
        else {
          if (new Set(q.options).size !== 3) fail(id, `listening q${qi} có lựa chọn trùng`);
          q.options.forEach((o, oi) => {
            if (String(o ?? '').trim().length < 1) fail(id, `listening q${qi}.options[${oi}] rỗng`);
          });
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) {
          fail(id, `listening q${qi}.answer ngoài phạm vi`);
        }
        requireViAllowHan(id, `listening q${qi}.explanation`, q.explanation, 4);
      });
    }
    if ('pinyin' in orig.listening) {
      checkPinyin(id, 'listening.pinyin', L.pinyin, L.transcript);
      pinyinFields += 1;
    } else if ('pinyin' in L) {
      fail(id, 'bản gốc không có listening.pinyin, không thêm');
    }
    if (L.transcript === d1.listening.transcript) fail(id, 'listening trùng hẳn buổi 1');
    if (orig.listening.transcript !== d1.listening.transcript && L.transcript !== orig.listening.transcript) {
      warnings.push(`${id}: listening đã đổi so với bản gốc buổi 2 — kiểm tra lại câu hỏi/đáp án`);
    }
  }

  // ── speaking ──
  const S = out.speaking;
  const S0 = d1.speaking;
  if (!Array.isArray(S) || S.length !== orig.speaking.length) {
    fail(id, 'speaking đổi số lượng');
  } else {
    S.forEach((s, i) => {
      sameKeys(orig.speaking[i], s, `${id} speaking[${i}]`);
      if (s.kind !== orig.speaking[i].kind) fail(id, `speaking[${i}].kind bị đổi`);
      if (orig.speaking[i].kind !== 'answer' && orig.speaking[i].kind !== 'opinion') {
        requireVi(id, `speaking[${i}].prompt`, s.prompt, 8);
      }
      if (!Array.isArray(s.checklist) || s.checklist.length < 3) fail(id, `speaking[${i}].checklist quá ngắn`);
      if (orig.speaking[i].kind === 'answer' || orig.speaking[i].kind === 'opinion') {
        requireZh(id, `speaking[${i}].prompt`, s.prompt);
        requireVi(id, `speaking[${i}].promptVi`, s.promptVi, 8);
        if (s.prompt !== out.freeTalk.question) fail(id, `speaking[${i}].prompt phải khớp freeTalk.question`);
        if (s.promptVi !== out.freeTalk.questionVi) fail(id, `speaking[${i}].promptVi phải khớp freeTalk.questionVi`);
        requireZh(id, `speaking[${i}].sampleZh`, s.sampleZh);
        requireVi(id, `speaking[${i}].sampleVi`, s.sampleVi, 15);
        if (s.prompt === S0[i].prompt) fail(id, `speaking[${i}] vẫn dùng câu hỏi buổi 1`);
        if (s.sampleZh === S0[i].sampleZh) fail(id, `speaking[${i}].sampleZh vẫn trùng buổi 1`);
      }
      if (orig.speaking[i].kind === 'repeat') {
        requireZh(id, `speaking[${i}].audioText`, s.audioText);
        requireZh(id, `speaking[${i}].reference`, s.reference);
        if (s.audioText !== s.reference) fail(id, `speaking[${i}] repeat: reference phải bằng audioText`);
        if (s.audioText === S0[i].audioText) fail(id, `speaking[${i}] vẫn dùng câu nhắc lại của buổi 1`);
      }
      if (orig.speaking[i].kind === 'read') {
        requireZh(id, `speaking[${i}].text`, s.text);
        if (s.text === S0[i].text) fail(id, `speaking[${i}].text vẫn trùng buổi 1`);
        const sentences = String(s.text)
          .split(/[。！？]/)
          .filter((x) => x.trim());
        if (sentences.length < 3) fail(id, `speaking[${i}].text nên có ít nhất 3 câu`);
      }
      if (orig.speaking[i].kind === 'retell') {
        requireVi(id, `speaking[${i}].reference`, s.reference, 20);
        if (s.reference !== out.listening.translation) fail(id, 'retell.reference phải khớp bản dịch đoạn nghe buổi 2');
      }
    });
  }

  // ── checkpoint: phải giữ nguyên, bản vá nằm ở course-fixes/ ──
  if ('checkpoint' in orig) {
    if (JSON.stringify(out.checkpoint) !== JSON.stringify(orig.checkpoint)) {
      fail(id, 'checkpoint bị đổi — bản vá phải nằm trong course-fixes/, không sửa file buổi 2');
    }
    if (orig.checkpoint.official !== false) fail(id, 'checkpoint gốc phải có official: false');
  }

  // ── pronunciation: giữ nguyên ──
  if (JSON.stringify(out.pronunciation) !== JSON.stringify(orig.pronunciation)) {
    fail(id, 'pronunciation bị đổi (ngoài phạm vi buổi 2)');
  }

  changedFiles.push(name);
}

// so trùng tổng thể với buổi 1
for (const base of names) {
  const name = `${base}-d2.json`;
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) continue;
  const out = JSON.parse(fs.readFileSync(p, 'utf8'));
  const d1 = JSON.parse(fs.readFileSync(path.join(SRC, `${base}-d1.json`), 'utf8'));
  if (out.freeTalk.question === d1.freeTalk.question) dupStats.freeTalk += 1;
  if (out.transferTask === d1.transferTask) dupStats.transfer += 1;
  const sameSpeaking = out.speaking.every((s, i) => {
    const k = d1.speaking[i];
    return (
      s.prompt === k.prompt &&
      (s.audioText ?? '') === (k.audioText ?? '') &&
      (s.text ?? '') === (k.text ?? '') &&
      (s.sampleZh ?? '') === (k.sampleZh ?? '')
    );
  });
  if (sameSpeaking) dupStats.speaking += 1;
  if (out.roleplay.opening === d1.roleplay.opening) dupStats.opening += 1;
}

console.log(`Đã kiểm ${changedFiles.length}/24 file trong course-day2/.`);
console.log(`Từ mở rộng: ${extTotal}. Trường pinyin được đối chiếu: ${pinyinFields}.`);
console.log(
  `Trùng buổi 1 — opening: ${dupStats.opening}/24, freeTalk: ${dupStats.freeTalk}/24, transferTask: ${dupStats.transfer}/24, toàn bộ speaking: ${dupStats.speaking}/24.`,
);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length})`);
  for (const e of errors.slice(0, 80)) console.log(`  x ${e}`);
  if (errors.length > 80) console.log(`  … còn ${errors.length - 80} lỗi`);
  process.exit(1);
}
console.log('\nOK: 24 file đúng cấu trúc, đã đổi tình huống, pinyin và thanh nhẹ hợp lệ.');
