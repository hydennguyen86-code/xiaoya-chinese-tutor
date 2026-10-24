import { speechRate } from './listeningPrefs';
import { speakBrowser, stopBrowserVoice } from './browserVoice';
import { TalkingHead } from '@met4citizen/talkinghead';
import type { MaterialLike, TextureLike } from '@met4citizen/talkinghead';
import type { Emotion, Gesture, TtsResult } from '../types';
import { fetchTts } from './api';
import type { AvatarApi } from './avatarApi';
import { buildSpeechTimeline } from './lipsync';
import { splitSpeechSegments } from './text';

const MOOD_MAP: Record<Emotion, string> = {
  neutral: 'neutral',
  happy: 'happy',
  warm: 'happy',
  encouraging: 'happy',
};

// Ready Player Me ships matte, game-grade surfaces; a portrait needs softer
// skin and glossier eyes, otherwise the face reads as plastic.
const SURFACE_LOOK: Record<string, { roughness?: number; envMapIntensity?: number }> = {
  Wolf3D_Skin: { roughness: 0.6, envMapIntensity: 0.7 },
  Wolf3D_Eye: { roughness: 0.1, envMapIntensity: 1.4 },
  Wolf3D_Teeth: { roughness: 0.22, envMapIntensity: 0.9 },
  Wolf3D_Hair: { roughness: 0.55, envMapIntensity: 0.8 },
};

type SurfaceMaterial = MaterialLike & {
  roughness?: number;
  envMapIntensity?: number;
  map?: TextureLike | null;
  normalMap?: TextureLike | null;
  roughnessMap?: TextureLike | null;
  metalnessMap?: TextureLike | null;
  aoMap?: TextureLike | null;
};

interface AvatarCallbacks {
  onAudioState?: (playing: boolean) => void;
  onError?: (message: string) => void;
}

export class AvatarController implements AvatarApi {
  private head: TalkingHead | null = null;
  private session = 0;
  private chain: Promise<void> = Promise.resolve();
  private pendingSpeech = 0;
  private speechEndAt = 0;
  private idleTimer: number | null = null;
  private lastGestureAt = 0;
  private ttsCache = new Map<string, TtsResult>();
  private destroyed = false;
  private breathFrame: number | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: AvatarCallbacks = {},
  ) {}

  async load(url: string, onProgress?: (ratio: number) => void) {
    this.head = new TalkingHead(this.container, {
      cameraView: 'head',
      cameraRotateEnable: false,
      cameraZoomEnable: false,
      cameraPanEnable: false,
      cameraDistance: 0.75,
      cameraY: 0.2,
      modelPixelRatio: 2,
      lipsyncLang: 'en',
      lipsyncModules: [],
      avatarMood: 'happy',
      avatarIdleEyeContact: 0.58,
      avatarIdleHeadMove: 0.38,
      avatarSpeakingEyeContact: 0.88,
      avatarSpeakingHeadMove: 0.4,
      lightAmbientColor: 0xfff3e8,
      lightAmbientIntensity: 1.55,
      lightDirectColor: 0xffdfca,
      lightDirectIntensity: 21,
      lightDirectPhi: 1.1,
      lightDirectTheta: 2.1,
    });

    await this.head.showAvatar(
      {
        url,
        body: 'F',
        lipsyncLang: 'en',
        baseline: { headRotateX: -0.02 },
      },
      (event) => {
        if (!onProgress) return;
        const progressEvent = event as ProgressEvent;
        if (progressEvent.total > 0) {
          onProgress(Math.min(1, progressEvent.loaded / progressEvent.total));
        }
      },
    );

    if (this.destroyed) return;
    this.dressScene();
    this.head.setMood('happy');
    this.head.lookAtCamera(4500);
    this.head.start();
    this.startBreathing();
  }

  get isLoaded() {
    return Boolean(this.head?.avatar);
  }

  get isSpeaking() {
    return this.pendingSpeech > 0 || Boolean(this.head?.isAudioPlaying);
  }

  async unlock() {
    const ctx = this.head?.audioCtx;
    if (ctx && ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        // the next click will try again
      }
    }
  }

  setThinking() {
    this.head?.setMood('neutral');
    this.head?.lookAt(0.35, 0.28, 1600);
  }

  setListening() {
    this.head?.setMood('happy');
    this.head?.lookAtCamera(9000);
  }

  applyReaction(emotion?: Emotion, gesture?: Gesture) {
    if (!this.head) return;
    if (emotion) {
      try {
        this.head.setMood(MOOD_MAP[emotion] || 'neutral');
        this.head.lookAtCamera(3500);
      } catch {
        // unsupported mood
      }
    }
    if (gesture && gesture !== 'none' && Date.now() - this.lastGestureAt > 12000) {
      this.lastGestureAt = Date.now();
      try {
        this.head.playGesture(gesture, 2.6);
      } catch {
        // ignore invalid gestures
      }
    }
  }

  beginTurn() {
    stopBrowserVoice();
    this.session += 1;
    this.chain = Promise.resolve();
    this.pendingSpeech = 0;
    this.speechEndAt = 0;
    this.clearIdleTimer();
    try {
      this.head?.stopSpeaking();
      this.head?.stopGesture?.();
    } catch {
      // ignore
    }
  }

  stopSpeech() {
    stopBrowserVoice();
    this.session += 1;
    this.pendingSpeech = 0;
    this.speechEndAt = 0;
    this.clearIdleTimer();
    try {
      this.head?.stopSpeaking();
      this.head?.stopGesture?.();
    } catch {
      // ignore
    }
    this.callbacks.onAudioState?.(false);
  }

  queueSpeech(text: string, voice: string) {
    if (!this.head || this.destroyed) return;
    const clean = text.trim();
    if (!clean) return;

    const session = this.session;
    const rate = speechRate();
    this.pendingSpeech += 1;

    this.chain = this.chain
      .then(async () => {
        if (session !== this.session || this.destroyed || !this.head) return;
        const result = await this.getTts(clean, voice, rate);
        if (session !== this.session || this.destroyed || !this.head) return;
        if (result.browserText) {
          this.callbacks.onAudioState?.(true);
          try {
            await speakBrowser(result.browserText, result.browserLocale ?? 'zh-CN', undefined, undefined, result.browserRate);
          } finally {
            this.callbacks.onAudioState?.(false);
          }
          return;
        }
        await this.unlock();
        if (session !== this.session || this.destroyed || !this.head) return;

        const audioBuffer = await this.decodeAudio(result.audioBase64);
        if (session !== this.session || this.destroyed || !this.head) return;

        const timeline = buildSpeechTimeline(clean, result.words, Math.round(audioBuffer.duration * 1000));

        this.head.speakAudio(
          {
            audio: audioBuffer,
            words: timeline.words,
            wtimes: timeline.wtimes,
            wdurations: timeline.wdurations,
            visemes: timeline.visemes,
            vtimes: timeline.vtimes,
            vdurations: timeline.vdurations,
          },
          {},
          null,
        );

        this.callbacks.onAudioState?.(true);
        const now = performance.now();
        this.speechEndAt = Math.max(this.speechEndAt, now) + audioBuffer.duration * 1000 + 340;
        this.scheduleIdle();
      })
      .catch((error) => {
        if (session === this.session) {
          console.error('[avatar] TTS error', error);
          if (error?.name !== 'AbortError')
            this.callbacks.onError?.(error instanceof Error ? error.message : 'Không đọc được câu trả lời. Thử lại bằng nút Nghe.');
        }
      })
      .finally(() => {
        if (session !== this.session) return;
        this.pendingSpeech = Math.max(0, this.pendingSpeech - 1);
        this.scheduleIdle(this.pendingSpeech > 0 ? 700 : 250);
      });
  }

  speakAll(text: string, voice: string, emotion?: Emotion, gesture?: Gesture) {
    const segments = splitSpeechSegments(text);
    if (!segments.length) return false;
    this.beginTurn();
    this.applyReaction(emotion, gesture);
    for (const segment of segments) {
      this.queueSpeech(segment, voice);
    }
    return true;
  }

  destroy() {
    stopBrowserVoice();
    this.destroyed = true;
    this.session += 1;
    this.clearIdleTimer();
    if (this.breathFrame !== null) {
      cancelAnimationFrame(this.breathFrame);
      this.breathFrame = null;
    }
    try {
      this.head?.stopSpeaking();
      this.head?.stop();
    } catch {
      // ignore
    }
    const ctx = this.head?.audioCtx;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
    this.head = null;
    this.container.replaceChildren();
  }

  private dressScene() {
    const head = this.head;
    const model = head?.armature;
    if (!head?.renderer || !model) return;

    // Default render is 1x, so the portrait is upscaled and looks soft on retina.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    head.renderer.setPixelRatio(ratio);
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width > 0 && height > 0) head.renderer.setSize(width, height, false);
    head.renderer.toneMappingExposure = 1.03;

    const anisotropy = Math.min(8, head.renderer.capabilities.getMaxAnisotropy());
    const seen = new Set<MaterialLike>();
    model.traverse((node) => {
      const nodeMaterial = node.material;
      if (!nodeMaterial) return;
      const list = Array.isArray(nodeMaterial) ? nodeMaterial : [nodeMaterial];
      for (const material of list) {
        const surface: SurfaceMaterial = material;
        if (!surface || seen.has(surface)) continue;
        seen.add(surface);
        for (const map of [surface.map, surface.normalMap, surface.roughnessMap, surface.metalnessMap, surface.aoMap]) {
          if (map) {
            map.anisotropy = anisotropy;
            map.needsUpdate = true;
          }
        }
        const look = SURFACE_LOOK[surface.name];
        if (!look) continue;
        if (look.roughness !== undefined) surface.roughness = look.roughness;
        if (look.envMapIntensity !== undefined) surface.envMapIntensity = look.envMapIntensity;
        surface.needsUpdate = true;
      }
    });

    // Key light alone flattens the face; a cool rim behind and a warm fill in
    // front separate her from the backdrop without touching the base setup.
    head.setLighting({ lightAmbientIntensity: 1.2 });
    const rim = head.lightDirect.clone();
    rim.color.set(0xbdd4ff);
    rim.intensity = 15;
    rim.position.set(1.45, 1.35, -1.55);
    const fill = head.lightDirect.clone();
    fill.color.set(0xffe9de);
    fill.intensity = 7;
    fill.position.set(-1.75, 0.85, 1.45);
    head.scene.add(rim, fill);
  }

  private startBreathing() {
    const model = this.head?.armature;
    if (!model) return;
    const baseY = model.position.y;
    const baseTilt = model.rotation.z;
    const start = performance.now();
    const tick = () => {
      const armature = this.head?.armature;
      if (this.destroyed || !armature) return;
      const t = (performance.now() - start) / 1000;
      armature.position.y = baseY + Math.sin(t * 1.15) * 0.0035;
      armature.rotation.z = baseTilt + Math.sin(t * 0.52) * 0.0022;
      this.breathFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  private async getTts(text: string, voice: string, rate: number): Promise<TtsResult> {
    const key = `${voice}::${rate}::${text}`;
    const cached = this.ttsCache.get(key);
    if (cached) {
      this.ttsCache.delete(key);
      this.ttsCache.set(key, cached);
      return cached;
    }
    const result = await fetchTts(text, voice, undefined, rate);
    if (!result.browserText) this.ttsCache.set(key, result);
    if (this.ttsCache.size > 16) {
      const oldest = this.ttsCache.keys().next().value;
      if (oldest) this.ttsCache.delete(oldest);
    }
    return result;
  }

  private async decodeAudio(base64: string) {
    const ctx = this.head?.audioCtx;
    if (!ctx) throw new Error('Audio context chưa sẵn sàng.');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return ctx.decodeAudioData(bytes.buffer);
  }

  private clearIdleTimer() {
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdle(delayOverride?: number) {
    this.clearIdleTimer();
    const remaining = this.speechEndAt - performance.now();
    const delay = delayOverride ?? Math.max(250, remaining + 180);
    this.idleTimer = window.setTimeout(
      () => {
        this.idleTimer = null;
        if (this.pendingSpeech > 0) {
          this.scheduleIdle(700);
          return;
        }
        const left = this.speechEndAt - performance.now();
        if (left > 120) {
          this.scheduleIdle(left + 160);
          return;
        }
        this.callbacks.onAudioState?.(false);
      },
      Math.max(100, delay),
    );
  }
}
