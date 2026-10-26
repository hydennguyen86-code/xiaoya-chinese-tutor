import { speechRate } from './listeningPrefs';
import { voiceLocale } from './browserVoice';
import type {
  AnalysisReport,
  ChatHistoryMessage,
  Correction,
  StatusResponse,
  StreamAttitude,
  StreamEvent,
  StreamTurn,
  TtsResult,
} from '../types';

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') return data.error;
  } catch {
    // ignore
  }
  return `Yêu cầu thất bại (HTTP ${res.status}).`;
}

export async function fetchStatus(signal?: AbortSignal): Promise<StatusResponse> {
  const res = await fetch('/api/status', { signal });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export interface ChatRequest {
  provider: string;
  model: string;
  level: string;
  messages: ChatHistoryMessage[];
  learning?: string;
  /** role-play instructions for a lesson; the server puts them in the system prompt */
  scenario?: string;
}

export interface ChatStreamHandlers {
  onMeta?: (event: Extract<StreamEvent, { type: 'meta' }>) => void;
  onAttitude?: (event: StreamAttitude) => void;
  onReplyDelta?: (text: string) => void;
  onReplyDone?: () => void;
  onTranslation?: (text: string) => void;
  onTurn?: (event: StreamTurn) => void;
}

export async function streamChat(payload: ChatRequest, handlers: ChatStreamHandlers, signal?: AbortSignal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }
  if (!res.body) {
    throw new Error('Trình duyệt không nhận được luồng phản hồi.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotTurn = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(raw) as StreamEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case 'meta':
              handlers.onMeta?.(event);
              break;
            case 'attitude':
              handlers.onAttitude?.(event);
              break;
            case 'reply_delta':
              handlers.onReplyDelta?.(event.text);
              break;
            case 'reply_done':
              handlers.onReplyDone?.();
              break;
            case 'translation':
              handlers.onTranslation?.(event.text);
              break;
            case 'turn':
              gotTurn = true;
              handlers.onTurn?.(event);
              break;
            case 'error':
              throw new Error(event.message || 'Model gặp lỗi khi trả lời.');
          }
        }

        boundary = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.trim().startsWith('data:')) {
      const raw = buffer.trim().slice(5).trim();
      if (raw) {
        const event = JSON.parse(raw) as StreamEvent;
        if (event.type === 'turn') {
          gotTurn = true;
          handlers.onTurn?.(event);
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Model gặp lỗi khi trả lời.');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!gotTurn) {
    throw new Error('Kết nối với model bị ngắt trước khi phản hồi hoàn tất. Thử lại nhé.');
  }
}

export async function fetchCorrections(payload: { provider: string; model: string; text: string }): Promise<Correction[]> {
  const res = await fetch('/api/corrections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { corrections?: Correction[] };
  return Array.isArray(data?.corrections) ? data.corrections : [];
}

export async function fetchTts(text: string, voice: string, signal?: AbortSignal, rate = speechRate()): Promise<TtsResult> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate }),
      signal,
    });
    if (!res.ok) {
      if (res.status < 500) throw Object.assign(new Error(await readError(res)), { noFallback: true });
      throw new Error('Giọng server không khả dụng.');
    }
    const result = await res.json();
    window.dispatchEvent(
      new CustomEvent('misu:voice-source', {
        detail: `Nguồn giọng: ${result.provider}${result.fallbackReason ? ` — ${result.fallbackReason}` : ''}`,
      }),
    );
    return result;
  } catch (error) {
    if (signal?.aborted || (error as { noFallback?: boolean }).noFallback) throw error;
    if (!('speechSynthesis' in window)) throw error;
    return {
      audioBase64: '',
      mime: '',
      words: [],
      durationMs: 0,
      provider: 'browser',
      browserText: text,
      browserLocale: voiceLocale(voice),
      browserRate: rate,
      fallbackReason: 'Giọng dự phòng của trình duyệt',
    };
  }
}

export async function analyzeLearning(payload: {
  provider: string;
  model: string;
  profile: string;
  periodDays: number;
}): Promise<AnalysisReport> {
  const res = await fetch('/api/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { report?: AnalysisReport };
  if (!data?.report) throw new Error('Model không trả về bản phân tích.');
  return data.report;
}

export async function assessmentRequest<T>(route: 'assess-task' | 'prepare-task', payload: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function resetPitchProfile(learnerId: string): Promise<void> {
  const res = await fetch(`/api/profile?learner=${encodeURIComponent(learnerId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}
