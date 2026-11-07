import type { VoiceResult } from './voiceInput';
import { saveFluency, type Fluency } from './fluency';

// Hands-free conversation: the microphone stays open for the whole session, a
// small energy gate decides when the learner starts and stops talking, each
// utterance (with a second of pre-roll) is sent for local transcription, and
// talking while the avatar speaks interrupts it (barge-in). Audio is captured
// as 16 kHz PCM through Web Audio, so no MediaRecorder container is involved
// and the pre-roll can simply be kept in a ring buffer.

import { DEFAULT_GATE, VoiceGate, encodeWav, type GateOptions } from './voiceGate';

export type HandsFreeState = 'off' | 'listening' | 'recording' | 'transcribing';

export interface HandsFreeCallbacks {
  onState: (state: HandsFreeState) => void;
  /** the learner started talking while the avatar was speaking */
  onBargeIn: () => void;
  onUtterance: (result: VoiceResult) => void;
  onError: (message: string) => void;
  onLevel?: (rms: number, threshold: number) => void;
}

const SAMPLE_RATE = 16000;
const CHUNK = 2048; // 128 ms at 16 kHz

export class HandsFreeMic {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private gate: VoiceGate;
  private preRoll: Float32Array[] = [];
  private utterance: Float32Array[] = [];
  private avatarSpeaking = false;
  private paused = false;
  private speechEndAt = 0;
  private active = false;
  private state: HandsFreeState = 'off';
  private callbacks: HandsFreeCallbacks;
  private options: { learnerId?: string; gate?: Partial<GateOptions>; preRollMs?: number };

  constructor(callbacks: HandsFreeCallbacks, options: { learnerId?: string; gate?: Partial<GateOptions>; preRollMs?: number } = {}) {
    this.callbacks = callbacks;
    this.options = options;
    this.gate = new VoiceGate({ ...DEFAULT_GATE, ...(options.gate || {}) });
  }

  static supported() {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== 'undefined';
  }

  get isActive() {
    return this.active;
  }

  /** the avatar is talking: raise the gate and treat a new utterance as an interruption */
  setAvatarSpeaking(speaking: boolean) {
    this.avatarSpeaking = speaking;
  }

  /** while the tutor thinks or an utterance is being transcribed, new audio is ignored */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused && this.gate.isRecording) {
      this.gate.reset();
      this.utterance = [];
    }
  }

  async start(): Promise<boolean> {
    if (this.active) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      await this.ctx.resume();
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.processor = this.ctx.createScriptProcessor(CHUNK, 1, 1);
      this.processor.onaudioprocess = (event) => this.handleChunk(event.inputBuffer.getChannelData(0));
      source.connect(this.processor);
      // a ScriptProcessor only runs while connected to the destination; it outputs silence
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      this.processor.connect(mute);
      mute.connect(this.ctx.destination);
      this.active = true;
      this.setState('listening');
      return true;
    } catch {
      this.stop();
      this.callbacks.onError('Không mở được micro cho chế độ nói liên tục. Kiểm tra quyền micro của trình duyệt.');
      return false;
    }
  }

  stop() {
    this.active = false;
    this.gate.reset();
    this.utterance = [];
    this.preRoll = [];
    try {
      this.processor?.disconnect();
    } catch {
      // already gone
    }
    this.processor = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.setState('off');
  }

  private setState(state: HandsFreeState) {
    if (this.state === state) return;
    this.state = state;
    this.callbacks.onState(state);
  }

  private handleChunk(samples: Float32Array) {
    if (!this.active || this.paused) return;
    const copy = new Float32Array(samples);
    let sum = 0;
    for (const v of copy) sum += v * v;
    const rms = Math.sqrt(sum / copy.length);
    this.callbacks.onLevel?.(rms, this.gate.threshold(this.avatarSpeaking));
    const sampleRate = this.ctx?.sampleRate || SAMPLE_RATE;
    const preRollChunks = Math.ceil(((this.options.preRollMs ?? 900) / 1000) * (sampleRate / CHUNK));
    if (!this.gate.isRecording) {
      this.preRoll.push(copy);
      if (this.preRoll.length > preRollChunks) this.preRoll.shift();
    } else {
      this.utterance.push(copy);
    }
    const event = this.gate.feed(rms, this.avatarSpeaking);
    if (!event) return;
    if (event.type === 'start') {
      this.utterance = [...this.preRoll];
      this.preRoll = [];
      this.setState('recording');
      if (this.avatarSpeaking) this.callbacks.onBargeIn();
      return;
    }
    const chunks = this.utterance;
    this.utterance = [];
    if (event.type === 'discard') {
      this.setState('listening');
      return;
    }
    // the last silent chunks mark where speech ended
    const silentChunks = Math.round(this.gate.options.silenceMs / this.gate.options.chunkMs);
    this.speechEndAt = performance.now() - silentChunks * (CHUNK / sampleRate) * 1000;
    void this.transcribe(chunks, sampleRate);
  }

  private async transcribe(chunks: Float32Array[], sampleRate: number) {
    this.setState('transcribing');
    this.paused = true;
    const recordingEnd = performance.now();
    try {
      const blob = encodeWav(chunks, sampleRate);
      const query = new URLSearchParams();
      if (this.options.learnerId) query.set('learner', this.options.learnerId);
      const sttStart = performance.now();
      const res = await fetch(`/api/transcribe?${query}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: blob });
      if (!res.ok) throw new Error('transcribe failed');
      const data = (await res.json()) as { text?: string; fluency?: Fluency; fluencyReason?: string };
      const text = (data.text || '').trim();
      if (this.options.learnerId && data.fluency) saveFluency(this.options.learnerId, data.fluency);
      if (text) {
        this.callbacks.onUtterance({
          text,
          tones: null,
          audio: blob,
          fluency: data.fluency ?? null,
          fluencyReason: data.fluencyReason ?? null,
          timing: { speechEnd: this.speechEndAt, recordingEnd, sttStart, sttEnd: performance.now() },
        });
      }
    } catch {
      this.callbacks.onError('Không nhận dạng được câu vừa nói. Thử lại nhé.');
    } finally {
      this.paused = false;
      if (this.active) this.setState('listening');
    }
  }
}
