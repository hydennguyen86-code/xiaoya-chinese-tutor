import type { Emotion, Gesture } from '../types';

// The surface of an avatar that App and AvatarStage rely on. Both the classic
// TalkingHead avatar and the LAM Gaussian avatar implement it.
export interface AvatarApi {
  load(url: string, onProgress?: (ratio: number) => void): Promise<void>;
  readonly isLoaded: boolean;
  readonly isSpeaking: boolean;
  unlock(): Promise<void>;
  setThinking(): void;
  setListening(): void;
  applyReaction(emotion?: Emotion, gesture?: Gesture): void;
  beginTurn(): void;
  stopSpeech(): void;
  queueSpeech(text: string, voice: string, traceId?: string): void;
  speakAll(text: string, voice: string, emotion?: Emotion, gesture?: Gesture): boolean;
  destroy(): void;
}
