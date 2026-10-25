import type { DictationItem, ShadowingItem } from './authoredListening';
import type { Syllabus } from './lessonPlan';

export interface LessonWord {
  word: string;
  pinyin: string;
  meaning: string;
  example: string;
  examplePinyin: string;
  exampleVi: string;
}

export interface LessonPattern {
  pattern: string;
  explanation: string;
  example: string;
  examplePinyin: string;
  exampleVi: string;
}

export interface ListeningExercise {
  title: string;
  transcript: string;
  translation: string;
  pinyin?: string;
  playLimit: number;
  questions: Array<{ prompt: string; options: string[]; answer: number; explanation: string }>;
}
export interface SpeakingExercise {
  pinyin?: string;
  kind: 'repeat' | 'retell' | 'read' | 'answer' | 'opinion';
  prompt: string;
  promptVi?: string;
  text?: string;
  audioText?: string;
  reference: string;
  sampleZh?: string;
  sampleVi?: string;
  prepareSeconds: number;
  responseSeconds: number;
  checklist: string[];
}
export interface LessonContent {
  listeningPractice?: { source: string; dictation: DictationItem[]; shadowing: ShadowingItem[] } | null;
  authored?: boolean;
  level?: string;
  targetLevel?: string;
  editorialStatus?: string;
  recommendedMinutes?: number;
  learningNotes?: string[];
  pronunciation?: Array<{ text: string; pinyin: string; hint: string }>;
  listening?: ListeningExercise;
  speaking?: SpeakingExercise[];
  checkpoint?: {
    title: string;
    practiceMinutes: number;
    glossary?: Array<{ word: string; pinyin: string; meaningVi: string; note?: string }>;
    instructions: string;
    listening: ListeningExercise[];
    speaking: SpeakingExercise[];
  };
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  review?: { reviewer: string; date: string };
  volumeId: string;
  volumeTitle: string;
  lessonNo: number;
  lessonTitle: string;
  pages: string;
  day: number;
  days: number;
  placeholder: boolean;
  vocab: LessonWord[];
  patterns: LessonPattern[];
  roleplay: {
    setting: string;
    avatarRole: string;
    learnerRole: string;
    goals: string[];
    opening: string;
    openingVi: string;
  };
  freeTalk: { question: string; questionVi: string };
}

async function errorText(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') return data.error;
  } catch {
    // ignore
  }
  return `Yêu cầu thất bại (HTTP ${res.status}).`;
}

export async function fetchSyllabus(signal?: AbortSignal): Promise<Syllabus> {
  const res = await fetch('/api/syllabus', { signal });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function fetchLessonContent(
  payload: {
    provider: string;
    model: string;
    volumeId: string;
    lessonNo: number;
    day: number;
    level: string;
  },
  signal?: AbortSignal,
): Promise<LessonContent> {
  const res = await fetch('/api/lesson-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}
