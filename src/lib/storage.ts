import type { ChatMessage, Level, Progress, Settings } from '../types';

const SETTINGS_KEY = 'xiaoya.settings.v1';
export const CHAT_KEY = 'xiaoya.chat.v1';
export const PROGRESS_KEY = 'xiaoya.progress.v1';
const CHAT_LIMIT = 80;

export const DAILY_GOAL = 8;

// Per-learner storage: each learner gets its own key suffix. Empty scope = legacy key.
export function scopedKey(base: string, scope = '') {
  return scope ? `${base}:${scope}` : base;
}

export const DEFAULT_SETTINGS: Settings = {
  providerId: '',
  model: '',
  voice: 'zh-CN-XiaoxiaoNeural',
  viVoice: 'vi-VN-HoaiMyNeural',
  level: 'HSK5-6',
  autoSpeak: true,
  autoReadTranslation: false,
  showPinyin: false,
  avatarMode: 'lam',
  avatarGender: 'female',
};

const LEVELS = new Set<Level>(['HSK1-2', 'HSK3-4', 'HSK5-6', 'free']);

export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

export function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      providerId: typeof parsed.providerId === 'string' ? parsed.providerId : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      voice:
        typeof parsed.voice === 'string' && parsed.voice
          ? parsed.voice
          : DEFAULT_SETTINGS.voice,
      viVoice:
        typeof parsed.viVoice === 'string' && parsed.viVoice
          ? parsed.viVoice
          : DEFAULT_SETTINGS.viVoice,
      level: LEVELS.has(parsed.level) ? parsed.level : DEFAULT_SETTINGS.level,
      autoSpeak:
        typeof parsed.autoSpeak === 'boolean'
          ? parsed.autoSpeak
          : DEFAULT_SETTINGS.autoSpeak,
      autoReadTranslation:
        typeof parsed.autoReadTranslation === 'boolean'
          ? parsed.autoReadTranslation
          : DEFAULT_SETTINGS.autoReadTranslation,
      showPinyin:
        typeof parsed.showPinyin === 'boolean'
          ? parsed.showPinyin
          : DEFAULT_SETTINGS.showPinyin,
      avatarMode: parsed.avatarMode === 'classic' ? 'classic' : 'lam',
      avatarGender: parsed.avatarGender === 'male' ? 'male' : 'female',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage can be unavailable in private windows
  }
}

export function loadMessages(scope = ''): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedKey(CHAT_KEY, scope)) || 'null');
    if (!parsed || parsed.date !== dayKey() || !Array.isArray(parsed.messages)) {
      return [];
    }
    return parsed.messages
      .filter(
        (m: unknown): m is ChatMessage =>
          Boolean(
            m &&
              typeof m === 'object' &&
              (m as ChatMessage).role &&
              typeof (m as ChatMessage).text === 'string',
          ),
      )
      .filter((m: ChatMessage) => !m.error)
      .slice(-CHAT_LIMIT);
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[], scope = '') {
  try {
    const clean = messages
      .filter((m) => !m.error)
      .map(({ streaming: _streaming, ...rest }) => rest)
      .slice(-CHAT_LIMIT);
    localStorage.setItem(
      scopedKey(CHAT_KEY, scope),
      JSON.stringify({ date: dayKey(), messages: clean }),
    );
  } catch {
    // ignore
  }
}

export function clearMessages(scope = '') {
  try {
    localStorage.removeItem(scopedKey(CHAT_KEY, scope));
  } catch {
    // ignore
  }
}

export function loadProgress(scope = ''): Progress {
  const today = dayKey();
  const fallback: Progress = {
    streak: 0,
    lastDate: '',
    todayDate: today,
    todayTurns: 0,
    totalTurns: 0,
    xp: 0,
    days: [],
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(scopedKey(PROGRESS_KEY, scope)) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const progress: Progress = {
      streak: Number.isFinite(parsed.streak) ? Math.max(0, parsed.streak) : 0,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
      todayDate: typeof parsed.todayDate === 'string' ? parsed.todayDate : today,
      todayTurns: Number.isFinite(parsed.todayTurns) ? Math.max(0, parsed.todayTurns) : 0,
      totalTurns: Number.isFinite(parsed.totalTurns) ? Math.max(0, parsed.totalTurns) : 0,
      xp: Number.isFinite(parsed.xp) ? Math.max(0, parsed.xp) : 0,
      days: Array.isArray(parsed.days)
        ? parsed.days.filter((d: unknown) => typeof d === 'string').slice(-30)
        : [],
    };

    if (progress.todayDate !== today) {
      progress.todayDate = today;
      progress.todayTurns = 0;
    }
    if (progress.lastDate && progress.lastDate !== today && progress.lastDate !== yesterdayKey()) {
      progress.streak = 0;
    }
    return progress;
  } catch {
    return fallback;
  }
}

export function recordPractice(progress: Progress, scope = ''): Progress {
  const today = dayKey();
  const yesterday = yesterdayKey();
  const next: Progress = { ...progress };

  if (next.lastDate !== today) {
    next.streak = next.lastDate === yesterday ? next.streak + 1 : 1;
    next.lastDate = today;
  }
  if (next.todayDate !== today) {
    next.todayDate = today;
    next.todayTurns = 0;
  }

  next.todayTurns += 1;
  next.totalTurns += 1;
  next.xp += 10;
  if (!next.days.includes(today)) {
    next.days = [...next.days, today].slice(-30);
  }

  try {
    localStorage.setItem(scopedKey(PROGRESS_KEY, scope), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function resetProgress(scope = '') {
  const today = dayKey();
  const fresh: Progress = {
    streak: 0,
    lastDate: '',
    todayDate: today,
    todayTurns: 0,
    totalTurns: 0,
    xp: 0,
    days: [],
  };
  try {
    localStorage.removeItem(scopedKey(PROGRESS_KEY, scope));
  } catch {
    // ignore
  }
  return fresh;
}

export function lastSevenDays(progress: Progress) {
  const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const active = new Set(progress.days);
  const result = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    result.push({
      key,
      label: labels[date.getDay()],
      active: active.has(key),
      today: key === dayKey(),
    });
  }
  return result;
}
