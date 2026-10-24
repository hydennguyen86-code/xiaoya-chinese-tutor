export type Emotion = 'neutral' | 'happy' | 'warm' | 'encouraging';
export type Gesture = 'none' | 'thumbup' | 'ok' | 'index' | 'shrug' | 'handup';
export type Level = 'HSK1-2' | 'HSK3-4' | 'HSK5-6' | 'free';
export type AvatarMode = 'classic' | 'lam';
export type Phase = 'loading' | 'ready' | 'listening' | 'thinking' | 'replying' | 'speaking';
export type MistakeCategory = 'grammar' | 'word_choice' | 'word_order' | 'measure_word' | 'other';
export type SkillKey = MistakeCategory | 'vocabulary';

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  category?: MistakeCategory;
}

export interface VocabItem {
  word: string;
  pinyin: string;
  meaning: string;
}

export interface TutorTurn {
  reply: string;
  translation: string;
  emotion: Emotion;
  gesture: Gesture;
  corrections: Correction[];
  vocab: VocabItem[];
  suggestion: string;
  suggestionTranslation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  translation?: string;
  corrections?: Correction[];
  correctionsPending?: boolean;
  vocab?: VocabItem[];
  suggestion?: string;
  suggestionTranslation?: string;
  emotion?: Emotion;
  gesture?: Gesture;
  streaming?: boolean;
  error?: boolean;
  kind?: 'greeting';
  createdAt: number;
}

export interface Settings {
  providerId: string;
  model: string;
  voice: string;
  viVoice: string;
  level: Level;
  autoSpeak: boolean;
  autoReadTranslation: boolean;
  showPinyin: boolean;
  avatarMode: AvatarMode;
}

export interface ProviderInfo {
  remote?: boolean;
  id: string;
  name: string;
  url: string;
  online: boolean;
  models: string[];
  recommendedModel: string;
}

export interface VoiceInfo {
  id: string;
  label: string;
  short: string;
}

export interface StatusResponse {
  system?: { ramGB: number; platform: string };
  providers: ProviderInfo[];
  voices: VoiceInfo[];
  defaultVoice: string;
  viVoices: VoiceInfo[];
  defaultViVoice: string;
  levels: Level[];
  avatarUrl: string;
  lamAvatarUrl?: string;
  localStt?: boolean;
}

export interface TtsWord {
  text: string;
  startMs: number;
  durationMs: number;
}

export interface TtsResult {
  browserText?: string;
  browserLocale?: string;
  audioBase64: string;
  mime: string;
  words: TtsWord[];
  durationMs: number;
  provider: string;
  fallbackReason?: string;
}

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalDurationMs?: number;
  loadDurationMs?: number;
  doneReason?: string;
}

export interface Progress {
  streak: number;
  lastDate: string;
  todayDate: string;
  todayTurns: number;
  totalTurns: number;
  xp: number;
  days: string[];
}

export interface StreamMeta {
  type: 'meta';
  provider: string;
  model: string;
  level: string;
  startedAt: number;
}

export interface StreamAttitude {
  type: 'attitude';
  emotion?: Emotion;
  gesture?: Gesture;
}

export interface StreamReplyDelta {
  type: 'reply_delta';
  text: string;
}

export interface StreamReplyDone {
  type: 'reply_done';
}

export interface StreamTranslation {
  type: 'translation';
  text: string;
}

export interface StreamTurn {
  type: 'turn';
  turn: TutorTurn;
  warning?: string;
  usage?: ChatUsage;
  elapsedMs?: number;
  provider?: string;
  model?: string;
}

export interface StreamError {
  type: 'error';
  message: string;
}

export type StreamEvent = StreamMeta | StreamAttitude | StreamReplyDelta | StreamReplyDone | StreamTranslation | StreamTurn | StreamError;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MistakeRecord {
  id: string;
  original: string;
  corrected: string;
  explanation: string;
  category: MistakeCategory;
  count: number;
  firstSeen: number;
  lastSeen: number;
  contexts: string[];
}

export interface WordRecord {
  word: string;
  pinyin: string;
  meaning: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  box: number;
  dueAt: number;
  reviews: number;
  lapses: number;
  lastReviewedAt?: number;
}

export interface LearningDay {
  date: string;
  turns: number;
  corrections: number;
  newWords: number;
  reviews: number;
}

export interface AnalysisWeakness {
  skill: SkillKey;
  title: string;
  evidence: string;
  advice: string;
  practice: string;
}

export interface AnalysisFocusWord {
  word: string;
  pinyin: string;
  meaning: string;
  why: string;
}

export interface AnalysisReport {
  id: string;
  createdAt: number;
  periodDays: number;
  summary: string;
  strengths: string[];
  weaknesses: AnalysisWeakness[];
  focusWords: AnalysisFocusWord[];
  plan: string[];
}

export interface LearningProfile {
  version: 1;
  mistakes: MistakeRecord[];
  words: WordRecord[];
  days: LearningDay[];
  reports: AnalysisReport[];
  updatedAt: number;
}
