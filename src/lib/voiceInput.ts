// Record one spoken answer. With local speech-to-text (whisper.cpp on this
// computer) the audio is recorded here and sent to /api/transcribe; otherwise
// the browser's own speech recognition is used.

export type VoicePhase = 'listening' | 'transcribing';

export interface VoiceHandle {
  result: Promise<string>;
  /** finish now and transcribe what was said */
  stop: () => void;
  /** discard */
  cancel: () => void;
}

interface Options {
  local: boolean;
  onPhase?: (phase: VoicePhase) => void;
  silenceMs?: number;
  noSpeechMs?: number;
  maxMs?: number;
}

export function voiceSupported(local: boolean) {
  if (local) return typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function listen(options: Options): VoiceHandle {
  return options.local ? listenLocal(options) : listenBrowser(options);
}

function listenLocal({ onPhase, silenceMs = 1600, noSpeechMs = 8000, maxMs = 30000 }: Options): VoiceHandle {
  let stopRequested = false;
  let cancelled = false;
  let finish: () => void = () => {
    stopRequested = true;
  };

  const result = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(250);
    onPhase?.('listening');

    const started = performance.now();
    let noise = 0;
    let calibrated = 0;
    let heard = false;
    let lastVoice = started;
    await new Promise<void>((resolve) => {
      finish = () => {
        stopRequested = true;
        resolve();
      };
      if (stopRequested) resolve();
      const timer = window.setInterval(() => {
        if (stopRequested) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();
        if (now - started < 400) {
          noise = (noise * calibrated + rms) / (calibrated + 1);
          calibrated += 1;
          return;
        }
        if (rms > Math.max(0.012, noise * 2.5)) {
          heard = true;
          lastVoice = now;
        }
        const quietTooLong = heard && now - lastVoice > silenceMs;
        const nothingSaid = !heard && now - started > noSpeechMs;
        if (quietTooLong || nothingSaid || now - started > maxMs) {
          window.clearInterval(timer);
          resolve();
        }
      }, 100);
    });

    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    void ctx.close();
    if (cancelled || !heard) return '';

    onPhase?.('transcribing');
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      body: blob,
    });
    if (!res.ok) throw new Error('Không nhận dạng được giọng nói. Thử lại nhé.');
    const data = (await res.json()) as { text?: string };
    return (data.text || '').trim();
  })();

  return {
    result,
    stop: () => finish(),
    cancel: () => {
      cancelled = true;
      finish();
    },
  };
}

interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function listenBrowser({ onPhase }: Options): VoiceHandle {
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  let recognition: BrowserRecognition | null = null;
  let cancelled = false;
  const result = new Promise<string>((resolve, reject) => {
    if (!Ctor) {
      reject(new Error('Trình duyệt này không hỗ trợ nhận dạng giọng nói.'));
      return;
    }
    recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    let text = '';
    recognition.onresult = (event) => {
      text = Array.from(event.results).map((r) => r[0]?.transcript ?? '').join('');
    };
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        reject(new Error('Không nhận dạng được giọng nói. Thử lại nhé.'));
      }
    };
    recognition.onend = () => resolve(cancelled ? '' : text.trim());
    onPhase?.('listening');
    recognition.start();
  });
  return {
    result,
    stop: () => recognition?.stop(),
    cancel: () => {
      cancelled = true;
      recognition?.abort();
    },
  };
}

/** Chinese text with punctuation and spaces removed, for comparing answers. */
export function bareChinese(text: string) {
  return text.replace(/[\s，。！？、；：,.!?;:“”"'‘’…（）()《》-]/gu, '');
}
