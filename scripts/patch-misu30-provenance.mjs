import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_DIR } from '../server/courseContent.mjs';
export function applyMisu30Provenance(
  root = COURSE_DIR,
  patch = JSON.parse(fs.readFileSync(new URL('../lessons/courses/patches/misu30-provenance.json', import.meta.url))),
) {
  if (patch.version !== 1 || patch.volumes.length !== 3 || patch.lessons.length !== 30) throw new Error('Invalid provenance patch.');
  const writes = [],
    syllabusFile = path.join(root, 'syllabus.json'),
    syllabus = JSON.parse(fs.readFileSync(syllabusFile));
  for (const update of patch.volumes) {
    if (!/^misu30-[123]$/.test(update.id)) throw new Error('Invalid volume.');
    const volume = syllabus.volumes.find((v) => v.id === update.id);
    if (!volume || volume.source.sha256 !== update.source.sha256) throw new Error('Source hash changed.');
    Object.assign(volume, { source: update.source, sourceBook: update.sourceBook, sourceTitle: update.sourceTitle });
  }
  for (const update of patch.lessons) {
    if (!/^misu30-[123]-\d+-d1\.json$/.test(update.file)) throw new Error('Invalid patch filename.');
    const file = path.join(root, update.file),
      raw = JSON.parse(fs.readFileSync(file));
    if (raw.source.sha256 !== update.source.sha256 || raw.lessonTitle !== update.source.lessonTitle || raw.reviewed !== false)
      throw new Error('Lesson identity changed.');
    if (
      JSON.stringify(update.prerequisites) !== JSON.stringify(raw.prerequisites) &&
      !(
        [11, 21].includes(raw.lessonNo) &&
        update.prerequisites.length === 0 &&
        JSON.stringify(raw.prerequisites) === JSON.stringify([raw.lessonNo - 1])
      )
    )
      throw new Error('Unexpected prerequisites change.');
    Object.assign(raw, {
      source: update.source,
      sourceBook: update.sourceBook,
      sourceTitle: update.sourceTitle,
      prerequisites: update.prerequisites,
    });
    writes.push([file, raw]);
  }
  writes.push([syllabusFile, syllabus]);
  let changed = 0;
  for (const [file, raw] of writes) {
    const content = JSON.stringify(raw, null, 2) + '\n';
    if (fs.readFileSync(file, 'utf8') !== content) {
      fs.writeFileSync(file, content);
      changed++;
    }
  }
  return changed;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(`Patched ${applyMisu30Provenance()} files.`);
