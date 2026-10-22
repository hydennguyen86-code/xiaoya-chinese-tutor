const EMOTIONS = new Set(['neutral', 'happy', 'warm', 'encouraging']);
const GESTURES = new Set(['none', 'thumbup', 'ok', 'index', 'shrug', 'handup']);

function scanJsonString(raw, start) {
  let text = '';
  let i = start;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      return { text, complete: true };
    }
    if (ch === '\\') {
      const next = raw[i + 1];
      if (next === undefined) return { text, complete: false };
      if (next === 'u') {
        const hex = raw.slice(i + 2, i + 6);
        if (hex.length < 4) return { text, complete: false };
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          text += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        i += 2;
        continue;
      }
      const escapes = {
        '"': '"',
        '\\': '\\',
        '/': '/',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
      };
      text += escapes[next] ?? next;
      i += 2;
      continue;
    }
    text += ch;
    i += 1;
  }
  return { text, complete: false };
}

export function readStringField(raw, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = re.exec(raw);
  if (!match) return null;
  return scanJsonString(raw, match.index + match[0].length);
}

export function readAttitude(raw) {
  const emotion = new RegExp(`"emotion"\\s*:\\s*"(${[...EMOTIONS].join('|')})"`).exec(raw)?.[1];
  const gesture = new RegExp(`"gesture"\\s*:\\s*"(${[...GESTURES].join('|')})"`).exec(raw)?.[1];
  if (!emotion && !gesture) return null;
  return {
    ...(emotion ? { emotion } : {}),
    ...(gesture ? { gesture } : {}),
  };
}

function extractBalancedObject(raw) {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function parseJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const objectText = extractBalancedObject(cleaned);
  if (!objectText) return null;
  const variants = [
    objectText,
    objectText.replace(/,\s*([}\]])/g, '$1'),
  ];
  for (const variant of variants) {
    try {
      return JSON.parse(variant);
    } catch {
      // try the next variant
    }
  }
  return null;
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanReply(value) {
  return cleanText(value)
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim();
}

function cleanCorrections(value, userText = '') {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      original: cleanText(item.original),
      corrected: cleanText(item.corrected),
      explanation: cleanText(item.explanation),
    }))
    .filter((item) => item.original && item.corrected && item.explanation)
    .filter((item) => item.original !== item.corrected)
    .filter((item) => !userText || userText.includes(item.original))
    .slice(0, 2);
}

export function parseCorrections(raw, userText = '') {
  const parsed = parseJson(raw);
  return cleanCorrections(parsed?.corrections, userText);
}

export function normalizeTurn(data, fallbackReply = '') {
  const raw = data && typeof data === 'object' ? data : {};
  const reply = cleanReply(raw.reply) || cleanReply(fallbackReply);

  const corrections = cleanCorrections(raw.corrections);

  const vocab = Array.isArray(raw.vocab)
    ? raw.vocab
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          word: cleanText(item.word),
          pinyin: cleanText(item.pinyin),
          meaning: cleanText(item.meaning),
        }))
        .filter((item) => item.word && item.meaning)
        .slice(0, 2)
    : [];

  const emotion = EMOTIONS.has(raw.emotion) ? raw.emotion : 'neutral';
  const gesture = GESTURES.has(raw.gesture) ? raw.gesture : 'none';

  return {
    reply,
    translation: cleanText(raw.translation),
    emotion,
    gesture,
    corrections,
    vocab,
    suggestion: cleanText(raw.suggestion),
    suggestionTranslation: cleanText(raw.suggestionTranslation),
  };
}

export function parseTutorResponse(raw, fallbackReply = '') {
  const parsed = parseJson(raw);
  if (parsed) {
    return {
      turn: normalizeTurn(parsed, fallbackReply),
      warning: '',
    };
  }

  const salvaged = {
    reply: readStringField(raw, 'reply')?.text || fallbackReply,
    translation: readStringField(raw, 'translation')?.text || '',
    emotion: readAttitude(raw)?.emotion,
    gesture: readAttitude(raw)?.gesture,
    corrections: [],
    vocab: [],
    suggestion: readStringField(raw, 'suggestion')?.text || '',
    suggestionTranslation: readStringField(raw, 'suggestionTranslation')?.text || '',
  };

  const turn = normalizeTurn(salvaged, fallbackReply);
  return {
    turn,
    warning: turn.reply
      ? 'Phản hồi JSON chưa hoàn chỉnh, một số phần phản hồi có thể bị thiếu.'
      : '',
  };
}
