// Dẫn xuất danh sách từ/ngữ pháp HSK từ hai nguồn MIT nằm NGOÀI repo.
//
//   node scripts/build-hsk-standard.mjs <đường-dẫn/complete.min.json> <đường-dẫn/hsk30-grammar.csv>
//
// Đầu vào:
//   - complete.min.json  — https://github.com/drkameleon/complete-hsk-vocabulary (MIT)
//     Mỗi từ mang thẻ mức: o1..o6 = HSK 2.0, n1..n7 = HSK 3.0 (2021), t1..t7 = bản sửa 2025.
//   - hsk30-grammar.csv  — https://github.com/ivankra/hsk30 (MIT), 624 điểm ngữ pháp HSK 3.0.
//
// Đầu ra (commit vào eval/ để chạy lại không cần mạng):
//   - eval/hsk-standard.json   từ + pinyin + mức nhỏ nhất theo từng phiên bản (chỉ 1..6)
//   - eval/hsk-grammar-30.json điểm ngữ pháp HSK 3.0 theo mức 1..6
// Không suy diễn: từ không có trong dải 1..6 của một phiên bản thì để null, không đoán mức.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const [vocabArg, grammarArg] = process.argv.slice(2);
if (!vocabArg || !grammarArg) {
  console.error('Dùng: node scripts/build-hsk-standard.mjs <complete.min.json> <hsk30-grammar.csv>');
  process.exit(1);
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const vocabRaw = fs.readFileSync(vocabArg);
const grammarRaw = fs.readFileSync(grammarArg);
const VERSIONS = { old: 'HSK 2.0', new: 'HSK 3.0 (2021)', newest: 'HSK 3.0 bản sửa 2025' };
const PREFIX = { o: 'old', n: 'new', t: 'newest' };

const entries = JSON.parse(vocabRaw.toString('utf8'));
const words = [];
const counts = { old: {}, new: {}, newest: {} };
for (const e of entries) {
  const min = { old: null, new: null, newest: null };
  for (const tag of e.l || []) {
    const version = PREFIX[tag[0]];
    const level = Number(tag.slice(1));
    if (!version || !(level >= 1 && level <= 6)) continue; // 7/7-9 nằm ngoài dải ứng dụng dùng
    if (min[version] === null || level < min[version]) min[version] = level;
  }
  if (!min.old && !min.new && !min.newest) continue;
  const pinyin = e.f?.[0]?.i?.y ?? '';
  words.push({ w: e.s, py: pinyin, old: min.old, new: min.new, newest: min.newest });
  for (const v of Object.keys(min)) if (min[v]) counts[v][min[v]] = (counts[v][min[v]] || 0) + 1;
}
words.sort((a, b) => a.w.localeCompare(b.w, 'zh'));

const cumulative = {};
for (const v of Object.keys(counts)) {
  cumulative[v] = {};
  let sum = 0;
  for (let l = 1; l <= 6; l += 1) {
    sum += counts[v][l] || 0;
    cumulative[v][l] = sum;
  }
}

const grammarRows = parseCsv(grammarRaw.toString('utf8'));
const grammar = grammarRows
  .map((r) => ({ level: Number(r.Level), group: r.Group, category: r.Category, details: r.Details, content: r.Content }))
  .filter((g) => g.level >= 1 && g.level <= 6);
const grammarCounts = {};
for (const g of grammar) grammarCounts[g.level] = (grammarCounts[g.level] || 0) + 1;

const standard = {
  generatedBy: 'scripts/build-hsk-standard.mjs',
  note: 'Danh sách mức do nguồn thứ ba cung cấp, không phải nội dung Misu. null = từ không thuộc dải 1–6 của phiên bản đó.',
  sources: [
    {
      project: 'complete-hsk-vocabulary',
      url: 'https://github.com/drkameleon/complete-hsk-vocabulary',
      license: 'MIT',
      file: path.basename(vocabArg),
      sha256: sha(vocabRaw),
      versions: VERSIONS,
      tagLegend: 'o = HSK 2.0, n = HSK 3.0 (2021), t = bản sửa 2025; chữ số sau là mức.',
    },
    {
      project: 'hsk30 (ngữ pháp)',
      url: 'https://github.com/ivankra/hsk30',
      license: 'MIT',
      file: path.basename(grammarArg),
      sha256: sha(grammarRaw),
    },
  ],
  retrievedAt: new Date().toISOString().slice(0, 10),
  entryCount: entries.length,
  wordCount: words.length,
  exclusive: counts,
  cumulative,
  words,
};

fs.writeFileSync(path.join(ROOT, 'eval', 'hsk-standard.json'), JSON.stringify({ ...standard, words: undefined }, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'eval', 'hsk-standard.words.jsonl'), words.map((w) => JSON.stringify(w)).join('\n') + '\n');
fs.writeFileSync(
  path.join(ROOT, 'eval', 'hsk-grammar-30.json'),
  JSON.stringify({ generatedBy: 'scripts/build-hsk-standard.mjs', note: 'Ngữ pháp HSK 3.0, mức 1–6. Mã nguồn mở MIT, không phải nội dung Misu.', counts: grammarCounts, items: grammar }, null, 1) + '\n',
);

console.log('Từ đã dẫn xuất (còn ở mức 1–6):', words.length, '/', entries.length);
console.log('Số từ mới mỗi mức:', JSON.stringify(counts));
console.log('Lũy kế mỗi mức   :', JSON.stringify(cumulative));
console.log('Điểm ngữ pháp HSK 3.0 theo mức:', JSON.stringify(grammarCounts));
console.log('Đã ghi eval/hsk-standard.json, eval/hsk-standard.words.jsonl, eval/hsk-grammar-30.json');

// RFC4180 tối giản: đủ cho hsk30-grammar.csv (dấu phẩy trong ngoặc kép được hỗ trợ).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
