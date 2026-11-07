// Pure pieces of the hands-free microphone (see handsFree.ts): the voice gate
// and the WAV encoder, kept free of browser imports so they can be unit-tested.

export interface GateEvent {
  type: 'start' | 'end' | 'discard';
  /** 'end'/'discard': how many chunks the utterance lasted */
  chunks?: number;
}

export interface GateOptions {
  /** ms of silence that ends an utterance */
  silenceMs: number;
  /** ms of voice needed before an utterance starts (longer while the avatar speaks) */
  onsetMs: number;
  onsetSpeakingMs: number;
  /** utterances shorter than this are dropped as noise */
  minSpeechMs: number;
  maxMs: number;
  chunkMs: number;
}

export const DEFAULT_GATE: GateOptions = {
  silenceMs: 1100,
  onsetMs: 250,
  onsetSpeakingMs: 420,
  minSpeechMs: 450,
  maxMs: 30000,
  chunkMs: 128,
};

/**
 * Pure voice-activity gate over per-chunk RMS values, so it can be tested
 * without a microphone. The noise floor adapts to quiet chunks; while the
 * avatar speaks the threshold is raised because echo cancellation leaves a
 * little of its voice in the signal.
 */
export class VoiceGate {
  private noise = 0.004;
  private calibrated = 0;
  private voiced = 0;
  private quiet = 0;
  private recording = false;
  private length = 0;
  readonly options: GateOptions;
  constructor(options: GateOptions = DEFAULT_GATE) {
    this.options = options;
  }

  get isRecording() {
    return this.recording;
  }

  reset() {
    this.voiced = 0;
    this.quiet = 0;
    this.recording = false;
    this.length = 0;
  }

  threshold(avatarSpeaking: boolean) {
    return avatarSpeaking ? Math.max(0.03, this.noise * 4) : Math.max(0.012, this.noise * 2.5);
  }

  feed(rms: number, avatarSpeaking: boolean): GateEvent | null {
    const { chunkMs } = this.options;
    // the first ~0.75 s is taken as room noise whatever its level, so a fan or
    // street does not read as speech; afterwards only quiet chunks move the floor
    if (this.calibrated < 6) {
      this.noise = (this.noise * this.calibrated + rms) / (this.calibrated + 1);
      this.calibrated += 1;
      return null;
    }
    const loud = rms > this.threshold(avatarSpeaking);
    if (!loud && !this.recording) this.noise = this.noise * 0.95 + rms * 0.05;
    if (!this.recording) {
      this.voiced = loud ? this.voiced + 1 : 0;
      const onset = avatarSpeaking ? this.options.onsetSpeakingMs : this.options.onsetMs;
      if (this.voiced * chunkMs >= onset) {
        this.recording = true;
        this.length = this.voiced;
        this.quiet = 0;
        return { type: 'start' };
      }
      return null;
    }
    this.length += 1;
    this.quiet = loud ? 0 : this.quiet + 1;
    const spoken = (this.length - this.quiet) * chunkMs;
    if (this.quiet * chunkMs >= this.options.silenceMs || this.length * chunkMs >= this.options.maxMs) {
      const chunks = this.length;
      this.reset();
      return { type: spoken >= this.options.minSpeechMs ? 'end' : 'discard', chunks };
    }
    return null;
  }
}

/** 16-bit PCM WAV from float samples */
export function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  write(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (let i = 0; i < chunk.length; i += 1, offset += 2) {
      const v = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
  return new Blob([buffer], { type: 'audio/wav' });
}
