import type { LessonProgress } from './lessonPlan';
import { scopedKey } from './storage';

// Per-learner lesson progress. Stored in browser storage under a xiaoya.* key,
// which serverStore mirrors into the data folder.
const LESSON_KEY = 'xiaoya.lesson.v1';

export function loadLessonProgress(learnerId: string): LessonProgress | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedKey(LESSON_KEY, learnerId)) || 'null');
    if (!parsed || parsed.version !== 1 || typeof parsed.volumeId !== 'string') return null;
    return {
      ...parsed,
      finished: Boolean(parsed.finished),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    } as LessonProgress;
  } catch {
    return null;
  }
}

export function saveLessonProgress(learnerId: string, progress: LessonProgress) {
  try {
    localStorage.setItem(scopedKey(LESSON_KEY, learnerId), JSON.stringify(progress));
  } catch {
    // storage unavailable: the session still runs, it just is not saved
  }
}
