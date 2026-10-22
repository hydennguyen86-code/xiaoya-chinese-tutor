import type {
  ChatHistoryMessage,
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
}

export interface ChatStreamHandlers {
  onMeta?: (event: Extract<StreamEvent, { type: 'meta' }>) => void;
  onAttitude?: (event: StreamAttitude) => void;
  onReplyDelta?: (text: string) => void;
  onReplyDone?: () => void;
  onTurn?: (event: StreamTurn) => void;
}

export async function streamChat(
  payload: ChatRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
) {
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

export async function fetchTts(
  text: string,
  voice: string,
  signal?: AbortSignal,
): Promise<TtsResult> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
