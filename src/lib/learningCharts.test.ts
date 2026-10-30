import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryBars, dailyRate, rateTrend, recurringSkills } from './learningCharts.ts';
import { dayKey } from './storage.ts';
import { emptyLearning } from './learning.ts';
import type { AnalysisReport, LearningProfile } from '../types';

const NOW = new Date(2026, 9, 30, 12).getTime();
const day = (offset: number) => dayKey(new Date(NOW - offset * 86_400_000));

function profile(extra: Partial<LearningProfile>): LearningProfile {
  return { ...emptyLearning(), ...extra };
}

test('category bars rank mistakes by how often they happened', () => {
  const mistake = (category: 'grammar' | 'word_order', count: number) => ({
    id: `${category}${count}`, original: 'a', corrected: 'b', explanation: '', category, count, firstSeen: 1, lastSeen: 2, contexts: [],
  });
  const bars = categoryBars(profile({ mistakes: [mistake('word_order', 2), mistake('grammar', 3), mistake('grammar', 4)] }));
  assert.deepEqual(bars.map((bar) => [bar.skill, bar.count]), [['grammar', 7], ['word_order', 2]]);
});

test('daily rate lists 14 days with gaps for days without turns', () => {
  const points = dailyRate(
    profile({ days: [{ date: day(0), turns: 20, corrections: 5, newWords: 0, reviews: 0 }, { date: day(3), turns: 4, corrections: 1, newWords: 0, reviews: 0 }] }),
    14,
    NOW,
  );
  assert.equal(points.length, 14);
  assert.equal(points.at(-1)?.date, day(0));
  assert.equal(points.at(-1)?.per10, 2.5);
  assert.equal(points.at(-4)?.per10, 2.5);
  assert.equal(points.at(-2)?.per10, null);
});

test('trend compares this week with last week and refuses thin data', () => {
  const rows = (recent: [number, number], before: [number, number]) =>
    dailyRate(
      profile({
        days: [
          { date: day(1), turns: recent[0], corrections: recent[1], newWords: 0, reviews: 0 },
          { date: day(9), turns: before[0], corrections: before[1], newWords: 0, reviews: 0 },
        ],
      }),
      14,
      NOW,
    );
  const better = rateTrend(rows([20, 4], [20, 10]));
  assert.equal(better?.direction, 'down');
  assert.equal(Math.round((better?.recent ?? 0) * 10) / 10, 2);
  assert.equal(rateTrend(rows([20, 10], [20, 4]))?.direction, 'up');
  assert.equal(rateTrend(rows([20, 6], [20, 6]))?.direction, 'flat');
  assert.equal(rateTrend(rows([3, 1], [20, 10])), null);
});

test('recurring skills show which weaknesses repeat across reports', () => {
  const report = (id: string, createdAt: number, skills: Array<'grammar' | 'word_order' | 'vocabulary'>): AnalysisReport => ({
    id, createdAt, periodDays: 7, summary: '', strengths: [], focusWords: [], plan: [],
    weaknesses: skills.map((skill) => ({ skill, title: skill, evidence: '', advice: '', practice: '' })),
  });
  const result = recurringSkills([report('c', 3, ['grammar']), report('a', 1, ['grammar', 'word_order']), report('b', 2, ['grammar', 'vocabulary'])]);
  assert.deepEqual(result.reports.map((item) => item.id), ['a', 'b', 'c']);
  assert.deepEqual(result.rows.map((row) => [row.skill, row.hits]), [['grammar', 3], ['word_order', 1], ['vocabulary', 1]]);
  assert.deepEqual(result.rows[0].flags, [true, true, true]);
  assert.deepEqual(result.rows[1].flags, [true, false, false]);
});
