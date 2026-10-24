import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_MS,
  beginSession,
  completeSession,
  planToday,
  previousDay,
  remainingMs,
  resolvePointer,
  startingVolume,
  type LessonProgress,
  type Syllabus,
} from './lessonPlan.ts';

const book: Syllabus = {
  book: 'test',
  volumes: [
    { id: 'so-cap', title: 'Sơ cấp', levels: ['HSK1-2'], lessons: [
      { no: 1, title: 'A', pages: '', topics: [], days: 2 },
      { no: 2, title: 'B', pages: '', topics: [], days: 2 },
    ] },
    { id: 'cao-cap', title: 'Cao cấp', levels: ['HSK5-6', 'free'], lessons: [
      { no: 1, title: 'C', pages: '', topics: [], days: 2 },
      { no: 2, title: 'D', pages: '', topics: [], days: 1 },
    ] },
  ],
};

function study(progress: LessonProgress | null, level: string, day: string): LessonProgress {
  const plan = planToday(progress, book, level, day);
  assert.equal(plan.kind, 'start', `expected a new session on ${day}, got ${plan.kind}`);
  if (plan.kind !== 'start') throw new Error('unreachable');
  const started = beginSession(progress, book, level, plan.pointer, day);
  return completeSession(started, book, day);
}

test('a 20-minute session split into six sections', () => {
  assert.equal(SESSION_MS, 20 * 60_000);
});

test('the starting volume follows the learner level', () => {
  assert.equal(startingVolume(book, 'HSK5-6').id, 'cao-cap');
  assert.equal(startingVolume(book, 'HSK3-4').id, 'so-cap'); // no volume for it: first one
});

test('a new HSK5-6 learner starts lesson 1, session 1 of the advanced volume without choosing', () => {
  assert.deepEqual(planToday(null, book, 'HSK5-6', '2026-10-24'), {
    kind: 'start',
    pointer: { volumeId: 'cao-cap', lessonNo: 1, day: 1 },
  });
});

test('leaving mid-session resumes the same section later', () => {
  let p = beginSession(null, book, 'HSK5-6', { volumeId: 'cao-cap', lessonNo: 1, day: 1 }, '2026-10-24');
  p = { ...p, current: { ...p.current!, section: 3, item: 2 } };
  const plan = planToday(p, book, 'HSK5-6', '2026-10-25');
  assert.equal(plan.kind, 'resume');
  if (plan.kind === 'resume') assert.equal(plan.session.section, 3);
});

test('session 2 of the same lesson next day, then the next lesson', () => {
  let p = study(null, 'HSK5-6', '2026-10-24');
  assert.equal(planToday(p, book, 'HSK5-6', '2026-10-24').kind, 'done-today');
  assert.deepEqual(planToday(p, book, 'HSK5-6', '2026-10-25'), {
    kind: 'start',
    pointer: { volumeId: 'cao-cap', lessonNo: 1, day: 2 },
  });
  p = study(p, 'HSK5-6', '2026-10-25');
  assert.deepEqual(planToday(p, book, 'HSK5-6', '2026-10-26'), {
    kind: 'start',
    pointer: { volumeId: 'cao-cap', lessonNo: 2, day: 1 },
  });
});

test('missed days never skip a lesson and reset the streak', () => {
  let p = study(null, 'HSK1-2', '2026-10-01');
  p = study(p, 'HSK1-2', '2026-10-02');
  assert.equal(p.streak, 2);
  const plan = planToday(p, book, 'HSK1-2', '2026-10-10');
  assert.deepEqual(plan, { kind: 'start', pointer: { volumeId: 'so-cap', lessonNo: 2, day: 1 } });
  p = study(p, 'HSK1-2', '2026-10-10');
  assert.equal(p.streak, 1);
});

test('the end of a volume moves to the next one, the end of the book stops', () => {
  let p: LessonProgress | null = null;
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  // so-cap: 1/1, 1/2, 2/1, 2/2  then cao-cap: 1/1, 1/2, 2/1
  for (const day of days) p = study(p, 'HSK1-2', day);
  assert.equal(p!.finished, true);
  assert.equal(planToday(p, book, 'HSK1-2', '2026-11-08').kind, 'finished');
  assert.equal(p!.completed, 7);
});

test('a replaced outline keeps the learner somewhere sensible', () => {
  assert.deepEqual(resolvePointer(book, 'HSK5-6', { volumeId: 'tam-cao-cap', lessonNo: 5, day: 2 }), {
    volumeId: 'cao-cap', lessonNo: 1, day: 1,
  });
  assert.deepEqual(resolvePointer(book, 'HSK1-2', { volumeId: 'so-cap', lessonNo: 1, day: 9 }), {
    volumeId: 'so-cap', lessonNo: 1, day: 2,
  });
});

test('remaining time and calendar helpers', () => {
  const p = beginSession(null, book, 'HSK5-6', { volumeId: 'cao-cap', lessonNo: 1, day: 1 }, '2026-10-24');
  const s = { ...p.current!, elapsedMs: [180_000, 60_000, 0, 0, 0, 0] };
  assert.equal(remainingMs(s), 16 * 60_000);
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
});
