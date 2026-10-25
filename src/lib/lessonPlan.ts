// Pure scheduling logic for the 20-minute daily lesson. No imports, so it can
// be unit-tested directly with `node --test`.

export interface SyllabusLesson {
  no: number;
  title: string;
  pages: string;
  topics: string[];
  days: number;
}

export interface SyllabusVolume {
  authored?: boolean;
  trackId?: string;
  trackTitle?: string;
  nextVolumeId?: string;
  targetLevel?: string;
  id: string;
  title: string;
  levels: string[];
  lessons: SyllabusLesson[];
}

export interface Syllabus {
  book: string;
  volumes: SyllabusVolume[];
  placeholder?: boolean;
  authored?: boolean;
  warning?: string;
}

export const SECTIONS = [
  { id: 'review', title: 'Khởi động ôn tập', minutes: 3 },
  { id: 'vocab', title: 'Từ mới', minutes: 4 },
  { id: 'patterns', title: 'Mẫu câu', minutes: 4 },
  { id: 'roleplay', title: 'Hội thoại nhập vai', minutes: 6 },
  { id: 'freetalk', title: 'Nói tự do', minutes: 2 },
  { id: 'summary', title: 'Tổng kết', minutes: 1 },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];
export const SESSION_MS = SECTIONS.reduce((sum, s) => sum + s.minutes, 0) * 60_000;

export interface Pointer {
  volumeId: string;
  lessonNo: number;
  day: number;
}

export interface SessionStats {
  reviewed: number;
  remembered: number;
  newWords: number;
  sentences: number;
  corrections: number;
  turns: number;
}

export interface DialogLine {
  role: 'user' | 'assistant';
  text: string;
  translation?: string;
  corrections?: Array<{ original: string; corrected: string; explanation: string }>;
}

export interface SessionNote {
  original: string;
  corrected: string;
  explanation: string;
}

export interface SessionState extends Pointer {
  date: string;
  section: number;
  item: number;
  elapsedMs: number[];
  stats: SessionStats;
  /** role-play / free-talk conversation, kept so a resumed session continues it */
  dialog?: DialogLine[];
  /** corrections collected during the session, shown in the summary */
  notes?: SessionNote[];
}

export interface LessonProgress extends Pointer {
  version: 1;
  current: SessionState | null;
  lastCompletedDate: string;
  /** every lesson of the book has been completed */
  finished: boolean;
  completed: number;
  streak: number;
  history: Array<Pointer & { date: string }>;
}

export type TodayPlan =
  | { kind: 'resume'; session: SessionState }
  | { kind: 'start'; pointer: Pointer }
  | { kind: 'done-today'; next: Pointer | null }
  | { kind: 'finished' };

export function sectionBudgetMs(index: number) {
  return (SECTIONS[index]?.minutes ?? 0) * 60_000;
}

export function remainingMs(session: SessionState) {
  return Math.max(0, SESSION_MS - session.elapsedMs.reduce((a, b) => a + b, 0));
}

export function previousDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The first volume meant for this level; otherwise the first volume. */
export function startingVolume(syllabus: Syllabus, level: string) {
  return syllabus.volumes.find((vol) => vol.levels.includes(level)) ?? syllabus.volumes[0];
}

function findLesson(syllabus: Syllabus, volumeId: string, lessonNo: number) {
  const volume = syllabus.volumes.find((vol) => vol.id === volumeId);
  return volume?.lessons.find((lesson) => lesson.no === lessonNo) ?? null;
}

/** Pointer after the given session, or null at the end of the book. */
export function nextPointer(syllabus: Syllabus, pointer: Pointer): Pointer | null {
  const vIndex = syllabus.volumes.findIndex((vol) => vol.id === pointer.volumeId);
  if (vIndex < 0) return null;
  const volume = syllabus.volumes[vIndex];
  const lIndex = volume.lessons.findIndex((lesson) => lesson.no === pointer.lessonNo);
  if (lIndex < 0) return null;
  if (pointer.day < volume.lessons[lIndex].days) return { ...pointer, day: pointer.day + 1 };
  const nextLesson = volume.lessons[lIndex + 1];
  if (nextLesson) return { volumeId: volume.id, lessonNo: nextLesson.no, day: 1 };
  if (volume.authored && volume.trackId && volume.nextVolumeId) {
    const next = syllabus.volumes.find((v, i) => i > vIndex && v.id === volume.nextVolumeId && v.trackId === volume.trackId);
    if (next?.lessons.length) return { volumeId: next.id, lessonNo: next.lessons[0].no, day: 1 };
  }
  if (volume.authored) return null; // Independent courses: never jump from HSK 1 straight to HSK 5.
  const nextVolume = syllabus.volumes[vIndex + 1];
  if (nextVolume?.lessons.length) return { volumeId: nextVolume.id, lessonNo: nextVolume.lessons[0].no, day: 1 };
  return null;
}

/**
 * Make a stored pointer valid for the current outline (the user may replace the
 * placeholder outline with the real one): unknown volume -> start of the level's
 * volume; missing lesson -> the next existing lesson.
 */
export function resolvePointer(syllabus: Syllabus, level: string, pointer: Pointer | null): Pointer | null {
  const start = startingVolume(syllabus, level);
  if (!start?.lessons.length) return null;
  const volume = pointer ? syllabus.volumes.find((vol) => vol.id === pointer.volumeId) : undefined;
  if (!pointer || !volume) return { volumeId: start.id, lessonNo: start.lessons[0].no, day: 1 };
  const lesson = volume.lessons.find((item) => item.no === pointer.lessonNo);
  if (lesson) {
    return { volumeId: volume.id, lessonNo: lesson.no, day: Math.min(Math.max(1, pointer.day), lesson.days) };
  }
  const later = volume.lessons.find((item) => item.no > pointer.lessonNo);
  if (later) return { volumeId: volume.id, lessonNo: later.no, day: 1 };
  return nextPointer(syllabus, { volumeId: volume.id, lessonNo: volume.lessons[volume.lessons.length - 1].no, day: 99 });
}

export function initialProgress(syllabus: Syllabus, level: string): LessonProgress | null {
  const pointer = resolvePointer(syllabus, level, null);
  if (!pointer) return null;
  return { version: 1, ...pointer, current: null, lastCompletedDate: '', finished: false, completed: 0, streak: 0, history: [] };
}

/** What "Bài hôm nay" should open. Missed days never skip lessons. */
export function planToday(progress: LessonProgress | null, syllabus: Syllabus, level: string, today: string): TodayPlan {
  const base = progress ?? initialProgress(syllabus, level);
  if (!base) return { kind: 'finished' };
  const current = base.current;
  if (current && findLesson(syllabus, current.volumeId, current.lessonNo)) {
    return { kind: 'resume', session: current };
  }
  const pointer = base.finished ? null : resolvePointer(syllabus, level, base);
  if (base.lastCompletedDate === today) return { kind: 'done-today', next: pointer };
  if (!pointer) return { kind: 'finished' };
  return { kind: 'start', pointer };
}

export function emptyStats(): SessionStats {
  return { reviewed: 0, remembered: 0, newWords: 0, sentences: 0, corrections: 0, turns: 0 };
}

export function beginSession(
  progress: LessonProgress | null,
  syllabus: Syllabus,
  level: string,
  pointer: Pointer,
  today: string,
): LessonProgress {
  const base = progress ?? (initialProgress(syllabus, level) as LessonProgress);
  return {
    ...base,
    ...pointer,
    current: {
      ...pointer,
      date: today,
      section: 0,
      item: 0,
      elapsedMs: SECTIONS.map(() => 0),
      stats: emptyStats(),
    },
  };
}

export function completeSession(progress: LessonProgress, syllabus: Syllabus, today: string): LessonProgress {
  const done = progress.current ?? { volumeId: progress.volumeId, lessonNo: progress.lessonNo, day: progress.day };
  const pointer: Pointer = { volumeId: done.volumeId, lessonNo: done.lessonNo, day: done.day };
  const next = nextPointer(syllabus, pointer);
  const streak =
    progress.lastCompletedDate === today ? progress.streak : progress.lastCompletedDate === previousDay(today) ? progress.streak + 1 : 1;
  return {
    ...progress,
    ...(next ?? pointer),
    current: null,
    lastCompletedDate: today,
    finished: next === null,
    completed: progress.completed + 1,
    streak,
    history: [...progress.history, { ...pointer, date: today }].slice(-90),
  };
}
