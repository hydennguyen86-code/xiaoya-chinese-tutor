import fs from 'node:fs';
import path from 'node:path';
import { normalizeLesson } from '../server/lessonContent.mjs';
import { reviewProblems } from '../server/lessonReview.mjs';

const filename = process.argv[2];
if (!filename) {
  console.error('Dùng: npm run review:lesson -- <file.json> [--check]');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(filename, 'utf8'));
const outline = { no: raw.lessonNo, title: raw.lessonTitle, vocab: [], patterns: [], days: raw.days ?? 2 };
const { content, problems } = normalizeLesson(raw, outline, { day: raw.day ?? 1 });
const print = (value) => console.log(value ?? '');
print(`${raw.volumeId} · Bài ${raw.lessonNo} · Buổi ${raw.day} · ${raw.lessonTitle} · ${raw.level}`);
print(
  raw.reviewed
    ? `Khai báo duyệt: ${raw.reviewedBy ?? '(thiếu tên)'} · ${raw.reviewedAt ?? '(thiếu ngày)'}`
    : 'BẢN NHÁP — Bài do AI soạn, chưa được giáo viên duyệt',
);
print('\nTỪ VỰNG (pinyin được tính lại từ chữ Hán khi nạp):');
for (const word of raw.vocab ?? []) {
  const normalized = content.vocab.find((entry) => entry.word === word.word);
  print(`\n${word.word} [${normalized?.pinyin ?? word.pinyin ?? '?'}] — ${word.meaning}`);
  print(`  ${word.example}\n  ${normalized?.examplePinyin ?? word.examplePinyin ?? '?'}\n  ${word.exampleVi}`);
}
print('\nMẪU CÂU:');
for (const pattern of raw.patterns ?? []) {
  const normalized = content.patterns.find((entry) => entry.pattern === pattern.pattern);
  print(
    `\n${pattern.pattern} — ${pattern.explanation}\n  ${pattern.example}\n  ${normalized?.examplePinyin ?? pattern.examplePinyin ?? '?'}\n  ${pattern.exampleVi}`,
  );
}
print('\nNHẬP VAI:');
print(JSON.stringify(raw.roleplay, null, 2));
print('\nNÓI TỰ DO:');
print(JSON.stringify(raw.freeTalk, null, 2));
for (const section of ['pronunciation', 'learningNotes', 'listening', 'speaking', 'checkpoint']) {
  if (raw[section]) {
    print(`\n${section.toUpperCase()}:`);
    print(JSON.stringify(raw[section], null, 2));
  }
}
print(`\nGhi chú người duyệt: ${raw.notes ?? '(chưa có)'}`);
const isReviewedFile = path
  .resolve(filename)
  .split(path.sep)
  .some((part) => ['reviewed', 'lessons-reviewed'].includes(part));
const errors = [...problems, ...(raw.reviewed || isReviewedFile || process.argv.includes('--check') ? reviewProblems(raw) : [])];
if (!raw.level) errors.push('thiếu level');
if (!raw.volumeId || !Number.isInteger(raw.lessonNo) || !Number.isInteger(raw.day)) errors.push('thiếu mã tập/bài/buổi');
if (errors.length) {
  console.error('\nCẦN SỬA:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  print('\nCấu trúc hợp lệ. Công cụ không tự xác nhận nghĩa, độ tự nhiên hay độ khó.');
  if (!raw.reviewed)
    print(
      'Người duyệt điền reviewed: true, reviewedBy, reviewedAt, notes; chạy lại với --check rồi chuyển sang lessons/reviewed/<volumeId>-<lessonNo>-d<day>.json.',
    );
}
