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

export interface LessonContent {
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

export async function fetchSyllabus(): Promise<Syllabus> {
  const res = await fetch('/api/syllabus');
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function fetchLessonContent(payload: {
  provider: string;
  model: string;
  volumeId: string;
  lessonNo: number;
  day: number;
  level: string;
}, signal?: AbortSignal): Promise<LessonContent> {
  const res = await fetch('/api/lesson-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}
