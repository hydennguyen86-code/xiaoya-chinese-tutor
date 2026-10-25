import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readCourseLesson, bundledSyllabus } from './courseContent.mjs';
import { getLessonContent, normalizeLesson } from './lessonContent.mjs';
import { pinyinCitation } from './coursePinyin.mjs';
import { applyCoursePatches } from '../scripts/apply-course-patches.mjs';
test('all 24 second sessions retain day-one vocab, introduce new situations and checked citation pinyin', () => {
  for (const volume of bundledSyllabus().volumes)
    for (const lesson of volume.lessons) {
      const d1 = readCourseLesson(volume.id, lesson.no, 1),
        d2 = readCourseLesson(volume.id, lesson.no, 2);
      assert.equal(d2.reviewed, false);
      assert.equal(d2.authored, true);
      assert.match(d2.editorialStatus, /chưa có giáo viên duyệt/);
      assert.deepEqual(normalizeLesson(d2, lesson, { day: 2 }).problems, []);
      assert.ok(d2.vocab.length <= d1.vocab.length + 3);
      for (const w of d1.vocab) {
        const other = d2.vocab.find((v) => v.word === w.word);
        assert.ok(other, w.word);
        for (const key of ['meaning', 'example', 'exampleVi']) assert.equal(other[key], w[key]);
      }
      for (const w of d2.vocab) {
        assert.equal(w.pinyin, pinyinCitation(w.word));
        assert.equal(w.examplePinyin, pinyinCitation(w.example));
      }
      for (const p of d2.patterns) assert.equal(p.examplePinyin, pinyinCitation(p.example));
      assert.notEqual(d2.roleplay.opening, d1.roleplay.opening);
      assert.notEqual(d2.freeTalk.question, d1.freeTalk.question);
      assert.notEqual(d2.transferTask, d1.transferTask);
      assert.notDeepEqual(d2.speaking, d1.speaking);
      assert.notEqual(d2.listening.transcript, d1.listening.transcript);
      if (d2.listening.pinyin) assert.equal(d2.listening.pinyin, pinyinCitation(d2.listening.transcript));
    }
});
test('packaged loader preserves authored neutral readings and patched checkpoint aids', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-day2-'));
  try {
    const content = await getLessonContent({
      dataDir,
      syllabus: bundledSyllabus(),
      volumeId: 'hsk1-practical',
      lessonNo: 1,
      day: 2,
      level: 'HSK1-2',
      provider: '',
      model: '',
    });
    assert.equal(content.vocab.find((w) => w.word === '谢谢').pinyin, 'xiè xie');
    for (const no of [6, 12]) {
      const raw = readCourseLesson('hsk1-practical', no, 2);
      assert.equal(raw.checkpoint.official, false);
      for (const item of raw.checkpoint.listening) assert.equal(item.pinyin, pinyinCitation(item.transcript));
      for (const item of raw.checkpoint.speaking) assert.equal(item.pinyin, pinyinCitation(item.audioText || item.reference));
      for (const w of raw.checkpoint.glossary) assert.equal(w.pinyin, pinyinCitation(w.word));
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
test('checkpoint patches are idempotent, additive only and refuse overwriting existing material', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-course-patch-'));
  const patches = path.join(tmp, 'patches');
  fs.mkdirSync(patches);
  const target = path.join(tmp, 'hsk1-practical-6-d2.json');
  fs.writeFileSync(target, JSON.stringify({ checkpoint: { listening: [{ transcript: '你好' }] } }));
  const patch = {
    patchVersion: 1,
    reviewed: false,
    target: 'lessons/courses/hsk1-practical-6-d2.json',
    ops: [{ op: 'add', path: '/checkpoint/listening/0/pinyin', value: 'nǐ hǎo' }],
  };
  const file = path.join(patches, 'test.patch.json');
  fs.writeFileSync(file, JSON.stringify(patch));
  try {
    assert.equal(applyCoursePatches(tmp, patches), 1);
    assert.equal(applyCoursePatches(tmp, patches), 1);
    assert.equal(JSON.parse(fs.readFileSync(target)).checkpoint.listening[0].transcript, '你好');
    patch.ops[0].value = 'bad';
    fs.writeFileSync(file, JSON.stringify(patch));
    assert.throws(() => applyCoursePatches(tmp, patches));
    patch.ops[0].path = '/reviewed';
    fs.writeFileSync(file, JSON.stringify(patch));
    assert.throws(() => applyCoursePatches(tmp, patches));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
