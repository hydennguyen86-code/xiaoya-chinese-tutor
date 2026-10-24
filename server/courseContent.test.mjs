import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundledSyllabus, readCourseLesson } from './courseContent.mjs';
import { validateSyllabus, loadSyllabus } from './syllabus.mjs';
import { normalizeLesson, getLessonContent } from './lessonContent.mjs';

test('48 fixed sessions include aligned vocabulary, goals, listening and speaking', () => {
  const syllabus = validateSyllabus(bundledSyllabus());
  assert.equal(syllabus.volumes.length, 2);
  let sessions = 0;
  for (const vol of syllabus.volumes) {
    assert.equal(vol.lessons.length, 12);
    for (const lesson of vol.lessons)
      for (const day of [1, 2]) {
        const raw = readCourseLesson(vol.id, lesson.no, day);
        assert.deepEqual(normalizeLesson(raw, lesson, { day }).problems, [], `${vol.id}/${lesson.no}/${day}`);
        assert.equal(raw.reviewed, false);
        assert.ok(raw.roleplay.goals.length >= 2);
        assert.ok(raw.speaking.length >= 2);
        for (const clip of [raw.listening, ...(raw.checkpoint?.listening || [])]) {
          assert.ok(clip.transcript && clip.translation);
          for (const q of clip.questions) {
            assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
            assert.ok(q.explanation);
            assert.equal(new Set(q.options).size, q.options.length);
          }
        }
        const other = readCourseLesson(vol.id, lesson.no, day === 1 ? 2 : 1);
        assert.notEqual(raw.listening.transcript, other.listening.transcript);
        sessions++;
      }
  }
  assert.equal(sessions, 48);
});
test('packaged syllabus is default and a fixed session loads without any model', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-course-'));
  try {
    const syllabus = loadSyllabus(dir);
    assert.equal(syllabus.authored, true);
    const lesson = await getLessonContent({
      dataDir: dir,
      syllabus,
      volumeId: 'hsk1-practical',
      lessonNo: 1,
      day: 1,
      level: 'HSK1-2',
      provider: '',
      model: '',
    });
    assert.equal(lesson.authored, true);
    assert.ok(lesson.listening.questions.length);
    assert.equal(fs.existsSync(path.join(dir, 'lessons')), false);
    assert.equal(readCourseLesson('../../etc', 1, 1), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('course prerequisite graph is ordered and answer positions are not a single-position shortcut', () => {
  const syllabus = bundledSyllabus();
  for (const vol of syllabus.volumes) {
    const positions = [0, 0, 0];
    for (const lesson of vol.lessons) {
      const raw = readCourseLesson(vol.id, lesson.no, 1);
      for (const prior of raw.prerequisites) assert.ok(prior >= 1 && prior < lesson.no);
      for (const day of [1, 2]) for (const q of readCourseLesson(vol.id, lesson.no, day).listening.questions) positions[q.answer]++;
    }
    assert.ok(Math.max(...positions) - Math.min(...positions) <= 2, vol.id);
  }
});
