export type Emotion = 'neutral' | 'happy' | 'warm' | 'encouraging';
export type Gesture = 'none' | 'thumbup' | 'ok' | 'index' | 'shrug' | 'handup';
export type Level = 'HSK1-2' | 'HSK3-4' | 'HSK5-6' | 'free';
export type Phase = 'loading' | 'ready' | 'listening' | 'thinking' | 'replying' | 'speaking';

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
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
  level: Level;
  autoSpeak: boolean;
  showPinyin: boolean;
}

export interface ProviderInfo {
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
  providers: ProviderInfo[];
  voices: VoiceInfo[];
  defaultVoice: string;
  levels: Level[];
  avatarUrl: string;
}

export interface TtsWord {
  text: string;
  startMs: number;
  durationMs: number;
}

export interface TtsResult {
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

export type StreamEvent =
  | StreamMeta
  | StreamAttitude
  | StreamReplyDelta
  | StreamReplyDone
  | StreamTurn
  | StreamError;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
