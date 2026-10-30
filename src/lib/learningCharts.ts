import type { AnalysisReport, LearningProfile, SkillKey } from '../types';
import { SKILL_LABELS, skillBreakdown } from './learning.ts';
import { dayKey } from './storage.ts';

export interface CategoryBar {
  skill: SkillKey;
  label: string;
  count: number;
}

/** Mistakes saved so far, grouped by kind and ranked, largest first. */
export function categoryBars(profile: LearningProfile, limit = 6): CategoryBar[] {
  return skillBreakdown(profile)
    .slice(0, limit)
    .map(({ skill, label, count }) => ({ skill, label, count }));
}

export interface RatePoint {
  date: string;
  turns: number;
  corrections: number;
  /** mistakes caught per 10 spoken turns; null on a day with no turns */
  per10: number | null;
}

/** One entry per calendar day for the last `days` days, oldest first, empty days kept as gaps. */
export function dailyRate(profile: LearningProfile, days = 14, now = Date.now()): RatePoint[] {
  const byDate = new Map(profile.days.map((day) => [day.date, day]));
  const points: RatePoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = dayKey(new Date(now - offset * 86_400_000));
    const day = byDate.get(date);
    const turns = day?.turns ?? 0;
    const corrections = day?.corrections ?? 0;
    points.push({ date, turns, corrections, per10: turns > 0 ? (corrections / turns) * 10 : null });
  }
  return points;
}

export interface RateTrend {
  recent: number;
  before: number;
  direction: 'down' | 'up' | 'flat';
}

/** Last 7 days against the 7 before; only when each side has at least `minTurns` turns. */
export function rateTrend(points: RatePoint[], minTurns = 10): RateTrend | null {
  if (points.length < 14) return null;
  const sum = (slice: RatePoint[]) =>
    slice.reduce((total, point) => ({ turns: total.turns + point.turns, corrections: total.corrections + point.corrections }), {
      turns: 0,
      corrections: 0,
    });
  const recent = sum(points.slice(-7));
  const before = sum(points.slice(-14, -7));
  if (recent.turns < minTurns || before.turns < minTurns) return null;
  const a = (recent.corrections / recent.turns) * 10;
  const b = (before.corrections / before.turns) * 10;
  const direction = Math.abs(a - b) < 0.3 ? 'flat' : a < b ? 'down' : 'up';
  return { recent: a, before: b, direction };
}

export interface RecurringRow {
  skill: SkillKey;
  label: string;
  /** one flag per report column, oldest first */
  flags: boolean[];
  hits: number;
}

export interface RecurringSkills {
  reports: Array<{ id: string; createdAt: number }>;
  rows: RecurringRow[];
}

/** Which skills each of the latest reports named as a weakness; most repeated first. */
export function recurringSkills(reports: AnalysisReport[], columns = 6): RecurringSkills {
  const recent = [...reports].sort((a, b) => a.createdAt - b.createdAt).slice(-columns);
  const skills = new Set<SkillKey>();
  for (const report of recent) for (const weakness of report.weaknesses) skills.add(weakness.skill);
  const rows = [...skills]
    .map((skill) => {
      const flags = recent.map((report) => report.weaknesses.some((weakness) => weakness.skill === skill));
      return { skill, label: SKILL_LABELS[skill], flags, hits: flags.filter(Boolean).length };
    })
    .sort((a, b) => b.hits - a.hits || Number(b.flags.at(-1)) - Number(a.flags.at(-1)));
  return { reports: recent.map(({ id, createdAt }) => ({ id, createdAt })), rows };
}
