import type {
  AnalysisReport,
  ChatMessage,
  Correction,
  LearningDay,
  LearningProfile,
  MistakeCategory,
  MistakeRecord,
  SkillKey,
  TutorTurn,
  VocabItem,
  WordRecord,
} from '../types';
import { dayKey, scopedKey } from './storage';

export const LEARNING_KEY = 'xiaoya.learning.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MISTAKES = 120;
const MAX_WORDS = 400;
const MAX_REPORTS = 4;
const MAX_CONTEXTS = 3;

const SRS_DAYS = [10 / (24 * 60), 1, 3, 7, 14, 30];

export const SKILL_LABELS: Record<SkillKey, string> = {
  grammar: 'Ngữ pháp',
  word_choice: 'Chọn từ',
  word_order: 'Trật tự câu',
  measure_word: 'Lượng từ',
  vocabulary: 'Từ vựng',
  other: 'Lỗi khác',
};

const CATEGORIES = new Set<MistakeCategory>([
  'grammar',
  'word_choice',
  'word_order',
  'measure_word',
  'other',
]);

const SKILLS = new Set<SkillKey>([
  'grammar',
  'word_choice',
  'word_order',
  'measure_word',
  'vocabulary',
  'other',
]);

export function emptyLearning(updatedAt = 0): LearningProfile {
  return {
    version: 1,
    mistakes: [],
    words: [],
    days: [],
    reports: [],
    updatedAt,
  };
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function parseCategory(value: unknown): MistakeCategory {
  return CATEGORIES.has(value as MistakeCategory)
    ? (value as MistakeCategory)
    : 'other';
}

function cleanMistakes(value: unknown): MistakeRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        id: asString(raw.id) || `${raw.category}|${raw.original}|${raw.corrected}`,
        original: asString(raw.original),
        corrected: asString(raw.corrected),
        explanation: asString(raw.explanation),
        category: parseCategory(raw.category),
        count: Math.max(1, Math.round(asNumber(raw.count, 1))),
        firstSeen: asNumber(raw.firstSeen),
        lastSeen: asNumber(raw.lastSeen),
        contexts: Array.isArray(raw.contexts)
          ? raw.contexts.map((context) => asString(context)).filter(Boolean).slice(-MAX_CONTEXTS)
          : [],
      };
    })
    .filter((item) => item.original && item.corrected)
    .slice(-MAX_MISTAKES);
}

function cleanWords(value: unknown): WordRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        word: asString(raw.word),
        pinyin: asString(raw.pinyin),
        meaning: asString(raw.meaning),
        count: Math.max(1, Math.round(asNumber(raw.count, 1))),
        firstSeen: asNumber(raw.firstSeen),
        lastSeen: asNumber(raw.lastSeen),
        box: Math.max(0, Math.min(5, Math.round(asNumber(raw.box, 0)))),
        dueAt: asNumber(raw.dueAt),
        reviews: Math.max(0, Math.round(asNumber(raw.reviews, 0))),
        lapses: Math.max(0, Math.round(asNumber(raw.lapses, 0))),
        lastReviewedAt: asNumber(raw.lastReviewedAt) || undefined,
      };
    })
    .filter((item) => item.word && item.meaning)
    .slice(-MAX_WORDS);
}

function cleanDays(value: unknown): LearningDay[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        date: asString(raw.date),
        turns: Math.max(0, Math.round(asNumber(raw.turns))),
        corrections: Math.max(0, Math.round(asNumber(raw.corrections))),
        newWords: Math.max(0, Math.round(asNumber(raw.newWords))),
        reviews: Math.max(0, Math.round(asNumber(raw.reviews))),
      };
    })
    .filter((day) => day.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
}

function cleanReports(value: unknown): AnalysisReport[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        id: asString(raw.id),
        createdAt: asNumber(raw.createdAt),
        periodDays: Math.max(1, Math.round(asNumber(raw.periodDays, 1))),
        summary: asString(raw.summary),
        strengths: Array.isArray(raw.strengths)
          ? raw.strengths.map((entry) => asString(entry)).filter(Boolean).slice(0, 5)
          : [],
        weaknesses: Array.isArray(raw.weaknesses)
          ? raw.weaknesses
              .filter((entry) => entry && typeof entry === 'object')
              .map((entry) => {
                const weakness = entry as Record<string, unknown>;
                return {
                  skill: SKILLS.has(weakness.skill as SkillKey)
                    ? (weakness.skill as SkillKey)
                    : 'other',
                  title: asString(weakness.title),
                  evidence: asString(weakness.evidence),
                  advice: asString(weakness.advice),
                  practice: asString(weakness.practice),
                };
              })
              .filter((entry) => entry.title)
              .slice(0, 5)
          : [],
        focusWords: Array.isArray(raw.focusWords)
          ? raw.focusWords
              .filter((entry) => entry && typeof entry === 'object')
              .map((entry) => {
                const word = entry as Record<string, unknown>;
                return {
                  word: asString(word.word),
                  pinyin: asString(word.pinyin),
                  meaning: asString(word.meaning),
                  why: asString(word.why),
                };
              })
              .filter((entry) => entry.word)
              .slice(0, 4)
          : [],
        plan: Array.isArray(raw.plan)
          ? raw.plan.map((entry) => asString(entry)).filter(Boolean).slice(0, 5)
          : [],
      };
    })
    .filter((report) => report.summary || report.weaknesses.length)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_REPORTS);
}

export function loadLearning(scope = ''): LearningProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedKey(LEARNING_KEY, scope)) || 'null');
    if (!parsed || typeof parsed !== 'object') return emptyLearning();
    return {
      version: 1,
      mistakes: cleanMistakes(parsed.mistakes),
      words: cleanWords(parsed.words),
      days: cleanDays(parsed.days),
      reports: cleanReports(parsed.reports),
      updatedAt: asNumber(parsed.updatedAt),
    };
  } catch {
    return emptyLearning();
  }
}

export function saveLearning(profile: LearningProfile, scope = '') {
  try {
    localStorage.setItem(scopedKey(LEARNING_KEY, scope), JSON.stringify(profile));
  } catch {
    // storage can be unavailable in private windows
  }
}

export function clearLearning(scope = '') {
  try {
    localStorage.removeItem(scopedKey(LEARNING_KEY, scope));
  } catch {
    // ignore
  }
}

function mergeCorrection(
  mistakes: MistakeRecord[],
  correction: Correction,
  userText: string,
  now: number,
) {
  const category = parseCategory(correction.category);
  const id = `${category}|${correction.original}|${correction.corrected}`;
  const existing = mistakes.find((item) => item.id === id);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
    existing.explanation = correction.explanation || existing.explanation;
    if (
      userText &&
      !existing.contexts.includes(userText) &&
      existing.contexts.length < MAX_CONTEXTS
    ) {
      existing.contexts = [...existing.contexts, userText];
    }
    return;
  }
  mistakes.push({
    id,
    original: correction.original,
    corrected: correction.corrected,
    explanation: correction.explanation,
    category,
    count: 1,
    firstSeen: now,
    lastSeen: now,
    contexts: userText ? [userText] : [],
  });
}

function mergeWord(words: WordRecord[], item: VocabItem, now: number) {
  const existing = words.find((word) => word.word === item.word);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
    existing.pinyin = item.pinyin || existing.pinyin;
    existing.meaning = item.meaning || existing.meaning;
    return false;
  }
  words.push({
    word: item.word,
    pinyin: item.pinyin,
    meaning: item.meaning,
    count: 1,
    firstSeen: now,
    lastSeen: now,
    box: 0,
    dueAt: now,
    reviews: 0,
    lapses: 0,
  });
  return true;
}

function bumpDay(
  days: LearningDay[],
  timestamp: number,
  patch: Partial<Omit<LearningDay, 'date'>>,
) {
  const date = dayKey(new Date(timestamp));
  let day = days.find((entry) => entry.date === date);
  if (!day) {
    day = { date, turns: 0, corrections: 0, newWords: 0, reviews: 0 };
    days.push(day);
  }
  day.turns += patch.turns || 0;
  day.corrections += patch.corrections || 0;
  day.newWords += patch.newWords || 0;
  day.reviews += patch.reviews || 0;
}

export function recordLearningTurn(
  profile: LearningProfile,
  userText: string,
  turn: Pick<TutorTurn, 'corrections' | 'vocab'>,
  options: { countTurn?: boolean; timestamp?: number } = {},
): LearningProfile {
  const now = options.timestamp || Date.now();
  const mistakes = profile.mistakes.map((item) => ({ ...item, contexts: [...item.contexts] }));
  const words = profile.words.map((item) => ({ ...item }));
  const days = profile.days.map((item) => ({ ...item }));

  for (const correction of turn.corrections || []) {
    mergeCorrection(mistakes, correction, userText, now);
  }

  let newWords = 0;
  for (const item of turn.vocab || []) {
    if (mergeWord(words, item, now)) newWords += 1;
  }

  if (options.countTurn !== false) {
    bumpDay(days, now, {
      turns: 1,
      corrections: (turn.corrections || []).length,
      newWords,
    });
  }

  return {
    ...profile,
    mistakes: mistakes.slice(-MAX_MISTAKES),
    words: words.slice(-MAX_WORDS),
    days: days.sort((a, b) => a.date.localeCompare(b.date)).slice(-60),
    updatedAt: now,
  };
}

export function recordLearningCorrections(
  profile: LearningProfile,
  userText: string,
  corrections: Correction[],
  timestamp = Date.now(),
): LearningProfile {
  if (!corrections.length) return profile;

  const mistakes = profile.mistakes.map((item) => ({
    ...item,
    contexts: [...item.contexts],
  }));
  const days = profile.days.map((item) => ({ ...item }));

  for (const correction of corrections) {
    mergeCorrection(mistakes, correction, userText, timestamp);
  }
  bumpDay(days, timestamp, { corrections: corrections.length });

  return {
    ...profile,
    mistakes: mistakes.slice(-MAX_MISTAKES),
    days: days.sort((a, b) => a.date.localeCompare(b.date)).slice(-60),
    updatedAt: Math.max(profile.updatedAt, timestamp),
  };
}

export function seedLearningFromMessages(messages: ChatMessage[]): LearningProfile {
  const usable = messages.filter(
    (message) => !message.error && !message.streaming && message.text.trim(),
  );
  if (!usable.length) return emptyLearning();

  let profile = emptyLearning();
  let context = '';
  const now = Date.now();

  for (const message of usable) {
    if (message.role === 'user') {
      context = message.text;
      continue;
    }
    if (message.kind === 'greeting') continue;
    const timestamp = message.createdAt || now;
    profile = recordLearningTurn(
      profile,
      context,
      {
        corrections: message.corrections || [],
        vocab: message.vocab || [],
      },
      { timestamp },
    );
    context = '';
  }

  profile.updatedAt = now;
  return profile;
}

export function reviewWord(
  profile: LearningProfile,
  word: string,
  remembered: boolean,
  timestamp = Date.now(),
): LearningProfile {
  const words = profile.words.map((item) => {
    if (item.word !== word) return item;
    const nextBox = remembered ? Math.min(item.box + 1, SRS_DAYS.length - 1) : 0;
    const interval = remembered ? SRS_DAYS[nextBox] : SRS_DAYS[0];
    return {
      ...item,
      box: nextBox,
      dueAt: timestamp + interval * DAY_MS,
      reviews: item.reviews + 1,
      lapses: item.lapses + (remembered ? 0 : 1),
      lastReviewedAt: timestamp,
    };
  });
  const days = profile.days.map((item) => ({ ...item }));
  bumpDay(days, timestamp, { reviews: 1 });
  return {
    ...profile,
    words,
    days: days.sort((a, b) => a.date.localeCompare(b.date)).slice(-60),
    updatedAt: timestamp,
  };
}

export function dueWords(profile: LearningProfile, timestamp = Date.now()) {
  return profile.words
    .filter((word) => word.dueAt <= timestamp)
    .sort((a, b) => a.dueAt - b.dueAt || b.lapses - a.lapses);
}

export function daysUntil(timestamp: number, now = Date.now()) {
  return Math.max(0, Math.ceil((timestamp - now) / DAY_MS));
}

export function nextDueAt(profile: LearningProfile) {
  const upcoming = profile.words
    .map((word) => word.dueAt)
    .filter((dueAt) => dueAt > Date.now())
    .sort((a, b) => a - b);
  return upcoming[0] || 0;
}

export function skillBreakdown(profile: LearningProfile) {
  const counts = new Map<MistakeCategory, { count: number; lastSeen: number }>();
  for (const mistake of profile.mistakes) {
    const current = counts.get(mistake.category) || { count: 0, lastSeen: 0 };
    counts.set(mistake.category, {
      count: current.count + mistake.count,
      lastSeen: Math.max(current.lastSeen, mistake.lastSeen),
    });
  }
  return [...counts.entries()]
    .map(([skill, value]) => ({
      skill,
      label: SKILL_LABELS[skill],
      count: value.count,
      lastSeen: value.lastSeen,
    }))
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);
}

export function topMistakes(profile: LearningProfile, limit = 6) {
  return [...profile.mistakes]
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, limit);
}

export function weakWords(profile: LearningProfile, limit = 8) {
  return [...profile.words]
    .sort(
      (a, b) =>
        b.lapses - a.lapses ||
        a.box - b.box ||
        b.count - a.count ||
        a.dueAt - b.dueAt,
    )
    .slice(0, limit);
}

export function allowedWords(profile: LearningProfile, limit = 10) {
  return [...profile.words]
    .sort((a, b) => a.dueAt - b.dueAt || b.lapses - a.lapses)
    .slice(0, limit);
}

export function learningTotals(profile: LearningProfile) {
  const turns = profile.days.reduce((total, day) => total + day.turns, 0);
  const activeDays = profile.days.filter(
    (day) => day.turns || day.corrections || day.newWords || day.reviews,
  ).length;
  const corrections = profile.mistakes.reduce((total, item) => total + item.count, 0);
  const reviews = profile.words.reduce((total, word) => total + word.reviews, 0);
  return {
    turns,
    activeDays,
    corrections,
    reviews,
    mistakes: profile.mistakes.length,
    words: profile.words.length,
    due: dueWords(profile).length,
  };
}

export function learningPeriodDays(profile: LearningProfile, now = Date.now()) {
  const stamps = [
    ...profile.mistakes.map((item) => item.firstSeen),
    ...profile.words.map((item) => item.firstSeen),
  ].filter((stamp) => stamp > 0);
  if (!stamps.length) return 1;
  const start = new Date(Math.min(...stamps));
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

export function latestReport(profile: LearningProfile) {
  return profile.reports[0] || null;
}

export function reportAgeDays(report: AnalysisReport, now = Date.now()) {
  return Math.max(0, Math.floor((now - report.createdAt) / DAY_MS));
}

export function addReport(profile: LearningProfile, report: AnalysisReport): LearningProfile {
  return {
    ...profile,
    reports: [report, ...profile.reports.filter((item) => item.id !== report.id)].slice(
      0,
      MAX_REPORTS,
    ),
    updatedAt: Date.now(),
  };
}

function formatDate(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function buildLearningDigest(profile: LearningProfile) {
  const totals = learningTotals(profile);
  if (!totals.turns && !totals.mistakes && !totals.words) return '';

  const skills = skillBreakdown(profile)
    .slice(0, 3)
    .map((item) => `${item.label} (${item.count})`)
    .join(', ');
  const mistakes = topMistakes(profile, 5)
    .map(
      (item) =>
        `“${item.original}” → “${item.corrected}” (${item.count} lần; ${item.explanation})`,
    )
    .join('; ');
  const words = weakWords(profile, 6)
    .map((item) => `${item.word} (${item.pinyin}) = ${item.meaning}`)
    .join('; ');

  const lines = [
    'HỒ SƠ HỌC TẬP TỰ ĐỘNG (dùng ngầm để điều chỉnh cách dạy, không được đọc lại như một bản báo cáo và không nhắc đến chữ “hồ sơ”):',
    `- Đã ghi ${totals.turns} lượt trong ${totals.activeDays || 1} ngày; ${totals.mistakes} kiểu lỗi, ${totals.words} từ đang ôn.`,
  ];
  if (skills) lines.push(`- Kỹ năng cần chú ý: ${skills}.`);
  if (mistakes) lines.push(`- Lỗi hay lặp: ${mistakes}.`);
  if (words) lines.push(`- Từ nên xuất hiện lại tự nhiên: ${words}.`);
  lines.push(
    '- Khi phù hợp, hãy dùng lại 1 từ hoặc cấu trúc mà người học từng sai để họ gặp lại trong ngữ cảnh mới. Nếu người học dùng đúng, khen ngắn và tự nhiên. Không nhắc “theo hồ sơ”, không liệt kê lỗi hàng loạt.',
  );
  return lines.join('\n').slice(0, 2200);
}

export function buildAnalysisInput(profile: LearningProfile) {
  const totals = learningTotals(profile);
  const periodDays = learningPeriodDays(profile);
  const skills = skillBreakdown(profile)
    .map((item) => `- ${item.label}: ${item.count} lỗi`)
    .join('\n');
  const mistakes = topMistakes(profile, 14)
    .map(
      (item) =>
        `- [${SKILL_LABELS[item.category]}] “${item.original}” → “${item.corrected}” | ${item.explanation} | ${item.count} lần | gần nhất ${formatDate(item.lastSeen)}`,
    )
    .join('\n');
  const words = allowedWords(profile, 14)
    .map(
      (item) =>
        `- ${item.word} (${item.pinyin}): ${item.meaning} | gặp ${item.count} lần | mức nhớ ${item.box}/5 | quên ${item.lapses} lần | ôn ${item.reviews} lần`,
    )
    .join('\n');
  const sessions = profile.days
    .slice(-7)
    .map(
      (day) =>
        `- ${day.date}: ${day.turns} lượt, ${day.corrections} lỗi mới ghi, ${day.newWords} từ mới, ${day.reviews} lượt ôn`,
    )
    .join('\n');

  const lines = [
    `Khoảng thời gian: ${periodDays} ngày.`,
    `Tổng lượt luyện: ${totals.turns}. Số ngày có hoạt động: ${totals.activeDays}.`,
    `Số kiểu lỗi đã ghi: ${totals.mistakes}. Số từ đang ôn: ${totals.words}. Từ đến hạn: ${totals.due}.`,
    '',
    'KỸ NĂNG (theo số lỗi đã ghi):',
    skills || '- Chưa có dữ liệu.',
    '',
    'LỖI LẶP LẠI:',
    mistakes || '- Chưa có dữ liệu.',
    '',
    'TỪ VỰNG CẦN CHÚ Ý:',
    words || '- Chưa có dữ liệu.',
    '',
    'HOẠT ĐỘNG GẦN ĐÂY:',
    sessions || '- Chưa có dữ liệu.',
    '',
    'Hãy phân tích chỉ dựa trên dữ liệu trên. Không bịa lỗi hoặc từ không có trong danh sách.',
  ];
  return lines.join('\n').slice(0, 6000);
}

export function hasAnalysisData(profile: LearningProfile) {
  const totals = learningTotals(profile);
  return totals.turns >= 3 || totals.mistakes >= 2 || totals.words >= 3;
}
