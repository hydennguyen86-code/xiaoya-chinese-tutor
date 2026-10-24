declare module '@met4citizen/talkinghead' {
  // Minimal structural types for the three.js objects TalkingHead exposes.
  // The app never imports three itself, so these stay local and dependency-free.
  interface Vec3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): void;
  }

  interface TextureLike {
    anisotropy: number;
    needsUpdate: boolean;
  }

  interface MaterialLike {
    name: string;
    needsUpdate?: boolean;
    roughness?: number;
    metalness?: number;
    envMapIntensity?: number;
    map?: TextureLike | null;
    normalMap?: TextureLike | null;
    roughnessMap?: TextureLike | null;
    metalnessMap?: TextureLike | null;
    aoMap?: TextureLike | null;
  }

  interface Object3DLike {
    position: Vec3;
    rotation: Vec3;
    material?: MaterialLike | MaterialLike[];
    traverse(callback: (node: Object3DLike) => void): void;
  }

  interface SceneLike {
    add(...objects: unknown[]): void;
  }

  interface DirectionalLightLike {
    color: { set(value: number): void };
    intensity: number;
    position: Vec3;
    clone(): DirectionalLightLike;
  }

  interface RendererLike {
    toneMappingExposure: number;
    capabilities: { getMaxAnisotropy(): number };
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
  }

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
    armature: Object3DLike | null;
    isAudioPlaying: boolean;
    renderer: RendererLike;
    scene: SceneLike;
    camera: unknown;
    lightAmbient: unknown;
    lightDirect: DirectionalLightLike;
    lightSpot: unknown;
    showAvatar(
      avatar: AvatarConfig,
      onprogress?: ((event: ProgressEvent) => void) | null,
    ): Promise<void>;
    start(): void;
    stop(): void;
    setView(view: string, opt?: Record<string, unknown>): void;
    setLighting(opt: Record<string, unknown>): void;
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
  export type { AvatarConfig, MaterialLike, Object3DLike, SpeakAudioData, TextureLike };
}
