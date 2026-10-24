import { listen, voiceSupported, type VoiceHandle } from './voiceInput';

// When the server has local speech-to-text (whisper.cpp), record here and
// transcribe on this computer instead of sending audio to the browser vendor.
let useLocal = false;
let learnerId: string | undefined;

export function configureSpeech(options: { local?: boolean; learnerId?: string }) {
  if (options.local !== undefined) useLocal = options.local && voiceSupported(true);
  if (options.learnerId !== undefined) learnerId = options.learnerId;
}

interface SpeechResultAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechResultAlternative;
}

interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechRecognitionErrorLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return useLocal || Boolean(getConstructor());
}

export async function micPermissionState(): Promise<
  'granted' | 'denied' | 'prompt' | 'unknown'
> {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied') {
      return status.state;
    }
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

function friendlyMicError(code: string) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Chưa được cấp quyền micro. Hãy bật micro trong cài đặt trình duyệt rồi thử lại.';
    case 'no-speech':
      return 'Mình chưa nghe thấy bạn nói. Thử lại gần micro hơn nhé.';
    case 'audio-capture':
      return 'Không truy cập được micro. Kiểm tra quyền micro của trình duyệt và thiết bị đầu vào.';
    case 'network':
      return 'Nhận dạng giọng nói cần kết nối mạng. Kiểm tra mạng rồi thử lại.';
    case 'aborted':
      return '';
    default:
      return 'Không nhận dạng được giọng nói. Thử lại nhé.';
  }
}

interface MicCallbacks {
  onTranscript: (current: string) => void;
  onDone: (finalText: string) => void;
  onError: (message: string) => void;
  onState: (listening: boolean) => void;
}

const SILENCE_MS = 3000;

export class ChineseMic {
  private recognition: SpeechRecognitionLike | null = null;
  private finalText = '';
  private interimText = '';
  private active = false;
  private silenceTimer: number | null = null;
  private localHandle: VoiceHandle | null = null;
  private callbacks: MicCallbacks;

  constructor(callbacks: MicCallbacks) {
    this.callbacks = callbacks;
  }

  get supported() {
    return isSpeechSupported();
  }

  private startLocal() {
    const handle = listen({ local: true, learnerId });
    this.localHandle = handle;
    this.active = true;
    this.callbacks.onState(true);
    handle.result
      .then((text) => {
        if (this.localHandle !== handle) return; // aborted
        this.callbacks.onTranscript(text);
        this.callbacks.onState(false);
        this.callbacks.onDone(text);
      })
      .catch((error: unknown) => {
        if (this.localHandle !== handle) return;
        const denied = error instanceof DOMException && error.name === 'NotAllowedError';
        this.callbacks.onError(
          denied ? friendlyMicError('not-allowed') : error instanceof Error ? error.message : friendlyMicError(''),
        );
        this.callbacks.onState(false);
        this.callbacks.onDone('');
      })
      .finally(() => {
        if (this.localHandle === handle) {
          this.localHandle = null;
          this.active = false;
        }
      });
    return true;
  }

  private clearSilenceTimer() {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private scheduleStop() {
    this.clearSilenceTimer();
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      this.stop();
    }, SILENCE_MS);
  }

  start() {
    if (this.active) return true;
    if (useLocal) return this.startLocal();
    const Constructor = getConstructor();
    if (!Constructor) return false;

    const recognition = new Constructor();
    recognition.lang = 'zh-CN';
    // Giữ micro mở để người học kịp ngừng thở/ngập ngừng giữa câu.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    this.recognition = recognition;
    this.finalText = '';
    this.interimText = '';
    this.active = true;
    this.clearSilenceTimer();

    recognition.onstart = () => {
      this.callbacks.onState(true);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      this.finalText = finalText;
      this.interimText = interim;
      const combined = (finalText + interim).trim();
      this.callbacks.onTranscript(combined);
      if (combined) this.scheduleStop();
    };

    recognition.onerror = (event) => {
      const message = friendlyMicError(event.error);
      if (message && event.error !== 'aborted') {
        this.callbacks.onError(message);
      }
    };

    recognition.onend = () => {
      this.clearSilenceTimer();
      this.active = false;
      this.recognition = null;
      this.callbacks.onState(false);
      this.callbacks.onDone(this.finalText.trim());
    };

    try {
      recognition.start();
      return true;
    } catch {
      this.active = false;
      this.recognition = null;
      return false;
    }
  }

  stop() {
    this.clearSilenceTimer();
    if (this.localHandle) {
      this.localHandle.stop();
      return;
    }
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
  }

  abort() {
    this.clearSilenceTimer();
    if (this.localHandle) {
      const handle = this.localHandle;
      this.localHandle = null;
      this.active = false;
      handle.cancel();
      this.callbacks.onState(false);
      return;
    }
    const recognition = this.recognition;
    this.active = false;
    this.recognition = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }
    this.callbacks.onState(false);
  }
}
