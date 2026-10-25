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
  assert.equal(syllabus.volumes.filter((v) => !v.trackId).length, 2);
  let sessions = 0;
  for (const vol of syllabus.volumes.filter((v) => !v.trackId)) {
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
  for (const vol of syllabus.volumes.filter((v) => !v.trackId)) {
    const positions = [0, 0, 0];
    for (const lesson of vol.lessons) {
      const raw = readCourseLesson(vol.id, lesson.no, 1);
      for (const prior of raw.prerequisites) assert.ok(prior >= 1 && prior < lesson.no);
      for (const day of [1, 2]) for (const q of readCourseLesson(vol.id, lesson.no, day).listening.questions) positions[q.answer]++;
    }
    assert.ok(Math.max(...positions) - Math.min(...positions) <= 2, vol.id);
  }
});

test('30 communication lessons form an independent 3-volume draft track and all load without a model', async () => {
  const syllabus = validateSyllabus(bundledSyllabus());
  const volumes = syllabus.volumes.filter((v) => v.trackId === 'misu30');
  assert.equal(volumes.length, 3);
  const numbers = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu30-test-'));
  try {
    for (const [index, volume] of volumes.entries()) {
      assert.equal(volume.nextVolumeId, index < 2 ? volumes[index + 1].id : '');
      assert.equal(volume.trackTitle, '30 bài giao tiếp HSK1–6');
      const positions = [0, 0, 0];
      for (const lesson of volume.lessons) {
        numbers.push(lesson.no);
        assert.equal(lesson.days, 1);
        const raw = readCourseLesson(volume.id, lesson.no, 1);
        assert.equal(raw.reviewed, false);
        assert.equal(raw.editorialStatus, 'AI soạn, chưa duyệt');
        assert.deepEqual(normalizeLesson(raw, lesson).problems, []);
        assert.equal(raw.vocab.length, 8);
        for (const q of raw.listening.questions) {
          assert.equal(new Set(q.options).size, 3);
          positions[q.answer]++;
        }
        assert.equal(raw.speaking.length, 2);
        const material = await getLessonContent({
          dataDir,
          syllabus,
          volumeId: volume.id,
          lessonNo: lesson.no,
          day: 1,
          level: volume.levels[0],
          provider: '',
          model: '',
        });
        assert.equal(material.reviewed, false);
        assert.ok(material.listening.transcript);
      }
      assert.deepEqual(positions, [10, 10, 10]);
    }
    assert.deepEqual(
      numbers,
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    assert.equal(fs.existsSync(path.join(dataDir, 'lessons')), false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

import { applyMisu30Provenance } from '../scripts/patch-misu30-provenance.mjs';
test('misu30 provenance retains original titles and patch is repeatable without changing lesson content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-provenance-'));
  try {
    fs.copyFileSync('lessons/courses/syllabus.json', path.join(root, 'syllabus.json'));
    for (const file of fs.readdirSync('lessons/courses').filter((f) => f.startsWith('misu30-')))
      fs.copyFileSync(path.join('lessons/courses', file), path.join(root, file));
    assert.equal(applyMisu30Provenance(root), 0);
    for (const volume of bundledSyllabus().volumes.filter((v) => v.trackId === 'misu30'))
      for (const [index, l] of volume.lessons.entries()) {
        const raw = readCourseLesson(volume.id, l.no, 1);
        assert.equal(raw.source.book, 'Misu · 30 bài nói tiếng Trung');
        assert.ok(raw.source.volumeTitle);
        assert.equal(raw.source.lessonTitle, raw.lessonTitle);
        assert.equal(raw.source.file, undefined);
        assert.equal(raw.sourceBook, raw.source.book);
        assert.equal(raw.sourceTitle, raw.source.volumeTitle);
        if (index === 0) assert.deepEqual(raw.prerequisites, []);
      }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
