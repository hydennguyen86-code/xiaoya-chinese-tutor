import type { LearningProfile, Progress } from '../types';
import { loadFluency } from './fluency';

// A short, plain report a parent can read in ten seconds: what the child did
// this week, what went well, what to listen for. Built only from data already
// saved on this computer; nothing is scored or ranked.

export interface ParentReport {
  days: number;
  activeDays: number;
  turns: number;
  newWords: number;
  reviews: number;
  stickers: number;
  streak: number;
  weakSounds: { label: string; count: number }[];
  wordsToReview: string[];
  spokenMinutes: number | null;
  lines: string[];
}

const DAY_MS = 86400000;

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildParentReport(
  name: string,
  learning: LearningProfile,
  progress: Progress,
  learnerId: string,
  { days = 7, now = Date.now(), kid = false }: { days?: number; now?: number; kid?: boolean } = {},
): ParentReport {
  const since = now - days * DAY_MS;
  const sinceKey = dayKey(since);
  const recentDays = learning.days.filter((d) => d.date >= sinceKey);
  const turns = recentDays.reduce((sum, d) => sum + d.turns, 0);
  const newWords = recentDays.reduce((sum, d) => sum + d.newWords, 0);
  const reviews = recentDays.reduce((sum, d) => sum + d.reviews, 0);
  const activeDays = new Set([...recentDays.filter((d) => d.turns > 0).map((d) => d.date), ...progress.days.filter((d) => d >= sinceKey)])
    .size;
  const stickers = (progress.stickers || []).filter((s) => s.date >= sinceKey).length;
  const sounds = new Map<string, number>();
  for (const e of learning.pronunciation || []) {
    if (e.lastSeen < since) continue;
    const label = e.kind === 'tone' ? `thanh ${e.contrast} (chữ ${e.target})` : `âm ${e.contrast} (${e.target})`;
    sounds.set(label, (sounds.get(label) || 0) + e.count);
  }
  const weakSounds = [...sounds.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const wordsToReview = learning.words
    .filter((w) => w.dueAt <= now)
    .sort((a, b) => b.lapses - a.lapses || a.dueAt - b.dueAt)
    .slice(0, 5)
    .map((w) => `${w.word} (${w.meaning})`);
  let spokenMinutes: number | null = null;
  try {
    const fluency = loadFluency(learnerId).filter((f) => f.at >= since);
    if (fluency.length) spokenMinutes = Math.round((fluency.reduce((sum, f) => sum + (f.speechSeconds || 0), 0) / 60) * 10) / 10;
  } catch {
    spokenMinutes = null;
  }

  const lines = [
    `${name} — ${days} ngày qua: học ${activeDays} ngày, ${turns} lượt nói với cô giáo${spokenMinutes !== null ? `, khoảng ${spokenMinutes} phút thật sự nói` : ''}.`,
    `Từ mới: ${newWords} · ôn lại: ${reviews} lượt · sticker: ${stickers}${progress.streak > 1 ? ` · chuỗi ${progress.streak} ngày` : ''}.`,
    weakSounds.length
      ? `Hay nhầm: ${weakSounds.map((s) => `${s.label} ×${s.count}`).join(', ')}. ${kid ? 'Bố mẹ có thể cho bé nghe lại các chữ này trong mục Luyện tai.' : 'Nghe lại các chữ này trong mục Luyện tai.'}`
      : 'Chưa thấy lỗi phát âm lặp lại trong tuần.',
    wordsToReview.length
      ? `${kid ? 'Từ nên hỏi lại bé hôm nay' : 'Từ đến hạn ôn hôm nay'}: ${wordsToReview.join(', ')}.`
      : 'Không có từ nào đến hạn ôn.',
  ];
  return { days, activeDays, turns, newWords, reviews, stickers, streak: progress.streak, weakSounds, wordsToReview, spokenMinutes, lines };
}
