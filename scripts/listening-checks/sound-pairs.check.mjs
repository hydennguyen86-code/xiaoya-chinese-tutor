// Kiểm tra content-for-misu/sound-pairs.json
// Chạy:  ELECTRON_RUN_AS_NODE=1 /Applications/Qoder.app/Contents/MacOS/Qoder content-for-misu/sound-pairs.check.mjs [đường-dẫn-json]
//
// Kiểm tra: cấu trúc, id duy nhất, pinyin khớp chữ Hán theo pinyin-pro, hai vế thật sự chỉ
// khác đúng cặp âm cần luyện (cùng thanh, cùng phần còn lại), nghĩa tiếng Việt có dấu,
// tipVi được đánh dấu là gần đúng.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'sound-pairs.json');

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const HAN = /\p{Script=Han}/u;
const VI_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/iu;
const TONE_MARK = { '\u0300': 4, '\u0301': 2, '\u0304': 1, '\u030C': 3 };

/** { letters: bỏ dấu thanh, giữ ü; tone: 1-4, 5 nếu không dấu } */
function stripTone(syllable) {
  let tone = 0;
  let out = '';
  for (const ch of syllable.normalize('NFD')) {
    if (TONE_MARK[ch]) {
      tone = TONE_MARK[ch];
      continue;
    }
    if (ch === '\u0308') {
      out += ch;
      continue;
    }
    if (ch >= '\u0300' && ch <= '\u036f') continue;
    out += ch;
  }
  return { letters: out.normalize('NFC').toLowerCase().replace(/v/g, 'ü'), tone: tone || 5 };
}

// Phụ âm đầu, khớp tham tối đa (zh/ch/sh dài hơn z/c/s).
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'w', 'y'];
function splitSyllable(letters) {
  const initial = INITIALS.find((i) => letters.startsWith(i)) ?? '';
  return { initial, final: letters.slice(initial.length) };
}

const REFERENCE = (hanzi) => {
  const syls = pinyin(hanzi, { pattern: 'tone', type: 'array' });
  return syls.map((s) => stripTone(s));
};

/** Kiểm tra một vế: pinyin có khớp chữ Hán không, trả về { letters, tone }. */
function checkSide(where, side, problems) {
  for (const key of ['hanzi', 'pinyin', 'meaningVi']) {
    if (side?.[key] === undefined) problems.push(`${where}: vế thiếu trường ${key}`);
  }
  const chars = [...String(side.hanzi ?? '')].filter((c) => HAN.test(c));
  const syls = String(side.pinyin ?? '').trim().split(/\s+/);
  if (!chars.length) {
    problems.push(`${where}: vế không có chữ Hán`);
    return null;
  }
  if (syls.length !== chars.length) {
    problems.push(`${where}: pinyin có ${syls.length} âm tiết nhưng hanzi có ${chars.length} chữ`);
    return null;
  }
  const ref = REFERENCE(side.hanzi);
  const parsed = syls.map((s, i) => {
    const { letters, tone } = stripTone(s);
    if (letters !== ref[i].letters) {
      problems.push(`${where}: "${s}" không khớp chữ "${chars[i]}" (pinyin-pro: ${ref[i].letters}${ref[i].tone})`);
    } else if (tone !== ref[i].tone && !(tone === 5 && ref[i].tone !== 5)) {
      problems.push(`${where}: dấu thanh của "${s}" (=${tone}) khác pinyin-pro (=${ref[i].tone})`);
    }
    return { letters, tone };
  });
  const meaning = String(side.meaningVi ?? '');
  if (HAN.test(meaning)) problems.push(`${where}: meaningVi lẫn chữ Hán`);
  if (!VI_DIACRITICS.test(meaning)) problems.push(`${where}: meaningVi thiếu dấu tiếng Việt`);
  return parsed;
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${FILE}: ${e.message}`);
  process.exit(1);
}

const problems = [];
if (data.source !== 'AI soạn, chưa duyệt') problems.push(`file: source phải là "AI soạn, chưa duyệt", đang là ${JSON.stringify(data.source)}`);
if (data.kind !== 'sound-pairs') problems.push('file: kind phải là "sound-pairs"');
if (!Array.isArray(data.levels) || data.levels.length !== 3) problems.push('file: thiếu levels (3 bậc)');
if (!data.schema) problems.push('file: thiếu mô tả schema');
if (!Array.isArray(data.pairs) || !data.pairs.length) {
  console.error('pairs rỗng');
  process.exit(1);
}

const seenId = new Set();
const seenWord = new Map();
let exampleCount = 0;

for (const pair of data.pairs) {
  const pid = pair?.id ?? '(không id)';
  if (!/^sp-[a-z0-9-]+$/.test(String(pair.id))) problems.push(`${pid}: id cặp sai định dạng sp-...`);
  if (seenId.has(pair.id)) problems.push(`${pid}: trùng id cặp`);
  seenId.add(pair.id);
  if (!Array.isArray(pair.contrast) || pair.contrast.length !== 2) problems.push(`${pid}: contrast phải là mảng 2 phần tử`);
  if (!['initial', 'final', 'umlaut'].includes(pair.type)) problems.push(`${pid}: type phải là initial|final|umlaut`);
  if (!pair.label) problems.push(`${pid}: thiếu label`);
  if (pair.tipApproximate !== true) problems.push(`${pid}: tipApproximate phải là true (mẹo khẩu hình chỉ gần đúng)`);
  if (!String(pair.tipVi ?? '').toLowerCase().includes('gần đúng')) problems.push(`${pid}: tipVi phải ghi rõ là gần đúng`);
  if (!Array.isArray(pair.examples)) {
    problems.push(`${pid}: examples không phải mảng`);
    continue;
  }
  if (pair.examples.length < 8 || pair.examples.length > 10) problems.push(`${pid}: cần 8–10 ví dụ, đang có ${pair.examples.length}`);

  const [ca, cb] = pair.contrast ?? [];
  for (const ex of pair.examples) {
    const xid = `${pid}/${ex?.id ?? '(không id)'}`;
    exampleCount += 1;
    const local = [];
    if (!/^sp-[a-z0-9-]+-\d{2}$/.test(String(ex.id))) local.push('id ví dụ sai định dạng sp-<cặp>-<2 chữ số>');
    if (seenId.has(ex.id)) local.push('trùng id ví dụ');
    seenId.add(ex.id);
    if (!['minimal', 'near'].includes(ex.kind)) local.push('kind phải là minimal|near');

    const A = checkSide(`${xid} (a)`, ex.a ?? {}, local);
    const B = checkSide(`${xid} (b)`, ex.b ?? {}, local);

    if (A && B && A.length === 1 && B.length === 1) {
      const a = A[0];
      const b = B[0];
      const { initial: ia } = splitSyllable(a.letters);
      const { initial: ib } = splitSyllable(b.letters);
      if (a.tone !== b.tone) local.push(`hai vế khác thanh (${a.tone} vs ${b.tone}) — cặp luyện phải cùng thanh để người học chỉ nghe một khác biệt`);

      if (pair.type === 'initial') {
        if (ia !== ca || ib !== cb) local.push(`phụ âm đầu phải là ${ca}/${cb}, đang là ${ia}/${ib}`);
        const fa = a.letters.slice(ca.length);
        const fb = b.letters.slice(cb.length);
        if (fa !== fb) local.push(`phần vần còn lại khác nhau: "${fa}" vs "${fb}" — không còn là cặp tối thiểu`);
      } else if (pair.type === 'final') {
        const endA = a.letters.slice(-ca.length);
        const endB = b.letters.slice(-cb.length);
        if (endA !== ca || endB !== cb) local.push(`vần phải kết thúc bằng ${ca}/${cb}, đang là ${endA}/${endB}`);
        if (a.letters.slice(0, -ca.length) !== b.letters.slice(0, -cb.length)) {
          local.push('phần đầu của vần khác nhau — không còn là cặp tối thiểu');
        }
        if (ia !== ib) local.push(`phụ âm đầu khác nhau (${ia}/${ib}) — với cặp vần thì phụ âm đầu phải giống nhau`);
      } else {
        // ü / u
        const aUmlaut = a.letters.includes('ü') || (['j', 'q', 'x', 'y'].includes(ia) && a.letters.endsWith('u'));
        const bUmlaut = b.letters.includes('ü') || (['j', 'q', 'x', 'y'].includes(ib) && b.letters.endsWith('u'));
        if (!aUmlaut) local.push(`vế a phải mang âm ü (${a.letters})`);
        if (bUmlaut) local.push(`vế b phải mang âm u thường (${b.letters})`);
        const fa = a.letters.replace(/ü/g, 'u').slice(ia.length);
        const fb = b.letters.replace(/ü/g, 'u').slice(ib.length);
        if (fa !== fb) local.push(`vần sau phụ âm đầu phải giống nhau: "${fa}" vs "${fb}"`);
        if (ex.kind === 'minimal' && ia !== ib) local.push('kind=minimal nhưng phụ âm đầu khác nhau (phải là near)');
        if (ex.kind === 'near' && ia === ib) local.push('kind=near nhưng hai vế cùng phụ âm đầu (thực chất là minimal)');
      }
    } else if (A && B) {
      local.push('cặp ví dụ phải là âm tiết đơn (mỗi vế 1 âm tiết)');
    }

    for (const side of [['a', ex.a], ['b', ex.b]]) {
      // Chỉ tính trùng trong cùng một cặp; một chữ hoàn toàn có thể xuất hiện ở cặp khác
      // vì mỗi cặp luyện một đối chiếu âm khác nhau.
      const word = `${pid}|${side[1]?.hanzi}|${side[1]?.pinyin}`;
      if (seenWord.has(word)) local.push(`lặp lại từ đã dùng ở ${seenWord.get(word)}`);
      else seenWord.set(word, ex.id);
    }
    if (ex.uncertain === true && !ex.uncertainReason) local.push('uncertain=true mà thiếu uncertainReason');

    if (local.length) problems.push(...local.map((m) => (m.startsWith(`${xid}`) ? m : `${xid}: ${m}`)));
    else if (ex.uncertain === true) warn(xid, `uncertain: ${ex.uncertainReason}`);
  }
}

console.log(`File: ${FILE}`);
console.log(`Số cặp: ${data.pairs.length}; tổng ví dụ: ${exampleCount}`);
for (const p of data.pairs) console.log(`  ${p.label}: ${p.examples.length} ví dụ (${p.examples.filter((e) => e.kind === 'near').length} near)`);
const uncertain = data.pairs.flatMap((p) => p.examples.filter((e) => e.uncertain === true).map((e) => e.id));
console.log(`Uncertain (${uncertain.length}): ${uncertain.join(', ') || '—'}`);

if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length})`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (problems.length) {
  console.log(`\nLỖI (${problems.length})`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log('\nOK: cấu trúc, id, pinyin-pro và tính cặp tối thiểu đều hợp lệ.');
