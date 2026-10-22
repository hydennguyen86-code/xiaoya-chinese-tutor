declare module '@met4citizen/talkinghead' {
  interface AvatarConfig {
    url: string;
    body?: string;
    lipsyncLang?: string;
    baseline?: Record<string, number>;
    avatarMood?: string;
    modelDynamicBones?: unknown[];
  }

  interface SpeakAudioData {
    audio: AudioBuffer;
    words?: string[];
    wtimes?: number[];
    wdurations?: number[];
    visemes?: string[];
    vtimes?: number[];
    vdurations?: number[];
  }

  class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    audioCtx: AudioContext;
    avatar: AvatarConfig | null;
    isAudioPlaying: boolean;
    showAvatar(
      avatar: AvatarConfig,
      onprogress?: ((event: ProgressEvent) => void) | null,
    ): Promise<void>;
    start(): void;
    stop(): void;
    setView(view: string, opt?: Record<string, unknown>): void;
    setMood(mood: string): void;
    playGesture(name: string, dur?: number, mirror?: boolean): void;
    stopGesture?(ms?: number): void;
    lookAt(x: number, y: number, t: number): void;
    lookAtCamera(t: number): void;
    lookAhead(t: number): void;
    makeEyeContact(t: number): void;
    speakAudio(
      data: SpeakAudioData,
      opt?: Record<string, unknown>,
      onsubtitles?: unknown,
    ): void;
    stopSpeaking(): void;
  }

  export { TalkingHead };
  export type { AvatarConfig, SpeakAudioData };
}
