import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { pinyin } from 'pinyin-pro';

import { PROVIDER_DEFS, detectProviders } from './providers.mjs';
import { CORRECTION_PROMPT, LEVELS, buildMessages, sanitizeHistory } from './prompt.mjs';
import {
  CORRECTION_SCHEMA,
  ModelError,
  completeJson,
  streamCompletion,
} from './llm.mjs';
import {
  parseCorrections,
  parseTutorResponse,
  readAttitude,
  readStringField,
} from './jsonStream.mjs';
import { TTS_VOICES, synthesizeSpeech } from './tts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function friendlyError(error) {
  if (error?.name === 'AbortError') {
    return 'Phản hồi đã bị dừng.';
  }
  if (error?.name === 'TimeoutError') {
    return 'Model xử lý quá lâu. Bạn thử model nhỏ hơn hoặc đóng bớt ứng dụng đang dùng GPU.';
  }
  if (error instanceof ModelError) {
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error.message)) {
      return 'Không kết nối được model local. Kiểm tra Ollama hoặc LM Studio đã chạy chưa.';
    }
    return 'Model local gặp lỗi khi trả lời. Thử chọn model khác trong Cài đặt.';
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error?.message || '')) {
    return 'Không kết nối được model local. Kiểm tra Ollama hoặc LM Studio đã chạy chưa.';
  }
  return 'Có lỗi khi tạo phản hồi. Thử lại hoặc chọn model khác trong Cài đặt.';
}

const HAN = /\p{Script=Han}/u;

async function collectCorrections(provider, model, userText, signal) {
  const timeout = AbortSignal.timeout(15000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const result = await completeJson({
    provider,
    model,
    messages: [
      { role: 'system', content: CORRECTION_PROMPT },
      { role: 'user', content: userText },
    ],
    signal: combined,
    schema: CORRECTION_SCHEMA,
    maxTokens: 400,
    temperature: 0.3,
  });
  return parseCorrections(result.raw, userText);
}

function polishTurn(turn) {
  if (HAN.test(turn.translation)) turn.translation = '';
  if (HAN.test(turn.suggestionTranslation)) turn.suggestionTranslation = '';

  turn.vocab = turn.vocab
    .filter((item) => item.word && turn.reply.includes(item.word))
    .filter((item) => !HAN.test(item.meaning))
    .slice(0, 2)
    .map((item) => ({
      ...item,
      pinyin: HAN.test(item.word)
        ? pinyin(item.word, { toneType: 'symbol', type: 'array' }).join(' ')
        : item.pinyin,
    }));

  if (!turn.suggestion || !HAN.test(turn.suggestion)) {
    turn.suggestion = '';
    turn.suggestionTranslation = '';
  }
}

app.get('/api/status', async (_req, res) => {
  const providers = await detectProviders();
  res.json({
    providers,
    voices: TTS_VOICES,
    defaultVoice: DEFAULT_VOICE,
    levels: Object.keys(LEVELS),
    avatarUrl: '/avatars/brunette.glb',
  });
});

app.post('/api/tts', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const voice = typeof req.body?.voice === 'string' ? req.body.voice : DEFAULT_VOICE;
  if (!text.trim()) {
    res.status(400).json({ error: 'Thiếu nội dung để đọc.' });
    return;
  }

  try {
    const result = await synthesizeSpeech({ text, voice });
    res.json(result);
  } catch (error) {
    console.error('[tts]', error.message);
    res.status(error.status || 502).json({
      error: 'Không tạo được giọng đọc. Kiểm tra kết nối mạng (Edge TTS) rồi thử lại.',
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const {
    provider = 'ollama',
    model,
    level = 'HSK5-6',
    messages = [],
  } = req.body || {};

  if (!PROVIDER_DEFS[provider]) {
    res.status(400).json({ error: 'Provider không hợp lệ.' });
    return;
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 200) {
    res.status(400).json({ error: 'Chưa chọn model.' });
    return;
  }

  const history = sanitizeHistory(messages);
  if (!history.length || history[history.length - 1].role !== 'user') {
    res.status(400).json({ error: 'Cần có tin nhắn của người học.' });
    return;
  }

  const safeLevel = Object.hasOwn(LEVELS, level) ? level : 'HSK5-6';
  const conversation = buildMessages(safeLevel, history);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let finished = false;
  let clientGone = false;
  const abort = new AbortController();
  const startedAt = Date.now();

  const send = (event) => {
    if (clientGone || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const ping = setInterval(() => {
    if (!clientGone && !res.writableEnded) res.write(': ping\n\n');
  }, 12000);

  res.on('close', () => {
    if (finished) return;
    clientGone = true;
    clearInterval(ping);
    abort.abort();
  });

  let raw = '';
  let sentReplyLength = 0;
  let replyDoneSent = false;
  let lastAttitudeKey = '';

  const processTokenText = (text) => {
    raw += text;

    const attitude = readAttitude(raw);
    if (attitude) {
      const key = JSON.stringify(attitude);
      if (key !== lastAttitudeKey) {
        lastAttitudeKey = key;
        send({ type: 'attitude', ...attitude });
      }
    }

    const partial = readStringField(raw, 'reply');
    if (partial) {
      if (partial.text.length > sentReplyLength) {
        send({ type: 'reply_delta', text: partial.text.slice(sentReplyLength) });
        sentReplyLength = partial.text.length;
      }
      if (partial.complete && !replyDoneSent) {
        replyDoneSent = true;
        send({ type: 'reply_done' });
      }
    }
  };

  try {
    send({
      type: 'meta',
      provider,
      model,
      level: safeLevel,
      startedAt,
    });

    const result = await streamCompletion({
      provider,
      model: model.trim(),
      messages: conversation,
      signal: abort.signal,
      onDelta: processTokenText,
    });

    if (clientGone) return;

    const partialReply = readStringField(raw, 'reply')?.text || '';
    const { turn, warning } = parseTutorResponse(raw, partialReply);

    if (!replyDoneSent) {
      replyDoneSent = true;
      send({ type: 'reply_done' });
    }

    if (!turn.reply) {
      throw new ModelError('Model trả về phản hồi rỗng.', 502);
    }

    try {
      turn.corrections = await collectCorrections(
        provider,
        model.trim(),
        history[history.length - 1].content,
        abort.signal,
      );
    } catch (error) {
      turn.corrections = [];
      if (!clientGone && error?.name !== 'AbortError' && error?.name !== 'TimeoutError') {
        console.error('[correct]', error.message);
      }
    }

    if (clientGone) return;

    polishTurn(turn);

    finished = true;
    clearInterval(ping);
    send({
      type: 'turn',
      turn,
      warning,
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      provider,
      model,
    });
    console.log(
      `[chat] ${provider}/${model} · ${result.elapsedMs}ms · ${turn.reply.length} ký tự`,
    );
  } catch (error) {
    if (!clientGone) {
      console.error('[chat]', error);
      send({ type: 'error', message: friendlyError(error) });
    }
  } finally {
    finished = true;
    clearInterval(ping);
    if (!res.writableEnded) res.end();
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint.' });
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON không hợp lệ.' });
    return;
  }
  console.error('[server]', error);
  res.status(500).json({ error: 'Lỗi server.' });
});

const server = app.listen(PORT, HOST, async () => {
  const providers = await detectProviders();
  const summary = providers
    .map((p) => `${p.name}: ${p.online ? `${p.models.length} model` : 'offline'}`)
    .join(' · ');
  console.log(`小雅 server → http://${HOST}:${PORT}`);
  console.log(`[providers] ${summary}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
