// Bảng đối chiếu từ vựng + ngữ pháp HSK cho từng lộ trình trong lessons/courses/.
//
// node scripts/hsk-coverage.mjs [--json]
//
// Đầu vào: lessons/courses/*.json, eval/hsk-standard.json, eval/hsk-standard.words.jsonl,
// eval/hsk-grammar-30.json (dẫn xuất bằng scripts/build-hsk-standard.mjs).
// Đầu ra : lessons/courses/HSK-COVERAGE.md (bảng người đọc) và
// eval/results/hsk-coverage-<ngày>.json (danh sách thiếu đầy đủ).
//
// Cách đo — và giới hạn của nó, ghi thẳng vào tài liệu:
// - "dạy" = từ xuất hiện trong vocab[].word hoặc checkpoint.glossary[].word của lộ trình.
// - "gặp" = chuỗi chữ Hán của từ xuất hiện trong bất kỳ trường tiếng Trung nào của lộ trình
// (đối chiếu chuỗi con, không tách từ, nên 中国 cũng khớp trong 中国人).
// - Không kết luận "đạt cấp": đây là phép so trùng hình thức với danh sách mức do bên thứ ba công bố.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const COURSES = path.join(ROOT, 'lessons', 'courses');
const standard = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'hsk-standard.json'), 'utf8'));
const words = fs
  .readFileSync(path.join(ROOT, 'eval', 'hsk-standard.words.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const grammar = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'hsk-grammar-30.json'), 'utf8'));
const VERSIONS = ['old', 'new', 'newest'];
const LEVELS = [1, 2, 3, 4, 5, 6];
const VERSION_LABEL = { old: 'HSK 2.0', new: 'HSK 3.0 (2021)', newest: 'HSK 3.0 bản sửa 2025' };

// Băng mức mà từng lộ trình tự công bố (level/targetLevel trong chính file bài học).
const TRACKS = [
  { id: 'pinyin-intro', title: 'Nhập môn Pinyin', from: 1, to: 2 },
  { id: 'hsk1-practical', title: 'HSK 1 · Nghe nói thực tế', from: 1, to: 2 },
  { id: 'hsk3-practical', title: 'HSK 3 · Nghe nói thực tế', from: 3, to: 4 },
  { id: 'hsk5-practical', title: 'HSK 5 · Nghe nói thực tế', from: 5, to: 6 },
  { id: 'misu30-1', title: '30 bài giao tiếp · Tập 1', from: 1, to: 2 },
  { id: 'misu30-2', title: '30 bài giao tiếp · Tập 2', from: 3, to: 4 },
  { id: 'misu30-3', title: '30 bài giao tiếp · Tập 3', from: 5, to: 6 },
];

function collect(files) {
  const taught = new Set();
  const glossary = new Set();
  const patternText = [];
  const corpus = [];
  let vocabSlots = 0;
  let patternSlots = 0;
  let pronunciationBlocks = 0;
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(COURSES, file), 'utf8'));
    for (const v of raw.vocab ?? []) {
      taught.add(v.word);
      vocabSlots += 1;
    }
    for (const g of raw.checkpoint?.glossary ?? []) glossary.add(g.word);
    for (const p of raw.patterns ?? []) {
      patternSlots += 1;
      patternText.push(p.pattern ?? '');
    }
    if ((raw.pronunciation?.length ?? 0) > 0) pronunciationBlocks += 1;
    walk(raw, (value) => {
      if (/\p{Script=Han}/u.test(value)) corpus.push(value);
    });
  }
  for (const w of glossary) taught.add(w);
  for (const w of [...taught]) if (!w || !/\p{Script=Han}/u.test(w)) taught.delete(w);
  return {
    taught,
    glossary,
    patterns: patternText.filter(Boolean),
    text: corpus.join('\n'),
    vocabSlots,
    patternSlots,
    pronunciationBlocks,
    lessonCount: files.length,
  };
}

function walk(node, visit) {
  if (typeof node === 'string') return visit(node);
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v, visit);
}

const filesOf = (id) => fs.readdirSync(COURSES).filter((f) => f.startsWith(`${id}-`) && f.endsWith('.json')).sort();

const data = TRACKS.map((track) => ({ ...track, ...collect(filesOf(track.id)) }));

function coverage(entry, version) {
  const perLevel = {};
  for (let l = 1; l <= 6; l += 1) perLevel[l] = { required: 0, taught: 0, seen: 0 };
  const missing = {};
  const outside = [];
  for (const w of words) {
    const level = w[version];
    if (!level) continue;
    perLevel[level].required += 1;
    const taughtHere = entry.taught.has(w.w);
    if (taughtHere) perLevel[level].taught += 1;
    if (entry.text.includes(w.w)) perLevel[level].seen += 1;
    if (level > entry.to) {
      if (taughtHere) outside.push({ word: w.w, pinyin: w.py, level });
    } else if (level >= entry.from && !taughtHere) {
      (missing[level] ||= []).push({ word: w.w, pinyin: w.py, seen: entry.text.includes(w.w) });
    }
  }
  let cumRequired = 0;
  let cumTaught = 0;
  let cumSeen = 0;
  for (let l = 1; l <= 6; l += 1) {
    cumRequired += perLevel[l].required;
    cumTaught += perLevel[l].taught;
    cumSeen += perLevel[l].seen;
    perLevel[l].cumRequired = cumRequired;
    perLevel[l].cumTaught = cumTaught;
    perLevel[l].cumSeen = cumSeen;
  }
  const bandRequired = sum(perLevel, entry.from, entry.to, 'required');
  const bandTaught = sum(perLevel, entry.from, entry.to, 'taught');
  const bandSeen = sum(perLevel, entry.from, entry.to, 'seen');
  return {
    perLevel,
    cumulative: { required: cumRequired, taught: cumTaught, seen: cumSeen },
    band: {
      required: bandRequired,
      taught: bandTaught,
      seen: bandSeen,
      cumRequired: perLevel[entry.to].cumRequired,
      cumTaught: perLevel[entry.to].cumTaught,
      cumSeen: perLevel[entry.to].cumSeen,
    },
    outside: outside.sort((a, b) => a.level - b.level || a.word.localeCompare(b.word, 'zh')),
    missing,
  };
}

function sum(perLevel, from, to, key) {
  let s = 0;
  for (let l = from; l <= to; l += 1) s += perLevel[l][key];
  return s;
}

// ── ngữ pháp HSK 3.0 ──
const META_FIELDS = (g) => `${g.group} ${g.category} ${g.details}`;
const HAN_RUNS = (s) => String(s).match(/[\p{Script=Han}]+/gu) ?? [];
// Toàn bộ thuật ngữ mô tả của bảng (单句, 主谓句, 疑问代词…) không phải dấu hiệu câu,
// nên loại khỏi danh sách marker ở mọi dòng.
const metaVocab = new Set(grammar.items.flatMap((g) => HAN_RUNS(META_FIELDS(g))));
// Marker chỉ đáng tin khi nó là một mục từ có thật trong danh sách HSK; các cụm như
// 主谓句、用动态助词 là nhãn phân loại của bảng nguồn, không phải khung câu để so.
const hskWords = new Set(words.map((w) => w.w));
// Bảng nguồn viết "用动态助词了、着、过表示" — 表示/达到 là lời dẫn, không phải khung câu.
const LEAD_IN = new Set(['表示', '达到', '说明', '包括', '相当于', '用于', '指', '如', '例如']);
function markersOf(item) {
  const meta = META_FIELDS(item);
  const runs = HAN_RUNS(item.content).filter((run) => !meta.includes(run) && !metaVocab.has(run) && !LEAD_IN.has(run));
  return [...new Set(runs)];
}
const grammarItems = grammar.items.map((g) => {
  const markers = markersOf(g);
  return {
    ...g,
    markers,
    // Chỉ có hư từ một chữ làm dấu hiệu thì phép so không đủ tin: 得 khớp cả trong 得到.
    weak: markers.every((m) => m.length === 1),
    strong: markers.filter((m) => m.length > 1 && hskWords.has(m)),
  };
});

function grammarCoverage(entry) {
  const patternBlob = entry.patterns.join('\n');
  const perLevel = {};
  const uncovered = [];
  const unusedStrong = [];
  for (let l = 1; l <= 6; l += 1) perLevel[l] = { items: 0, taught: 0, used: 0, weak: 0, strong: 0, strongUsed: 0 };
  for (const item of grammarItems) {
    if (item.level > 6) continue;
    const p = perLevel[item.level];
    p.items += 1;
    const taught = item.markers.some((m) => patternBlob.includes(m));
    const used = item.markers.some((m) => entry.text.includes(m));
    if (taught) p.taught += 1;
    if (used) p.used += 1;
    if (item.weak) p.weak += 1;
    if (item.strong.length) {
      p.strong += 1;
      if (used) p.strongUsed += 1;
      if (!used && item.level <= entry.to)
        unusedStrong.push({ level: item.level, group: item.group, category: item.category, details: item.details, markers: item.strong.slice(0, 6) });
    }
    if (!used && item.level <= entry.to) uncovered.push({ level: item.level, category: item.category, details: item.details, content: item.content.slice(0, 80) });
  }
  const bandItems = sum(perLevel, 1, entry.to, 'items');
  return {
    perLevel,
    band: {
      items: bandItems,
      taught: sum(perLevel, 1, entry.to, 'taught'),
      used: sum(perLevel, 1, entry.to, 'used'),
      weak: sum(perLevel, 1, entry.to, 'weak'),
      strong: sum(perLevel, 1, entry.to, 'strong'),
      strongUsed: sum(perLevel, 1, entry.to, 'strongUsed'),
    },
    uncovered,
    unusedStrong: unusedStrong.sort((a, b) => a.level - b.level || a.category.localeCompare(b.category, 'vi')),
  };
}

const results = data.map((entry) => ({
  track: entry.id,
  title: entry.title,
  band: `HSK ${entry.from}${entry.from === entry.to ? '' : `–${entry.to}`}`,
  from: entry.from,
  to: entry.to,
  lessons: entry.lessonCount,
  vocabSlots: entry.vocabSlots,
  distinctWords: entry.taught.size,
  patterns: entry.patternSlots,
  pronunciationCards: entry.pronunciationBlocks,
  vocabulary: Object.fromEntries(VERSIONS.map((v) => [v, coverage(entry, v)])),
  grammar: grammarCoverage(entry),
}));

const unionTaught = new Set();
for (const entry of data) for (const w of entry.taught) unionTaught.add(w);
const unionEntry = { from: 1, to: 6, taught: unionTaught, text: data.map((entry) => entry.text).join('\n') };
const unionBy = Object.fromEntries(VERSIONS.map((v) => [v, coverage(unionEntry, v)]));

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const cell = (c) => `${c.taught}/${c.required} (${pct(c.taught, c.required)})`;

const lines = [];
lines.push('# Bảng đối chiếu từ vựng và ngữ pháp HSK');
lines.push('');
lines.push(
  `Sinh bởi \`node scripts/hsk-coverage.mjs\` ngày ${standard.retrievedAt} · danh sách mức lấy từ nguồn mã mở MIT đã ghi nhận ở [NOTICE.md](../../NOTICE.md): HSK 2.0, HSK 3.0 (2021) và bản sửa 2025, ngữ pháp theo bảng HSK 3.0 (624 điểm, chỉ dùng mức 1–6).`,
);
lines.push('');
lines.push(
  '**Đọc bảng này thế nào.** "Dạy" là từ hiện trong `vocab[].word` hoặc chú giải của đề chặng; "gặp" là chuỗi chữ của từ xuất hiện đâu đó trong phần tiếng Trung của lộ trình (đối chiếu chuỗi con, không tách từ). Ô là `số từ đã dạy / số từ danh sách yêu cầu` cho đúng mức đó. **Không có ô nào ở đây chứng nhận người học đạt cấp**: đây là so trùng hình thức giữa kho bài và danh sách mức công bố, chưa có giáo viên duyệt, và chưa tính chất lượng ngữ cảnh của từng từ.',
);
lines.push('');
lines.push('Băng mức mỗi lộ trình tự công bố: ' + results.map((r) => `${r.title} = ${r.band}`).join(' · ') + '. App chưa có lộ trình mang tên HSK 2, HSK 4, HSK 6.');
lines.push('');
lines.push(
  `**Bức tranh chung.** Cả bảy lộ trình dạy ${unionTaught.size} từ khác nhau, tức ${pct(unionBy.old.cumulative.taught, unionBy.old.cumulative.required)} kho từ vựng HSK 2.0 (mức 1–6) và ${pct(unionBy.newest.cumulative.taught, unionBy.newest.cumulative.required)} theo bản sửa 2025. Số đó dồn ở mức 1–2 (${unionBy.old.perLevel[1].taught}/${unionBy.old.perLevel[1].required} từ mức 1, ${unionBy.old.perLevel[2].taught}/${unionBy.old.perLevel[2].required} từ mức 2). Ở mức 5–6 chỉ dạy ${unionBy.old.perLevel[5].taught + unionBy.old.perLevel[6].taught} từ và chỉ ${unionBy.old.perLevel[5].seen + unionBy.old.perLevel[6].seen} từ trong ${unionBy.old.perLevel[5].required + unionBy.old.perLevel[6].required} từ của hai mức này từng xuất hiện ở đâu đó trong bài. Nói thẳng: đây là khoá giao tiếp thực tế, không phải chương trình luyện thi phủ trọn cấp.`,
);
lines.push('');
lines.push('| Lộ trình | Số buổi | Chỗ từ vựng | Từ phân biệt được dạy | Mẫu câu | Buổi có thẻ phát âm |');
lines.push('|---|---|---|---|---|---|');
for (const r of results) lines.push(`| ${r.title} | ${r.lessons} | ${r.vocabSlots} | ${r.distinctWords} | ${r.patterns} | ${r.pronunciationCards}/${r.lessons} |`);
lines.push('');
lines.push('Cột "Buổi có thẻ phát âm" là mô tả, không phải chỗ thiếu cần bù: thẻ nhận âm thanh điệu chỉ soạn cho băng HSK 1–3. Từ HSK 4 người học đã qua giai đoạn nhận âm, luyện nói của các bậc cao đi qua chép lời và nhắc lại theo giọng trong phần Hội thoại nhập vai.');
lines.push('');

for (const version of VERSIONS) {
  lines.push(`## Từ vựng theo ${VERSION_LABEL[version]}`);
  lines.push('');
  lines.push('| Lộ trình | ' + [1, 2, 3, 4, 5, 6].map((l) => `Mức ${l}`).join(' | ') + ' | Lũy kế tới băng | Trong băng | Ngoài băng |');
  lines.push('|---|' + '---|'.repeat(9));
  for (const r of results) {
    const c = r.vocabulary[version];
    const cells = [1, 2, 3, 4, 5, 6].map((l) => (l < r.from && r.from > 1 ? '–' : cell(c.perLevel[l])));
    lines.push(
      `| ${r.title} | ${cells.join(' | ')} | dạy ${c.band.cumTaught} · gặp ${c.band.cumSeen} / ${c.band.cumRequired} (${pct(c.band.cumTaught, c.band.cumRequired)}) | ${c.band.taught} dạy · ${c.band.seen} gặp / ${c.band.required} | ${c.outside.length} |`,
    );
  }
  lines.push('');
  lines.push(
    `Mẫu số theo từng mức: ${[1, 2, 3, 4, 5, 6].map((l) => `mức ${l} = ${standard.exclusive[version][l] || 0} từ mới (tổng ${standard.cumulative[version][l]})`).join('; ')}.`,
  );
  lines.push('');
}

lines.push('## Ngữ pháp theo HSK 3.0 (mức 1–6)');
lines.push('');
lines.push(
  'Điểm ngữ pháp được tính là "dạy" khi một dấu hiệu hình thức của nó (hư từ hoặc khung câu trong bảng) xuất hiện trong `patterns[].pattern` của lộ trình; "gặp" khi dấu hiệu đó xuất hiện ở bất kỳ câu tiếng Trung nào. Ô là `dạy · gặp / số điểm`. Bảng nguồn trộn nhãn phân loại (主谓句, 用动态助词) với dấu hiệu thật, nên cột cuối chỉ đếm các điểm có dấu hiệu từ hai chữ và có mặt trong danh sách từ vựng HSK — phần mà phép so này đủ tin.',
);
lines.push('');
lines.push(`| Lộ trình | ${LEVELS.map((l) => `Mức ${l}`).join(' | ')} | Lũy kế tới băng | Điểm có dấu hiệu đủ tin đã gặp |`);
lines.push(`|---|${'---|'.repeat(8)}`);
for (const r of results) {
  const g = r.grammar;
  const cells = [1, 2, 3, 4, 5, 6].map((l) => {
    const p = g.perLevel[l];
    return l < r.from && r.from > 1 ? '–' : `${p.taught} · ${p.used} / ${p.items}`;
  });
  lines.push(
    `| ${r.title} | ${cells.join(' | ')} | dạy ${g.band.taught} · gặp ${g.band.used} / ${g.band.items} (${pct(g.band.used, g.band.items)}) | ${g.band.strongUsed}/${g.band.strong} · trong ${g.band.items} điểm thì chỉ ${g.band.strong} là đủ tin để so |`,
  );
}
lines.push('');

lines.push('## Chỗ thiếu rõ nhất (theo HSK 2.0, mức thuộc băng của lộ trình)');
lines.push('');
lines.push(
  'Cột "chưa dạy" là số từ của mức đó không có trong `vocab`/chú giải. Cột "chưa thấy đâu" chỉ những từ thậm chí không xuất hiện lần nào trong phần tiếng Trung của lộ trình — đó là khoảng trống thật. Ví dụ lấy từ nhóm "chưa thấy đâu" rồi đến nhóm còn lại.',
);
lines.push('');
lines.push('| Lộ trình | Mức | Chưa dạy | Trong đó chưa thấy đâu | Ví dụ từ còn thiếu |');
lines.push('|---|---|---|---|---|');
for (const r of results) {
  const c = r.vocabulary.old;
  for (let l = r.from; l <= r.to; l += 1) {
    const list = c.missing[l] ?? [];
    if (!list.length && !c.perLevel[l].required) continue;
    const never = list.filter((m) => !m.seen);
    const sample = [...never, ...list.filter((m) => m.seen)].slice(0, 12);
    lines.push(
      `| ${r.title} | ${l} | ${list.length}/${c.perLevel[l].required} | ${never.length}/${c.perLevel[l].required} | ${sample.map((m) => `${m.word} (${m.pinyin})`).join(', ')}${list.length > 12 ? ' …' : ''} |`,
    );
  }
}
lines.push('');
lines.push('## Cả kho bài cộng lại');
lines.push('');
lines.push('Một người học đi hết cả bảy lộ trình thì số từ *khác nhau* đã dạy theo từng mức là:');
lines.push('');
lines.push(`| Chuẩn | ${LEVELS.map((l) => `Mức ${l}`).join(' | ')} | Lũy kế 1–6 |`);
lines.push('|---|' + '---|'.repeat(7));
for (const version of VERSIONS) {
  const u = unionBy[version];
  lines.push(
    `| ${VERSION_LABEL[version]} | ${[1, 2, 3, 4, 5, 6].map((l) => `${u.perLevel[l].taught}/${u.perLevel[l].required} (${pct(u.perLevel[l].taught, u.perLevel[l].required)})`).join(' | ')} | ${u.cumulative.taught}/${u.cumulative.required} (${pct(u.cumulative.taught, u.cumulative.required)}) |`,
  );
}
lines.push('');
lines.push('## Từ vượt băng mà bài vẫn dạy');
lines.push('');
lines.push('| Lộ trình | Số từ vượt băng | Ví dụ |');
lines.push('|---|---|---|');
for (const r of results) {
  const o = r.vocabulary.old.outside;
  lines.push(`| ${r.title} | ${o.length} | ${o.slice(0, 10).map((m) => `${m.word} (${m.pinyin}, mức ${m.level})`).join(', ')}${o.length > 10 ? ' …' : ''} |`);
}
lines.push('');
lines.push('## Khung câu có dấu hiệu đủ tin mà lộ trình chưa dùng');
lines.push('');
lines.push('Chỉ tính các điểm ngữ pháp từ mức 1 đến đỉnh băng của lộ trình mà bảng nguồn cho dấu hiệu từ hai chữ trở lên và dấu hiệu đó là một mục từ HSK, rồi liệt kê các điểm mà dấu hiệu ấy không xuất hiện ở bất kỳ câu tiếng Trung nào trong lộ trình. Đây là danh sách để bổ sung bài, không phải điểm trừ có tính chứng chỉ.');
lines.push('');
lines.push('| Lộ trình | Số điểm | Ví dụ (cấp · nhóm · dấu hiệu) |');
lines.push('|---|---|---|');
for (const r of results) {
  const u = r.grammar.unusedStrong;
  lines.push(
    `| ${r.title} | ${u.length}/${r.grammar.band.strong} | ${u.slice(0, 10).map((m) => `mức ${m.level} · ${m.details || m.category}: ${m.markers.join('、')}`).join('; ')}${u.length > 10 ? '; …' : ''} |`,
  );
}
lines.push('');
lines.push(
  '## Giới hạn cần nói thẳng',
);
lines.push('');
lines.push([
  `- "Dạy" chỉ ghi nhận mặt chữ: một từ có thể nằm trong ` + '`vocab`' + ` nhưng bài không cho đủ ngữ cảnh để dùng được, và ngược lại một từ chỉ xuất hiện trong bản chép lời vẫn có giá trị tiếp xúc.`,
  '- Bảng mức của bên thứ ba không thống nhất tuyệt đối: HSK 2.0 trong nguồn này có 4.991 từ lũy kế thay vì 5.000 vì một số mục trùng/gộp; HSK 3.0 (2021) là 5.363 từ cho mức 1–6, bản 2025 là 5.181. Con số làm tròn hay gặp trên mạng (5.000 / 5.500) khác nhau ở phần gộp mức.',
  '- Ngữ pháp chỉ đếm được theo dấu hiệu hình thức. Một điểm như câu chữ 把 có thể bài đã luyện mà không có mẫu câu nào nêu tên nó, nên cột "dạy" luôn thấp hơn thực tế; cột "gặp" thì ngược lại, dễ đánh giá ảo vì hư từ đơn xuất hiện ở khắp nơi. Hai cột kẹp giữa "chắc chắn có" và "chắc chắn không", không cột nào là điểm đạt. Bảng nguồn cũng gộp nhiều điểm trong một dòng (loại từ, lượng từ), nên số "425 điểm mức 1–6" không phải số bài ngữ pháp.',
  '- Chưa đối chiếu chữ Hán (character list) và chưa đối chiếu độ khó câu/độ dài bản nghe. Muốn tuyên bố phủ chương trình thì cần người có chuyên môn duyệt từng mức.',
  '- App không có lộ trình HSK 2, HSK 4, HSK 6; người học cấp đó phải tự ghép từ các băng hiện có.',
].join('\n'));
lines.push('');
lines.push('Chạy lại: `node scripts/hsk-coverage.mjs` (cần `eval/hsk-standard.json`, tái tạo bằng `node scripts/build-hsk-standard.mjs <complete.min.json> <hsk30-grammar.csv>` với hai file nguồn MIT lấy từ GitHub).');
lines.push('');
lines.push('Lấy danh sách đầy đủ các từ chưa từng xuất hiện trong một lộ trình: `node scripts/hsk-coverage.mjs --gaps <track> <mức> [old|new|newest]`, ví dụ `--gaps hsk1-practical 1`.');

fs.writeFileSync(path.join(COURSES, 'HSK-COVERAGE.md'), lines.join('\n') + '\n');
const stamp = new Date().toISOString().slice(0, 10);
// Danh sách từ còn thiếu đầy đủ có thể dài hàng nghìn dòng; chỉ giữ số đếm trong file
// nộp vào repo, bản đầy đủ lấy bằng --gaps.
const artifact = results.map((r) => ({
  ...r,
  vocabulary: Object.fromEntries(
    VERSIONS.map((v) => {
      const { missing, ...rest } = r.vocabulary[v];
      const missingCounts = {};
      for (const [level, list] of Object.entries(missing ?? {})) missingCounts[level] = { notTaught: list.length, neverSeen: list.filter((m) => !m.seen).length };
      return [v, { ...rest, missingCounts }];
    }),
  ),
  grammar: (({ uncovered, ...g }) => g)(r.grammar),
}));
fs.writeFileSync(path.join(ROOT, 'eval', 'results', `hsk-coverage-${stamp}.json`), JSON.stringify({ generatedBy: 'scripts/hsk-coverage.mjs', ranAt: new Date().toISOString(), standard: standard.sources, results: artifact }, null, 1) + '\n');
console.log('Đã ghi lessons/courses/HSK-COVERAGE.md và eval/results/hsk-coverage-' + stamp + '.json');

const gapsAt = process.argv.indexOf('--gaps');
if (gapsAt > -1) {
  const trackArg = process.argv[gapsAt + 1] ?? 'hsk1-practical';
  const levelArg = Number(process.argv[gapsAt + 2] ?? 1);
  const versionArg = process.argv[gapsAt + 3] ?? 'old';
  const r = results.find((x) => x.track === trackArg || x.title === trackArg);
  if (!r) throw new Error(`Không có lộ trình "${trackArg}". Có: ${results.map((x) => x.track).join(', ')}`);
  const list = r.vocabulary[versionArg]?.missing?.[levelArg] ?? [];
  const never = list.filter((m) => !m.seen);
  console.log(`${r.title} · ${VERSION_LABEL[versionArg]} mức ${levelArg}: ${list.length} từ chưa dạy, ${never.length} từ chưa từng xuất hiện trong bài`);
  console.log(never.map((m) => `${m.word}\t${m.pinyin}`).join('\n'));
}
if (process.argv.includes('--json'))
  console.log(
    JSON.stringify(
      results.map((r) => ({
        track: r.track,
        band: r.band,
        lessons: r.lessons,
        words: r.distinctWords,
        vocabulary: Object.fromEntries(VERSIONS.map((v) => [v, r.vocabulary[v].band])),
        grammar: r.grammar.band,
      })),
      null,
      1,
    ),
  );
