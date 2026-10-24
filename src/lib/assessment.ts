import type { LearningProfile, WordRecord, MistakeRecord } from '../types';
import type { LessonContent } from './lessonApi';

export type AssessmentKind = 'week' | 'month';
export interface TaskSpec {
  setting: string;
  avatarRole: string;
  learnerRole: string;
  goals: string[];
  opening: string;
}
export interface CanDo {
  goal: string;
  status: 'done' | 'partly' | 'missing';
  evidence: string;
  helped: boolean;
}
export interface PartScore {
  earned: number;
  total: number;
}
export interface AssessmentRecord {
  kind: AssessmentKind;
  date: string;
  score: number | null;
  parts: Record<string, PartScore>;
  canDo: CanDo[];
  completedAt: number;
  sessionCount: number;
  estimated?: boolean;
}
export interface LessonSample {
  date: number;
  vocab: Array<{ word: string; pinyin: string; meaning: string }>;
  task: TaskSpec;
}
export interface AssessmentData {
  history: AssessmentRecord[];
  samples: LessonSample[];
  tasks: Array<{ date: number; task: TaskSpec; result: CanDo[] }>;
}
export interface AssessmentPlan {
  kind: AssessmentKind;
  words: Array<Pick<WordRecord, 'word' | 'pinyin' | 'meaning'>>;
  mistakes: MistakeRecord[];
  tones: string[];
  tasks: TaskSpec[];
  open: boolean;
}
const DAY = 86400000;
export const emptyAssessment = (): AssessmentData => ({ history: [], samples: [], tasks: [] });
export function loadAssessment(id: string): AssessmentData {
  try {
    const raw = JSON.parse(localStorage.getItem(`xiaoya.assess.v1:${id}`) || 'null');
    if (!raw) return emptyAssessment();
    return {
      history: Array.isArray(raw.history)
        ? raw.history.filter(
            (r: AssessmentRecord) =>
              ['week', 'month'].includes(r?.kind) && Number.isFinite(r.completedAt) && r.parts && Array.isArray(r.canDo),
          )
        : [],
      samples: Array.isArray(raw.samples)
        ? raw.samples.filter((r: LessonSample) => Number.isFinite(r?.date) && Array.isArray(r.vocab) && r.task?.goals?.length)
        : [],
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.filter(
            (r: AssessmentData['tasks'][number]) => Number.isFinite(r?.date) && r.task?.goals?.length && Array.isArray(r.result),
          )
        : [],
    };
  } catch {
    return emptyAssessment();
  }
}
export function saveAssessment(id: string, data: AssessmentData) {
  localStorage.setItem(`xiaoya.assess.v1:${id}`, JSON.stringify(data));
}
export function score(parts: Record<string, PartScore>): number | null {
  const values = Object.values(parts).filter((p) => p.total > 0);
  const total = values.reduce((n, p) => n + p.total, 0);
  return total ? Math.round((values.reduce((n, p) => n + Math.min(p.total, Math.max(0, p.earned)), 0) / total) * 100) : null;
}
export function isDue(kind: AssessmentKind, history: AssessmentRecord[], sessionCount: number, firstStudyAt: number, now = Date.now()) {
  const last = history.filter((r) => r.kind === kind).sort((a, b) => b.completedAt - a.completedAt)[0];
  const since = last?.completedAt ?? firstStudyAt;
  const sessions = Math.max(0, sessionCount - (last?.sessionCount ?? 0));
  return (kind === 'week' && sessions >= 3) || (since > 0 && now - since >= (kind === 'week' ? 7 : 30) * DAY);
}
function plan(kind: AssessmentKind, profile: LearningProfile, data: AssessmentData, now: number): AssessmentPlan {
  const days = kind === 'week' ? 7 : 30;
  const samples = data.samples.filter((s) => s.date >= now - days * DAY);
  const recentWords = profile.words.filter((w) => w.lastSeen >= now - days * DAY);
  // Due words first, then recently encountered words and the actual lesson bank.
  const all = [
    ...profile.words.filter((w) => w.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt),
    ...recentWords,
    ...samples.flatMap((s) => s.vocab),
  ];
  const unique = [...new Map(all.map((w) => [w.word, w])).values()];
  const limit = kind === 'week' ? 6 : 15;
  const words = unique.slice(0, limit);
  const mistakes = [...profile.mistakes]
    .filter((m) => m.lastSeen >= now - days * DAY)
    .sort((a, b) => b.count - a.count)
    .slice(0, kind === 'week' ? 2 : 4);
  const retests = data.tasks.filter((t) => now - t.date >= 3 * DAY && now - t.date <= days * DAY).map((t) => t.task);
  const tasks = [...new Map([...retests, ...samples.map((s) => s.task)].map((t) => [t.goals.join('|'), t])).values()].slice(
    0,
    kind === 'week' ? 1 : 2,
  );
  return {
    kind,
    words,
    mistakes,
    tones: unique
      .map((w) => w.word)
      .filter((w) => [...w].length <= 2)
      .slice(0, kind === 'week' ? 2 : 4),
    tasks,
    open: kind === 'month',
  };
}
export const planWeekly = (p: LearningProfile, d: AssessmentData, now = Date.now()) => plan('week', p, d, now);
export const planMonthly = (p: LearningProfile, d: AssessmentData, now = Date.now()) => plan('month', p, d, now);
export function rememberLesson(id: string, content: LessonContent) {
  const data = loadAssessment(id);
  data.samples = [...data.samples, { date: Date.now(), vocab: content.vocab, task: content.roleplay }].slice(-90);
  saveAssessment(id, data);
}
export function taskLabel(goal: CanDo) {
  return goal.status !== 'done' ? 'Cần luyện lại' : goal.helped ? 'Làm được khi có gợi ý' : 'Tự làm được';
}
