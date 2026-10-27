import fs from 'node:fs';
// Packaged courses that ship a listening bank, mapped to how many days a lesson has.
// Only admit these identifiers. Never resolve a user-supplied path.
const COURSE_LISTENING_DAYS = { 'pinyin-intro': 1, 'hsk1-practical': 2, 'hsk3-practical': 2, 'hsk5-practical': 2 };
export function readCourseListening(volumeId, lessonNo, day) {
  const maxDay = COURSE_LISTENING_DAYS[volumeId];
  if (!maxDay || !Number.isInteger(lessonNo) || lessonNo < 1 || !Number.isInteger(day) || day < 1 || day > maxDay) return null;
  const name = `${volumeId}-${lessonNo}-d${day}`;
  const file = new URL(`../lessons/listening/course/${name}.json`, import.meta.url);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    data.version !== 1 ||
    data.source !== 'AI soạn, chưa duyệt' ||
    data.lesson !== name ||
    !Array.isArray(data.dictation) ||
    !Array.isArray(data.shadowing)
  )
    throw new Error('Invalid packaged course listening.');
  return { source: data.source, dictation: data.dictation, shadowing: data.shadowing };
}
