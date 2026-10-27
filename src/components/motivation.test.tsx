import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { motivationRows, MotivationTable } from './MotivationBoard';
import { dayKey } from '../lib/storage';
import type { Learner } from '../lib/learners';

test('board reads each learner separately, keeps the original order, and does not change progress', () => {
  const today = dayKey();
  const data = new Map([
    [
      'xiaoya.progress.v1:alice',
      JSON.stringify({ todayDate: today, lastDate: today, todayTurns: 2, totalTurns: 12, streak: 3, xp: 120, days: [today] }),
    ],
    [
      'xiaoya.progress.v1:bob',
      JSON.stringify({ todayDate: today, lastDate: today, todayTurns: 1, totalTurns: 23, streak: 2, xp: 230, days: [today] }),
    ],
    ['xiaoya.lesson.v1:alice', JSON.stringify({ version: 1, volumeId: 'pinyin-intro', completed: 4, history: [] })],
  ]);
  const before = [...data];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null } });
  try {
    const learners: Learner[] = [
      { id: 'alice', name: 'An', gender: 'female', level: 'HSK1-2', createdAt: 1 },
      { id: 'bob', name: 'Bình', gender: 'male', level: 'HSK3-4', createdAt: 2 },
    ];
    const rows = motivationRows(learners);
    assert.deepEqual(
      rows.map((row) => [row.name, row.totalTurns, row.completed, row.xp]),
      [
        ['An', 12, 4, 120],
        ['Bình', 23, null, 230],
      ],
    );
    const html = renderToStaticMarkup(<MotivationTable rows={rows} activeId="alice" />);
    assert.ok(html.indexOf('An') < html.indexOf('Bình'));
    assert.match(html, /Buổi hoàn thành/);
    assert.match(html, /motivation-current/);
    assert.match(html, /—/);
    assert.deepEqual([...data], before);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test('board displays an inviting empty state', () => {
  const html = renderToStaticMarkup(<MotivationTable rows={[]} activeId="" />);
  assert.match(html, /Chưa có người học/);
});

test('learners with the same name get distinct profile labels without sorting', () => {
  const base = { name: 'An', todayTurns: 0, totalTurns: 0, streak: 0, completed: null, xp: 0 };
  const html = renderToStaticMarkup(
    <MotivationTable
      rows={[
        { ...base, id: 'one' },
        { ...base, id: 'two' },
      ]}
      activeId="two"
    />,
  );
  assert.match(html, /Hồ sơ 1/);
  assert.match(html, /Hồ sơ 2/);
  assert.match(html, /Bạn/);
  assert.match(html, /data-label="XP"/);
});
