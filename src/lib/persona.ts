import { createContext, useContext } from 'react';
import type { AvatarMode } from '../types';

export type TeacherGender = 'female' | 'male';

export interface Teacher {
  gender: TeacherGender;
  /** how the teacher is addressed in Chinese */
  cn: string;
  /** the single character shown in the seal */
  seal: string;
  pinyin: string;
  /** the latin spelling used in Vietnamese copy */
  vi: string;
  /** a face the app always uses for this teacher, ignoring the custom avatar slot */
  fixedAvatar?: { url: string; mode: AvatarMode };
}

export const TEACHERS: Record<TeacherGender, Teacher> = {
  female: {
    gender: 'female',
    cn: '小雅',
    seal: '雅',
    pinyin: 'Xiǎoyǎ',
    vi: 'Tiểu Nhã',
    fixedAvatar: { url: '/avatars/brunette.glb', mode: 'classic' },
  },
  male: { gender: 'male', cn: '米苏', seal: '苏', pinyin: 'Mǐsū', vi: 'Misu' },
};

export const DEFAULT_TEACHER = TEACHERS.male;

export function teacherFor(gender: string | null | undefined): Teacher {
  return gender === 'female' ? TEACHERS.female : TEACHERS.male;
}

/** a learner practises with a teacher of the opposite gender */
export function teacherGenderFor(gender: string | null | undefined): TeacherGender {
  return gender === 'male' ? 'female' : 'male';
}

export const TeacherContext = createContext<Teacher>(DEFAULT_TEACHER);

export function useTeacher(): Teacher {
  return useContext(TeacherContext);
}

/** lesson content was authored with the male teacher's name in it */
export function renameTeacher(text: string, teacher: Teacher) {
  if (teacher.gender === 'male') return text;
  return text.replace(/Misu/g, teacher.vi).replace(/米苏/g, teacher.cn);
}
