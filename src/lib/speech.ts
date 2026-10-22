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
  return Boolean(getConstructor());
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

export class ChineseMic {
  private recognition: SpeechRecognitionLike | null = null;
  private finalText = '';
  private interimText = '';
  private active = false;
  private callbacks: MicCallbacks;

  constructor(callbacks: MicCallbacks) {
    this.callbacks = callbacks;
  }

  get supported() {
    return Boolean(getConstructor());
  }

  start() {
    if (this.active) return true;
    const Constructor = getConstructor();
    if (!Constructor) return false;

    const recognition = new Constructor();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    this.recognition = recognition;
    this.finalText = '';
    this.interimText = '';
    this.active = true;

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
      this.callbacks.onTranscript((finalText + interim).trim());
    };

    recognition.onerror = (event) => {
      const message = friendlyMicError(event.error);
      if (message && event.error !== 'aborted') {
        this.callbacks.onError(message);
      }
    };

    recognition.onend = () => {
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
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
  }

  abort() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      // ignore
    }
    this.active = false;
    this.recognition = null;
    this.callbacks.onState(false);
  }
}
