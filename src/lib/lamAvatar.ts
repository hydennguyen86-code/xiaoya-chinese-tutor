import { markLatency } from './latency';
import { speechRate } from './listeningPrefs';
import { speakBrowser, stopBrowserVoice } from './browserVoice';
import { GaussianSplatRenderer } from '@myned-ai/gsplat-flame-avatar-renderer';
import type { Emotion, Gesture, TtsResult } from '../types';
import type { AvatarApi } from './avatarApi';
import { fetchTts } from './api';
import { buildSpeechTimeline, type SpeechTimeline } from './lipsync';
import { splitSpeechSegments } from './text';

type Weights = Record<string, number>;

// Mouth shapes for the viseme names produced by lipsync.ts, expressed as ARKit
// blendshape weights (0–1).
const VISEMES: Record<string, Weights> = {
  sil: {},
  PP: { mouthClose: 0.55, mouthPressLeft: 0.45, mouthPressRight: 0.45, jawOpen: 0.03 },
  FF: { mouthRollLower: 0.5, mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25, jawOpen: 0.12 },
  DD: { jawOpen: 0.22, mouthLowerDownLeft: 0.2, mouthLowerDownRight: 0.2 },
  nn: { jawOpen: 0.16, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
  RR: { mouthPucker: 0.3, mouthFunnel: 0.18, jawOpen: 0.2 },
  kk: { jawOpen: 0.26, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12 },
  CH: { mouthPucker: 0.32, mouthFunnel: 0.3, jawOpen: 0.18 },
  SS: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, mouthSmileLeft: 0.18, mouthSmileRight: 0.18, jawOpen: 0.1 },
  aa: { jawOpen: 0.62, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3 },
  E: { jawOpen: 0.34, mouthSmileLeft: 0.35, mouthSmileRight: 0.35, mouthStretchLeft: 0.22, mouthStretchRight: 0.22 },
  I: { jawOpen: 0.2, mouthSmileLeft: 0.45, mouthSmileRight: 0.45, mouthStretchLeft: 0.38, mouthStretchRight: 0.38 },
  O: { jawOpen: 0.4, mouthFunnel: 0.7, mouthPucker: 0.2 },
  U: { jawOpen: 0.2, mouthPucker: 0.7, mouthFunnel: 0.5 },
};

const MOODS: Record<Emotion, Weights> = {
  neutral: { mouthSmileLeft: 0.04, mouthSmileRight: 0.04 },
  happy: { mouthSmileLeft: 0.3, mouthSmileRight: 0.3, cheekSquintLeft: 0.2, cheekSquintRight: 0.2 },
  warm: { mouthSmileLeft: 0.25, mouthSmileRight: 0.25, browInnerUp: 0.16 },
  encouraging: { mouthSmileLeft: 0.34, mouthSmileRight: 0.34, browOuterUpLeft: 0.14, browOuterUpRight: 0.14 },
};

// Channels the mouth/mood layers can touch; always emitted so a channel that
// stops being driven returns to 0 instead of sticking.
const CHANNELS = [
  'jawOpen',
  'jawForward',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'cheekSquintLeft',
  'cheekSquintRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'browDownLeft',
  'browDownRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
];

interface AvatarCallbacks {
  onAudioState?: (playing: boolean) => void;
  onError?: (message: string) => void;
}

interface PlayedSegment {
  start: number; // AudioContext time
  end: number;
  timeline: SpeechTimeline;
  source: AudioBufferSourceNode;
}

type CreatableRenderer = {
  create: (container: HTMLElement, assetPath: string, options: Record<string, unknown>) => Promise<{ dispose: () => void }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class LamAvatarController implements AvatarApi {
  private renderer: { dispose: () => void } | null = null;
  private ctx: AudioContext | null = null;
  private session = 0;
  private chain: Promise<void> = Promise.resolve();
  private pendingSpeech = 0;
  private segments: PlayedSegment[] = [];
  private audioEndAt = 0;
  private reportedSpeaking = false;
  private ttsCache = new Map<string, TtsResult>();
  private destroyed = false;
  private loaded = false;

  private weights: Weights = {};
  private mood: Weights = MOODS.happy;
  private userState: 'Idle' | 'Listening' | 'Thinking' = 'Idle';
  private userStateUntil = 0;
  private lastFrame = 0;
  private nextBlinkAt = 0;
  private blinkStartedAt = -1;

  constructor(
    private container: HTMLElement,
    private callbacks: AvatarCallbacks = {},
  ) {}

  async load(url: string, onProgress?: (ratio: number) => void) {
    this.ctx = new AudioContext();
    const creatable = GaussianSplatRenderer as unknown as CreatableRenderer;
    // The viewer reads window.devicePixelRatio once, when it is built, and uses
    // the same value to scale every splat. Report the real ratio (capped) so the
    // portrait renders at native resolution instead of being upscaled.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => ratio });
    // The library insists the asset path look like ".../<name>.zip" before it
    // even fetches it. Browser-chosen files arrive as blob: URLs, which have no
    // such segment. The check runs synchronously before the first await, so a
    // temporary URL subclass is enough; only `pathname` is spoofed and the
    // native constructor is restored as soon as `create()` yields.
    const NativeURL = window.URL;
    class ZipNameURL extends NativeURL {
      get pathname() {
        const path = super.pathname;
        return path.includes('.zip') ? path : `${path}/avatar.zip`;
      }
    }
    let renderer: { dispose: () => void };
    try {
      let pending: Promise<{ dispose: () => void }>;
      window.URL = ZipNameURL as unknown as typeof URL;
      try {
        pending = creatable.create(this.container, url, {
          backgroundColor: '0xf0d2c0',
          getChatState: () => this.chatState(),
          getExpressionData: () => this.expression(),
          getGazeOffset: () => this.gaze(),
          loadProgress: (progress: number) => onProgress?.(clamp(progress, 0, 1)),
        });
      } finally {
        window.URL = NativeURL;
      }
      renderer = await pending;
    } finally {
      if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
      else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
    }
    if (this.destroyed) {
      renderer.dispose();
      return;
    }
    this.renderer = renderer;
    this.frame(renderer);
    this.loaded = true;
    this.nextBlinkAt = performance.now() + 1800;
  }

  // Transparent background, a closer head-and-shoulders camera, and a frame rate
  // that stays smooth without starving the local LLM of GPU time.
  private frame(renderer: unknown) {
    type Viewer = {
      render: () => void;
      renderer?: {
        setClearColor: (color: number, alpha: number) => void;
      };
      camera?: { position: { set: (x: number, y: number, z: number) => void } };
    };
    const viewer = (renderer as { viewer?: Viewer }).viewer;
    if (!viewer) return;
    try {
      viewer.renderer?.setClearColor(0x000000, 0);
      viewer.camera?.position.set(0, 1.68, 0.46);

      const draw = viewer.render.bind(viewer);
      let lastDraw = 0;
      viewer.render = () => {
        const now = performance.now();
        const thinking = this.userState === 'Thinking' && now < this.userStateUntil;
        const fps = this.isSpeaking ? 30 : thinking ? 12 : 24;
        if (now - lastDraw < 1000 / fps - 2) return;
        lastDraw = now;
        draw();
      };
    } catch {
      // keep the library defaults
    }
  }

  get isLoaded() {
    return this.loaded;
  }

  get isSpeaking() {
    return this.pendingSpeech > 0 || this.audioEndAt > (this.ctx?.currentTime ?? 0);
  }

  async unlock() {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        // the next click will try again
      }
    }
  }

  setThinking() {
    this.userState = 'Thinking';
    this.userStateUntil = performance.now() + 20000;
  }

  setListening() {
    this.userState = 'Listening';
    this.userStateUntil = performance.now() + 9000;
  }

  applyReaction(emotion?: Emotion, _gesture?: Gesture) {
    if (emotion) this.mood = MOODS[emotion] ?? MOODS.neutral;
  }

  beginTurn() {
    stopBrowserVoice();
    this.stopSources();
    this.session += 1;
    this.chain = Promise.resolve();
    this.pendingSpeech = 0;
    this.userState = 'Idle';
  }

  stopSpeech() {
    stopBrowserVoice();
    this.session += 1;
    this.pendingSpeech = 0;
    this.stopSources();
    this.userState = 'Idle';
    this.setSpeaking(false);
  }

  queueSpeech(text: string, voice: string, traceId?: string) {
    if (!this.ctx || this.destroyed) return;
    const clean = text.trim();
    if (!clean) return;

    const session = this.session;
    const rate = speechRate();
    this.pendingSpeech += 1;

    this.chain = this.chain
      .then(async () => {
        if (session !== this.session || this.destroyed || !this.ctx) return;
        markLatency(traceId, 'ttsStart');
        const result = await this.getTts(clean, voice, rate);
        markLatency(traceId, 'ttsReady');
        if (session !== this.session || this.destroyed || !this.ctx) return;
        if (result.browserText) {
          try {
            await speakBrowser(
              result.browserText,
              result.browserLocale ?? 'zh-CN',
              undefined,
              () => {
                markLatency(traceId, 'audio');
                this.callbacks.onAudioState?.(true);
              },
              result.browserRate,
            );
          } finally {
            this.callbacks.onAudioState?.(false);
          }
          return;
        }
        await this.unlock();
        if (session !== this.session || this.destroyed || !this.ctx) return;

        const buffer = await this.decodeAudio(result.audioBase64);
        if (session !== this.session || this.destroyed || !this.ctx) return;

        const timeline = buildSpeechTimeline(clean, result.words, Math.round(buffer.duration * 1000));

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        const start = Math.max(this.ctx.currentTime + 0.05, this.audioEndAt);
        const end = start + buffer.duration;
        source.start(start);
        markLatency(traceId, 'audio', performance.now() + Math.max(0, start - this.ctx.currentTime) * 1000);
        this.segments.push({ start, end, timeline, source });
        this.audioEndAt = end + 0.12;
        this.userState = 'Idle';
        this.setSpeaking(true);
      })
      .catch((error) => {
        if (session === this.session) {
          console.error('[lam-avatar] TTS error', error);
          if (error?.name !== 'AbortError')
            this.callbacks.onError?.(error instanceof Error ? error.message : 'Không đọc được câu trả lời. Thử lại bằng nút Nghe.');
        }
      })
      .finally(() => {
        if (session !== this.session) return;
        this.pendingSpeech = Math.max(0, this.pendingSpeech - 1);
      });
  }

  speakAll(text: string, voice: string, emotion?: Emotion, gesture?: Gesture) {
    const segments = splitSpeechSegments(text);
    if (!segments.length) return false;
    this.beginTurn();
    this.applyReaction(emotion, gesture);
    for (const segment of segments) this.queueSpeech(segment, voice);
    return true;
  }

  destroy() {
    stopBrowserVoice();
    this.destroyed = true;
    this.session += 1;
    this.stopSources();
    try {
      this.renderer?.dispose();
    } catch {
      // ignore
    }
    this.renderer = null;
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.ctx = null;
    this.container.replaceChildren();
  }

  // --- per-frame callbacks, called by the renderer ---

  private chatState() {
    const now = performance.now();
    if (this.isSpeaking) return 'Responding';
    if (this.userState !== 'Idle' && now < this.userStateUntil) return this.userState;
    return 'Idle';
  }

  private gaze() {
    const thinking = this.userState === 'Thinking' && performance.now() < this.userStateUntil;
    return thinking ? { yawDeg: 10, pitchDeg: 7 } : { yawDeg: 0, pitchDeg: 0 };
  }

  private currentViseme(audioTime: number): string | null {
    for (const segment of this.segments) {
      if (audioTime < segment.start || audioTime >= segment.end) continue;
      const ms = (audioTime - segment.start) * 1000;
      const { visemes, vtimes, vdurations } = segment.timeline;
      for (let i = 0; i < visemes.length; i += 1) {
        if (ms >= vtimes[i] && ms < vtimes[i] + vdurations[i]) return visemes[i];
      }
      return 'sil';
    }
    return null;
  }

  private expression(): Weights {
    const now = performance.now();
    const dt = clamp((now - (this.lastFrame || now)) / 1000, 0.001, 0.1);
    this.lastFrame = now;

    const audioTime = this.ctx?.currentTime ?? 0;
    this.segments = this.segments.filter((segment) => segment.end + 0.3 > audioTime);
    if (this.reportedSpeaking && this.pendingSpeech === 0 && audioTime >= this.audioEndAt) {
      this.setSpeaking(false);
    }

    const viseme = this.currentViseme(audioTime);
    const speaking = viseme !== null;
    const target: Weights = {};

    const mood = this.mood;
    const moodScale = speaking ? 0.55 : 1;
    for (const [key, value] of Object.entries(mood)) target[key] = value * moodScale;

    const shape = viseme ? (VISEMES[viseme] ?? {}) : {};
    for (const [key, value] of Object.entries(shape)) {
      target[key] = Math.max(target[key] ?? 0, value);
    }

    if (speaking) {
      const open = shape.jawOpen ?? 0;
      target.browInnerUp = Math.max(target.browInnerUp ?? 0, 0.06 + open * 0.14);
    }
    if (this.userState === 'Thinking' && now < this.userStateUntil) {
      target.browInnerUp = Math.max(target.browInnerUp ?? 0, 0.28);
      target.mouthSmileLeft = 0;
      target.mouthSmileRight = 0;
    }

    // exponential smoothing so mouth shapes blend instead of snapping
    const rate = 1 - Math.exp(-dt * 20);
    const out: Weights = {};
    for (const key of CHANNELS) {
      const current = this.weights[key] ?? 0;
      const goal = target[key] ?? 0;
      const next = current + (goal - current) * rate;
      this.weights[key] = next;
      out[key] = next;
    }

    // blinking, independent of the mouth
    if (this.blinkStartedAt < 0 && now >= this.nextBlinkAt) this.blinkStartedAt = now;
    if (this.blinkStartedAt >= 0) {
      const progress = (now - this.blinkStartedAt) / 150;
      if (progress >= 1) {
        this.blinkStartedAt = -1;
        this.nextBlinkAt = now + 2500 + Math.random() * 3200;
      } else {
        const blink = 1 - Math.abs(progress * 2 - 1);
        out.eyeBlinkLeft = blink;
        out.eyeBlinkRight = blink;
      }
    }
    return out;
  }

  private setSpeaking(playing: boolean) {
    if (this.reportedSpeaking === playing) return;
    this.reportedSpeaking = playing;
    this.callbacks.onAudioState?.(playing);
  }

  private stopSources() {
    for (const segment of this.segments) {
      try {
        segment.source.stop();
      } catch {
        // already stopped
      }
    }
    this.segments = [];
    this.audioEndAt = 0;
  }

  private async getTts(text: string, voice: string, rate: number): Promise<TtsResult> {
    const key = `${voice}::${rate}::${text}`;
    const cached = this.ttsCache.get(key);
    if (cached) return cached;
    const result = await fetchTts(text, voice, undefined, rate);
    if (!result.browserText) this.ttsCache.set(key, result);
    if (this.ttsCache.size > 16) {
      const oldest = this.ttsCache.keys().next().value;
      if (oldest) this.ttsCache.delete(oldest);
    }
    return result;
  }

  private async decodeAudio(base64: string) {
    if (!this.ctx) throw new Error('Audio context chưa sẵn sàng.');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return this.ctx.decodeAudioData(bytes.buffer);
  }
}
