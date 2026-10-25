import fs from 'node:fs';
// Only admit packaged course identifiers. Never resolve a user-supplied path.
export function readCourseListening(volumeId, lessonNo, day) {
  if (!/^hsk[15]-practical$/.test(volumeId) || !Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > 12 || ![1, 2].includes(day))
    return null;
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
