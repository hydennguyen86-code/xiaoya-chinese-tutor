import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readCourseListening } from './courseListening.mjs';
import { getLessonContent } from './lessonContent.mjs';
import { bundledSyllabus } from './courseContent.mjs';

test('72 course listening files validate authored pinyin sandhi meaning chunks and vocabulary', () => {
  const result = spawnSync(process.execPath, ['scripts/listening-checks/course-listening.check.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const ids = new Set();
  let dictation = 0,
    shadowing = 0;
  for (const volume of ['hsk1-practical', 'hsk3-practical', 'hsk5-practical'])
    for (let no = 1; no <= 12; no++)
      for (const day of [1, 2]) {
        const data = readCourseListening(volume, no, day);
        assert.equal(data.source, 'AI soạn, chưa duyệt');
        assert.ok(data.dictation.length >= 3 && data.dictation.length <= 5);
        assert.equal(data.shadowing.length, 1);
        for (const item of [...data.dictation, ...data.shadowing]) {
          assert.equal(ids.has(item.id), false);
          ids.add(item.id);
          assert.ok(item.focus.length);
        }
        dictation += data.dictation.length;
        shadowing += data.shadowing.length;
        for (const item of data.shadowing) {
          assert.equal(item.syllables, [...item.text].filter((c) => /\p{Script=Han}/u.test(c)).length);
          assert.equal(item.chunks.map((c) => c.hanzi).join(''), item.text.replace(/[^\p{Script=Han}]/gu, ''));
          assert.equal(item.chunks.at(-1).pause, 'end');
        }
      }
  assert.equal(ids.size, 366);
  assert.equal(dictation, 294);
  assert.equal(shadowing, 72);
  assert.equal(readCourseListening('../escape', 1, 1), null);
  assert.equal(readCourseListening('misu30-1', 1, 1), null);
  assert.equal(readCourseListening('pinyin-intro', 1, 1), null);
});
test('loader preserves the exact listening practice and checkpoint pinyin through merge', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-linked-listening-'));
  try {
    for (const volumeId of ['hsk1-practical', 'hsk3-practical', 'hsk5-practical'])
      for (const day of [1, 2]) {
        const material = await getLessonContent({
          dataDir,
          syllabus: bundledSyllabus(),
          volumeId,
          lessonNo: 6,
          day,
          level: volumeId.startsWith('hsk1') ? 'HSK1-2' : volumeId.startsWith('hsk3') ? 'HSK3-4' : 'HSK5-6',
          provider: '',
          model: '',
        });
        assert.deepEqual(material.listeningPractice, readCourseListening(volumeId, 6, day));
        const raw = JSON.parse(fs.readFileSync(`lessons/courses/${volumeId}-6-d${day}.json`));
        for (const key of ['listening', 'speaking', 'checkpoint']) assert.deepEqual(material[key], raw[key]);
      }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
