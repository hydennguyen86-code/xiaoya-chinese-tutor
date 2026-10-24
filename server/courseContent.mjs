import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COURSE_DIR = fileURLToPath(new URL('../lessons/courses/', import.meta.url));
export function bundledSyllabus() {
  return JSON.parse(fs.readFileSync(path.join(COURSE_DIR, 'syllabus.json'), 'utf8'));
}
export function readCourseLesson(volumeId, lessonNo, day) {
  const manifest = bundledSyllabus();
  const volume = manifest.volumes.find((v) => v.id === volumeId);
  if (!volume?.lessons.some((l) => l.no === lessonNo && day >= 1 && day <= l.days)) return null;
  // Resolve only filenames admitted by the packaged manifest; no arbitrary paths.
  return JSON.parse(fs.readFileSync(path.join(COURSE_DIR, `${volume.id}-${lessonNo}-d${day}.json`), 'utf8'));
}
