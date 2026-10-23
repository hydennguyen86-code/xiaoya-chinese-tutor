import { PROVIDER_DEFS } from './providers.mjs';

const CORRECTION_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    original: { type: 'string' },
    corrected: { type: 'string' },
    explanation: { type: 'string' },
    category: {
      type: 'string',
      enum: ['grammar', 'word_choice', 'word_order', 'measure_word', 'other'],
    },
  },
  required: ['original', 'corrected', 'explanation', 'category'],
};

export const CORRECTION_SCHEMA = {
  type: 'object',
  properties: {
    corrections: {
      type: 'array',
      items: CORRECTION_ITEM_SCHEMA,
    },
  },
  required: ['corrections'],
};

export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: {
            type: 'string',
            enum: [
              'grammar',
              'word_choice',
              'word_order',
              'measure_word',
              'vocabulary',
              'other',
            ],
          },
          title: { type: 'string' },
          evidence: { type: 'string' },
          advice: { type: 'string' },
          practice: { type: 'string' },
        },
        required: ['skill', 'title', 'evidence', 'advice', 'practice'],
      },
    },
    focusWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          pinyin: { type: 'string' },
          meaning: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['word', 'pinyin', 'meaning', 'why'],
      },
    },
    plan: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'strengths', 'weaknesses', 'focusWords', 'plan'],
};

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    emotion: { type: 'string', enum: ['neutral', 'happy', 'warm', 'encouraging'] },
    gesture: { type: 'string', enum: ['none', 'thumbup', 'ok', 'index', 'shrug', 'handup'] },
    reply: { type: 'string' },
    translation: { type: 'string' },
    corrections: {
      type: 'array',
      items: CORRECTION_ITEM_SCHEMA,
    },
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          pinyin: { type: 'string' },
          meaning: { type: 'string' },
        },
        required: ['word', 'pinyin', 'meaning'],
      },
    },
    suggestion: { type: 'string' },
    suggestionTranslation: { type: 'string' },
  },
  required: [
    'emotion',
    'gesture',
    'reply',
    'translation',
    'corrections',
    'vocab',
    'suggestion',
    'suggestionTranslation',
  ],
};

class ModelError extends Error {
  constructor(message, status = 500, cause) {
    super(message);
    this.name = 'ModelError';
    this.status = status;
    this.cause = cause;
  }
}

function combinedSignal(signal, timeoutMs = 120000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readBody(res) {
  try {
    return (await res.text()).slice(0, 600).replace(/\s+/g, ' ');
  } catch {
    return '';
  }
}

async function* readLines(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        yield line;
      }
    }
    buffer += decoder.decode();
    if (buffer.length) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

async function streamOllama({
  model,
  messages,
  signal,
  onDelta,
  schema = TURN_SCHEMA,
  maxTokens = 700,
  temperature = 0.7,
}) {
  const url = `${PROVIDER_DEFS.ollama.url}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: combinedSignal(signal),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      think: false,
      format: schema,
      keep_alive: '30m',
      options: {
        temperature,
        top_p: 0.92,
        num_predict: maxTokens,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await readBody(res);
    throw new ModelError(
      `Ollama không phản hồi đúng (HTTP ${res.status}). ${detail}`,
      502,
    );
  }

  const usage = {};
  let sawToken = false;

  for await (const line of readLines(res)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.error) {
      throw new ModelError(`Ollama: ${event.error}`, 502);
    }
    const delta = event.message?.content || '';
    if (delta) {
      sawToken = true;
      onDelta(delta);
    }
    if (event.done) {
      usage.promptTokens = event.prompt_eval_count;
      usage.completionTokens = event.eval_count;
      usage.totalDurationMs = Math.round((event.total_duration || 0) / 1e6);
      usage.loadDurationMs = Math.round((event.load_duration || 0) / 1e6);
      if (event.done_reason) usage.doneReason = event.done_reason;
    }
  }

  if (!sawToken) {
    throw new ModelError('Model không trả về nội dung. Hãy thử model khác trong Cài đặt.', 502);
  }

  return { usage };
}

async function requestLmStudio(
  model,
  messages,
  signal,
  jsonMode,
  schema,
  maxTokens,
  temperature,
) {
  const body = {
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode === 'schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'xiaoya_turn', strict: true, schema },
    };
    body.stream_options = { include_usage: true };
  } else if (jsonMode === 'object') {
    body.response_format = { type: 'json_object' };
    body.stream_options = { include_usage: true };
  }
  return fetch(`${PROVIDER_DEFS.lmstudio.url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: combinedSignal(signal),
    body: JSON.stringify(body),
  });
}

async function streamLmStudio({
  model,
  messages,
  signal,
  onDelta,
  schema = TURN_SCHEMA,
  maxTokens = 700,
  temperature = 0.7,
}) {
  let res = await requestLmStudio(
    model,
    messages,
    signal,
    'schema',
    schema,
    maxTokens,
    temperature,
  );

  for (const fallback of ['object', 'none']) {
    if (res.status !== 400) break;
    await res.body?.cancel();
    res = await requestLmStudio(
      model,
      messages,
      signal,
      fallback,
      schema,
      maxTokens,
      temperature,
    );
  }

  if (!res.ok || !res.body) {
    const detail = await readBody(res);
    throw new ModelError(
      `LM Studio không phản hồi đúng (HTTP ${res.status}). ${detail}`,
      502,
    );
  }

  let usage = {};
  let sawToken = false;

  for await (const line of readLines(res)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }
    if (event.error) {
      throw new ModelError(`LM Studio: ${event.error.message || event.error}`, 502);
    }
    const choice = event.choices?.[0];
    const delta = choice?.delta?.content;
    if (delta) {
      sawToken = true;
      onDelta(delta);
    }
    if (event.usage) {
      usage.promptTokens = event.usage.prompt_tokens;
      usage.completionTokens = event.usage.completion_tokens;
    }
    if (choice?.finish_reason) usage.doneReason = choice.finish_reason;
  }

  if (!sawToken) {
    throw new ModelError(
      'LM Studio không trả về nội dung. Model có thể đang bật chế độ suy luận hoặc đã hết token.',
      502,
    );
  }

  return { usage };
}

export async function streamCompletion({
  provider,
  model,
  messages,
  signal,
  onDelta,
  schema,
  maxTokens,
  temperature,
}) {
  const startedAt = Date.now();
  if (provider === 'ollama') {
    const result = await streamOllama({
      model,
      messages,
      signal,
      onDelta,
      schema,
      maxTokens,
      temperature,
    });
    return { ...result, elapsedMs: Date.now() - startedAt };
  }
  if (provider === 'lmstudio') {
    const result = await streamLmStudio({
      model,
      messages,
      signal,
      onDelta,
      schema,
      maxTokens,
      temperature,
    });
    return { ...result, elapsedMs: Date.now() - startedAt };
  }
  throw new ModelError('Provider không hợp lệ.', 400);
}

export async function completeJson({
  provider,
  model,
  messages,
  signal,
  schema,
  maxTokens = 300,
  temperature = 0.3,
}) {
  let raw = '';
  const result = await streamCompletion({
    provider,
    model,
    messages,
    signal,
    schema,
    maxTokens,
    temperature,
    onDelta: (text) => {
      raw += text;
    },
  });
  return { ...result, raw };
}

export { ModelError };
