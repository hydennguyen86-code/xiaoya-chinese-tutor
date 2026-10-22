import { pinyin } from 'pinyin-pro';
import type { ChatMessage, Emotion, Gesture } from '../types';

const SENTENCE_END = /[。！？!?…]/;
const CLOSERS = /[”’』」》）)】》]/;
const HAN = /\p{Script=Han}/u;

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeGreeting(): ChatMessage {
  const hour = new Date().getHours();
  let text: string;
  let translation: string;
  let suggestion: string;
  let suggestionTranslation: string;

  if (hour < 11) {
    text = '早上好呀！我是小雅。新的一天，你今天有什么安排吗？';
    translation = 'Chào buổi sáng! Mình là Tiểu Nhã. Một ngày mới, hôm nay bạn có kế hoạch gì chưa?';
    suggestion = '我今天打算去图书馆看书。';
    suggestionTranslation = 'Hôm nay mình định đến thư viện đọc sách.';
  } else if (hour < 18) {
    text = '下午好呀！我是小雅。今天过得怎么样？';
    translation = 'Chào buổi chiều! Mình là Tiểu Nhã. Hôm nay của bạn thế nào?';
    suggestion = '还不错，就是有点忙。你呢？';
    suggestionTranslation = 'Cũng ổn, chỉ hơi bận. Còn bạn thì sao?';
  } else {
    text = '晚上好呀！我是小雅。今天有什么想和我分享的吗？';
    translation = 'Chào buổi tối! Mình là Tiểu Nhã. Hôm nay có điều gì bạn muốn chia sẻ với mình không?';
    suggestion = '今天挺顺利的，我下班后看了一部电影。';
    suggestionTranslation = 'Hôm nay khá suôn sẻ, sau giờ làm mình đã xem một bộ phim.';
  }

  return {
    id: uid(),
    role: 'assistant',
    text,
    translation,
    suggestion,
    suggestionTranslation,
    emotion: 'happy' as Emotion,
    gesture: 'none' as Gesture,
    kind: 'greeting',
    createdAt: Date.now(),
  };
}

export function pinyinLine(text: string) {
  if (!text.trim()) return '';
  try {
    const syllables = pinyin(text, {
      toneType: 'symbol',
      type: 'array',
      nonZh: 'consecutive',
    }) as string[];

    let line = '';
    for (const token of syllables) {
      if (!token) continue;
      if (HAN.test(token)) {
        line += `${line ? ' ' : ''}${token}`;
      } else if (/^[，。！？；：、,.!?;:）】》]$/.test(token)) {
        line += token;
      } else if (/^[“”‘’"'（）()《》【】]$/.test(token)) {
        line += token;
      } else {
        line += `${line ? ' ' : ''}${token}`;
      }
    }
    return line.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function cleanForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[*_#`~>]/g, ' ')
    .replace(/\[([^\]]*)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushSegment(segments: string[], raw: string) {
  const clean = cleanForSpeech(raw);
  if (!clean) return;
  if (!/[\p{L}\p{N}]/u.test(clean)) return;
  segments.push(clean);
}

export function extractSpeechSegments(full: string, cursor: number, flush = false) {
  const segments: string[] = [];
  let start = Math.min(cursor, full.length);
  let i = start;

  while (i < full.length) {
    const ch = full[i];
    if (SENTENCE_END.test(ch)) {
      let end = i + 1;
      while (end < full.length && CLOSERS.test(full[end])) end += 1;
      pushSegment(segments, full.slice(start, end));
      start = end;
      i = end;
      continue;
    }

    if (ch === '\n') {
      pushSegment(segments, full.slice(start, i));
      start = i + 1;
      i += 1;
      continue;
    }

    if (i - start >= 88 && /[，,、；;：:]/.test(ch)) {
      pushSegment(segments, full.slice(start, i + 1));
      start = i + 1;
    }
    i += 1;
  }

  if (flush) {
    pushSegment(segments, full.slice(start));
    start = full.length;
  }

  return { segments, cursor: start };
}

export function splitSpeechSegments(text: string) {
  return extractSpeechSegments(text, 0, true).segments;
}

export function shortModelName(model: string, max = 30) {
  if (!model) return '';
  return model.length > max ? `${model.slice(0, max - 1)}…` : model;
}
