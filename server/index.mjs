import { mountListeningCorpus } from './listeningCorpus.mjs';
import { createAvatarStore } from './avatars.mjs';
import https from 'node:https';
import http from 'node:http';
import { createLanAccess, ownerRequest } from './lanAccess.mjs';
import os from 'node:os';
import { initializeRemoteProvider, publicRemoteSettings, saveRemoteSettings, deleteRemoteSettings } from './remoteProvider.mjs';
import { mountToneEvaluation } from './toneEvaluation.mjs';
import { assessTask, prepareTask } from './assessment.mjs';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { pinyin } from 'pinyin-pro';

import { PROVIDER_DEFS, detectProviders } from './providers.mjs';
import { CORRECTION_PROMPT, LEVELS, buildAnalysisMessages, buildMessages, sanitizeHistory } from './prompt.mjs';
import { ANALYSIS_SCHEMA, CORRECTION_SCHEMA, ModelError, completeJson, streamCompletion } from './llm.mjs';
import { parseCorrections, parseJsonObject, parseTutorResponse, readAttitude, readStringField } from './jsonStream.mjs';
import { CLONE_VOICES, DEFAULT_VI_VOICE, TTS_VOICES, VI_TTS_VOICES, isCloneVietnameseVoice, synthesizeSpeech } from './tts.mjs';
import { createDataStore } from './dataStore.mjs';
import { isStyleOnlyEdit } from './correctionFilter.mjs';
import { mergeCorrections, ruleCorrections } from './grammarRules.mjs';
import { startStt, stopStt, sttReady, transcribe } from './stt.mjs';
import { analyseTones, profileFromAudio } from './tones.mjs';
import { loadSyllabus } from './syllabus.mjs';
import { getLessonContent } from './lessonContent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const dataStore = createDataStore(process.env.XIAOYA_DATA_DIR || path.resolve(__dirname, '..', 'data'));

initializeRemoteProvider(dataStore.dir);
const lan = await createLanAccess({ host: HOST, port: PORT, dataDir: dataStore.dir });
const app = express();
app.disable('x-powered-by');
app.use(lan.guard);
app.use(express.json({ limit: '5mb' }));
app.post('/api/lan/login', lan.login);
app.get('/api/lan/info', lan.info);
app.get('/api/lan/certificate', (req, res) =>
  ownerRequest(req) && lan.tls ? res.type('application/x-pem-file').send(lan.tls.cert) : res.sendStatus(403),
);
mountToneEvaluation(app, dataStore.dir);
mountListeningCorpus(app, dataStore.dir);
const isOwner = ownerRequest;
app.get('/api/provider-config', (req, res) => (isOwner(req) ? res.json(publicRemoteSettings()) : res.sendStatus(403)));
app.put('/api/provider-config', (req, res) => {
  if (!isOwner(req)) return res.sendStatus(403);
  try {
    res.json(saveRemoteSettings(req.body));
  } catch {
    res.status(400).json({ error: 'Cấu hình chưa hợp lệ: cần URL HTTPS, model và đồng ý gửi hội thoại. Key không được chứa xuống dòng.' });
  }
});
app.delete('/api/provider-config', (req, res) => {
  if (!isOwner(req)) return res.sendStatus(403);
  deleteRemoteSettings();
  res.json({ ok: true });
});

// Learner data folder (see dataStore.mjs). The server only listens on
// 127.0.0.1 by default, so this is reachable from this computer only.
app.get('/api/store', (_req, res) => {
  res.json({ dir: dataStore.dir, items: dataStore.readAll() });
});

app.put('/api/store/:key', (req, res) => {
  try {
    dataStore.write(req.params.key, req.body?.value);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Speech-to-text on this computer (whisper.cpp). Body: the raw recorded audio.
app.post('/api/transcribe', express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
    res.status(400).json({ error: 'Không có âm thanh.' });
    return;
  }
  try {
    const text = await transcribe(req.body, String(req.headers['content-type'] || 'audio/webm'));
    res.json({ text });
    // learn the speaker's pitch range in the background (used by tone checks)
    const key = pitchKey(String(req.query.learner || ''));
    if (key) {
      profileFromAudio(req.body, loadPitchProfile(key))
        .then((profile) => dataStore.write(key, JSON.stringify(profile)))
        .catch(() => {});
    }
  } catch (error) {
    console.error('[stt]', error.message);
    res.status(error.status || 500).json({ error: 'Không nhận dạng được giọng nói. Thử lại nhé.' });
  }
});

// Pronunciation practice. A per-learner pitch profile (their voice range) is
// kept in the data folder so isolated syllables can be judged high or low.
const LEARNER_ID = /^[A-Za-z0-9_-]{1,40}$/;
const pitchKey = (learner) => (LEARNER_ID.test(learner) ? `xiaoya.pitch.v1:${learner}` : '');

function loadPitchProfile(key) {
  if (!key) return null;
  try {
    return JSON.parse(dataStore.read(key) || 'null');
  } catch {
    return null;
  }
}

const modelCurves = new Map();
async function modelCurve(target) {
  if (modelCurves.has(target)) return modelCurves.get(target);
  const speech = await synthesizeSpeech({ text: target, voice: DEFAULT_VOICE });
  const report = await analyseTones(Buffer.from(speech.audioBase64, 'base64'), target);
  const curve = {
    curve: report.curve || [],
    segments: report.segments || [],
    duration: report.duration,
    audioBase64: speech.audioBase64,
    mime: speech.mime,
  };
  modelCurves.set(target, curve);
  if (modelCurves.size > 200) modelCurves.delete(modelCurves.keys().next().value);
  return curve;
}

// Query: target=<sentence>, learner=<id>; body: the raw recorded audio.
app.post('/api/pronounce', express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
  const target = String(req.query.target || '').slice(0, 120);
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000 || !HAN.test(target)) {
    res.status(400).json({ error: 'Cần âm thanh và câu mẫu tiếng Trung.' });
    return;
  }
  try {
    const key = pitchKey(String(req.query.learner || ''));
    const mime = String(req.headers['content-type'] || 'audio/webm');
    const [text, report] = await Promise.all([
      sttReady() ? transcribe(req.body, mime).catch(() => '') : Promise.resolve(''),
      analyseTones(req.body, target, { profile: loadPitchProfile(key), debug: req.query.debug === '1' }),
    ]);
    if (key) dataStore.write(key, JSON.stringify(report.profile));
    const { profile: _profile, ...tones } = report;
    if (req.query.reference !== '0') {
      const reference = await modelCurve(target).catch(() => null);
      if (reference) {
        tones.modelCurve = reference.curve;
        tones.model = reference;
      }
    }
    res.json({ text, tones });
  } catch (error) {
    console.error('[pronounce]', error.message);
    res.status(error.status || 500).json({ error: 'Không chấm được phát âm. Thử lại nhé.' });
  }
});

app.delete('/api/store/:key', (req, res) => {
  try {
    dataStore.remove(req.params.key);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

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
  // deterministic rules for typical Vietnamese-learner errors always apply,
  // even when the model is slow, down or returns nothing usable
  const ruleFixes = ruleCorrections(userText);
  let raw = '';
  try {
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
      temperature: 0,
    });
    raw = result.raw;
  } catch (error) {
    if (!ruleFixes.length) throw error;
  }
  // drop "corrections" that only change style (synonyms, 很→非常, 儿, final particles)
  const modelFixes = parseCorrections(raw, userText)
    .filter((item) => !isStyleOnlyEdit(item.original, item.corrected, userText))
    // the explanation must be Vietnamese; a Chinese one is dropped, the fix is kept
    .map((item) => (HAN.test(item.explanation || '') ? { ...item, explanation: '' } : item));
  return mergeCorrections(ruleFixes, modelFixes);
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
      pinyin: HAN.test(item.word) ? pinyin(item.word, { toneType: 'symbol', type: 'array' }).join(' ') : item.pinyin,
    }));

  if (!turn.suggestion || !HAN.test(turn.suggestion)) {
    turn.suggestion = '';
    turn.suggestionTranslation = '';
  }
}

const avatarStore = createAvatarStore({
  dataDir: dataStore.dir,
  publicDir: path.resolve(__dirname, '..', 'public'),
  samplesOnly: process.env.XIAOYA_SAMPLE_AVATARS === '1',
});
app.get('/api/avatars/:name', (req, res) => {
  const file = avatarStore.resolve(req.params.name);
  if (!file) return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store').sendFile(file);
});
// Even an old dist must not expose legacy avatars through the static route.
app.use('/avatars', (req, res, next) => {
  if (!['/brunette.glb', '/lam-sample.zip'].includes(req.path)) return res.sendStatus(404);
  next();
});

app.get('/api/status', async (_req, res) => {
  const providers = await detectProviders();
  res.json({
    providers,
    voices: [...TTS_VOICES, ...CLONE_VOICES.filter((v) => !isCloneVietnameseVoice(v.id))],
    defaultVoice: DEFAULT_VOICE,
    viVoices: [...VI_TTS_VOICES, ...CLONE_VOICES.filter((v) => isCloneVietnameseVoice(v.id))],
    defaultViVoice: DEFAULT_VI_VOICE,
    levels: Object.keys(LEVELS),
    avatarUrl: avatarStore.glbUrl(),
    lamAvatarUrl: avatarStore.lamUrl(),
    localStt: sttReady(),
    system: { ramGB: Math.round(os.totalmem() / 1024 ** 3), platform: process.platform },
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
    const result = await synthesizeSpeech({ text, voice, rate: req.body?.rate });
    res.json(result);
  } catch (error) {
    console.error('[tts]', error.message);
    res.status(error.status || 502).json({
      error: 'Không tạo được giọng đọc. Kiểm tra kết nối mạng (Edge TTS) rồi thử lại.',
    });
  }
});

const ANALYSIS_SKILLS = new Set(['grammar', 'word_choice', 'word_order', 'measure_word', 'vocabulary', 'other']);

function analysisText(value, max = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function sanitizeAnalysis(data, periodDays) {
  if (!data || typeof data !== 'object') return null;

  const summary = analysisText(data.summary, 900);
  const strengths = Array.isArray(data.strengths)
    ? data.strengths
        .map((item) => analysisText(item, 220))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const weaknesses = Array.isArray(data.weaknesses)
    ? data.weaknesses
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          skill: ANALYSIS_SKILLS.has(item.skill) ? item.skill : 'other',
          title: analysisText(item.title, 180),
          evidence: analysisText(item.evidence, 400),
          advice: analysisText(item.advice, 450),
          practice: analysisText(item.practice, 450),
        }))
        .filter((item) => item.title)
        .slice(0, 4)
    : [];
  const focusWords = Array.isArray(data.focusWords)
    ? data.focusWords
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const word = analysisText(item.word, 30);
          const modelPinyin = analysisText(item.pinyin, 100);
          const pinyinLooksValid = !HAN.test(modelPinyin) && /^[A-Za-z\u00c0-\u024f\u1e00-\u1eff' -]+$/.test(modelPinyin);
          return {
            word,
            pinyin: HAN.test(word)
              ? pinyinLooksValid
                ? modelPinyin
                : pinyin(word, { toneType: 'symbol', type: 'array' }).join(' ')
              : modelPinyin,
            meaning: analysisText(item.meaning, 220),
            why: analysisText(item.why, 250),
          };
        })
        .filter((item) => item.word && HAN.test(item.word) && item.meaning && !HAN.test(item.meaning))
        .slice(0, 4)
    : [];
  const plan = Array.isArray(data.plan)
    ? data.plan
        .map((item) => analysisText(item, 250))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!summary && !weaknesses.length) return null;

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    periodDays,
    summary,
    strengths,
    weaknesses,
    focusWords,
    plan,
  };
}

// Assessment requests are bounded; provider/model are resolved through existing local adapters.
for (const route of ['assess-task', 'prepare-task']) {
  app.post(`/api/${route}`, async (req, res) => {
    const { provider, model, goals, learnerTurns, source, level, variant, open = false } = req.body || {};
    if (
      !PROVIDER_DEFS[provider] ||
      typeof model !== 'string' ||
      !model.trim() ||
      model.length > 200 ||
      !Array.isArray(goals) ||
      goals.length > 6 ||
      (!open && !goals.length) ||
      goals.some((g) => typeof g !== 'string' || !g.trim() || g.length > 300) ||
      (route === 'assess-task' &&
        (!Array.isArray(learnerTurns) ||
          !learnerTurns.length ||
          learnerTurns.length > 8 ||
          learnerTurns.some((t) => typeof t !== 'string' || !t.trim() || t.length > 2000)))
    ) {
      return res.status(400).json({ error: 'Dữ liệu kiểm tra không hợp lệ.' });
    }
    try {
      const result =
        route === 'prepare-task'
          ? await prepareTask({
              goals,
              source: String(source || '').slice(0, 600),
              level: String(level || '').slice(0, 20),
              variant: String(variant || '').slice(0, 100),
              provider,
              model,
            })
          : await assessTask({ goals, learnerTurns, provider, model, open: open === true });
      res.json(result);
    } catch (error) {
      console.error('[assessment]', error.message);
      res.status(502).json({ error: 'Chưa đánh giá được. Kiểm tra model rồi thử lại; kết quả chưa được tính điểm.' });
    }
  });
}

app.post('/api/analysis', async (req, res) => {
  const { provider = 'ollama', model, profile, periodDays = 1 } = req.body || {};

  if (!PROVIDER_DEFS[provider]) {
    res.status(400).json({ error: 'Provider không hợp lệ.' });
    return;
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 200) {
    res.status(400).json({ error: 'Chưa chọn model.' });
    return;
  }
  if (typeof profile !== 'string' || profile.trim().length < 30) {
    res.status(400).json({
      error: 'Chưa có đủ dữ liệu học tập để phân tích. Hãy luyện thêm vài lượt rồi thử lại.',
    });
    return;
  }

  const safePeriod = Math.max(1, Math.min(365, Math.round(Number(periodDays) || 1)));

  try {
    const result = await completeJson({
      provider,
      model: model.trim(),
      messages: buildAnalysisMessages(profile),
      signal: AbortSignal.timeout(150000),
      schema: ANALYSIS_SCHEMA,
      maxTokens: 1600,
      temperature: 0.35,
    });
    const report = sanitizeAnalysis(parseJsonObject(result.raw), safePeriod);
    if (!report) {
      throw new ModelError('Model trả về bản phân tích chưa đúng cấu trúc.', 502);
    }
    res.json({ report, elapsedMs: result.elapsedMs });
    console.log(`[analysis] ${provider}/${model} · ${result.elapsedMs}ms · ${report.weaknesses.length} điểm yếu`);
  } catch (error) {
    console.error('[analysis]', error);
    res.status(error.status || 502).json({
      error: friendlyError(error),
    });
  }
});

app.post('/api/corrections', async (req, res) => {
  const { provider = 'ollama', model, text = '' } = req.body || {};

  if (!PROVIDER_DEFS[provider]) {
    res.status(400).json({ error: 'Provider không hợp lệ.' });
    return;
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 200) {
    res.status(400).json({ error: 'Chưa chọn model.' });
    return;
  }

  const learnerText =
    typeof text === 'string'
      ? text
          .replace(/\u0000/g, '')
          .trim()
          .slice(0, 2000)
      : '';
  if (!learnerText || !HAN.test(learnerText)) {
    res.json({ corrections: [] });
    return;
  }

  try {
    const corrections = await collectCorrections(provider, model.trim(), learnerText);
    res.json({ corrections });
  } catch (error) {
    if (error?.name !== 'AbortError' && error?.name !== 'TimeoutError') {
      console.error('[correct]', error.message);
    }
    res.json({ corrections: [] });
  }
});

// Daily lessons: course outline and the cached practice material per session.
app.get('/api/syllabus', (_req, res) => {
  res.json(loadSyllabus(dataStore.dir));
});

app.post('/api/lesson-content', async (req, res) => {
  const { provider = 'ollama', model, volumeId, lessonNo, day, level = 'HSK5-6' } = req.body || {};
  const syllabus = loadSyllabus(dataStore.dir);
  const fixedCourse = syllabus.volumes.some((v) => v.id === volumeId && v.authored);
  if (!fixedCourse && (!PROVIDER_DEFS[provider] || typeof model !== 'string' || !model.trim())) {
    res.status(400).json({ error: 'Chưa chọn model.' });
    return;
  }
  try {
    const content = await getLessonContent({
      dataDir: dataStore.dir,
      syllabus,
      volumeId: String(volumeId || ''),
      lessonNo: Number(lessonNo),
      day: Number(day),
      level: Object.hasOwn(LEVELS, level) ? level : 'HSK5-6',
      provider,
      model: typeof model === 'string' ? model.trim() : '',
    });
    res.json(content);
  } catch (error) {
    console.error('[lesson]', error.message);
    res.status(error.status || 502).json({ error: error.status ? error.message : friendlyError(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  const { provider = 'ollama', model, level = 'HSK5-6', messages = [], learning = '', scenario = '' } = req.body || {};

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
  const learningDigest =
    typeof learning === 'string'
      ? learning
          .replace(/\u0000/g, '')
          .trim()
          .slice(0, 2200)
      : '';
  // a lesson role-play scenario goes first so the learner digest cannot push it out
  const scenarioText =
    typeof scenario === 'string'
      ? scenario
          .replace(/\u0000/g, '')
          .trim()
          .slice(0, 900)
      : '';
  const conversation = buildMessages(safeLevel, history, [scenarioText, learningDigest].filter(Boolean).join('\n\n'));

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
  let translationSent = false;
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

    const translation = readStringField(raw, 'translation');
    if (translation?.complete && !translationSent) {
      translationSent = true;
      if (!HAN.test(translation.text)) {
        send({ type: 'translation', text: translation.text });
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

    // Grammar check runs afterwards through /api/corrections so the full turn
    // reaches the learner as soon as the reply itself is ready.
    turn.corrections = [];
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
    console.log(`[chat] ${provider}/${model} · ${result.elapsedMs}ms · ${turn.reply.length} ký tự`);
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

const server = lan.enabled ? https.createServer(lan.tls, app) : http.createServer(app);
server.on('error', () => {
  console.error('Không mở được server: cổng đang dùng, HOST không hợp lệ hoặc thiếu quyền.');
  process.exitCode = 1;
});
server.listen(PORT, HOST, async () => {
  const providers = await detectProviders();
  const summary = providers.map((p) => `${p.name}: ${p.online ? `${p.models.length} model` : 'offline'}`).join(' · ');
  process.send?.({ type: 'misu-ready', port: server.address().port });
  console.log(`米苏 server → ${lan.enabled ? 'https' : 'http'}://${HOST}:${PORT}`);
  console.log(`[providers] ${summary}`);
  await startStt();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopStt();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
