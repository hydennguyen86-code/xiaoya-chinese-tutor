import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

export const TTS_VOICES = [
  {
    id: 'zh-CN-XiaoxiaoNeural',
    label: 'Xiaoxiao · ấm áp, tự nhiên',
    short: 'Xiaoxiao',
  },
  {
    id: 'zh-CN-XiaoyiNeural',
    label: 'Xiaoyi · trong trẻo, trẻ trung',
    short: 'Xiaoyi',
  },
  {
    id: 'zh-CN-liaoning-XiaobeiNeural',
    label: 'Xiaobei · giọng Đông Bắc',
    short: 'Xiaobei',
  },
  {
    id: 'zh-CN-shaanxi-XiaoniNeural',
    label: 'Xiaoni · giọng Thiểm Tây',
    short: 'Xiaoni',
  },
];

const voiceIds = new Set(TTS_VOICES.map((v) => v.id));
const cache = new Map();
const CACHE_LIMIT = 48;

export function normalizeVoice(voice) {
  return voiceIds.has(voice) ? voice : DEFAULT_VOICE;
}

export function sanitizeSpeechText(input) {
  return String(input ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[<>]/g, ' ')
    .replace(/[*_#`~&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

function cacheGet(key) {
  const value = cache.get(key);
  if (!value) return null;
  cache.delete(key);
  cache.set(key, value);
  return {
    ...value,
    words: value.words.map((word) => ({ ...word })),
  };
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

function splitJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function parseWordBoundaries(chunks) {
  const raw = chunks.join('');
  const words = [];
  for (const objectText of splitJsonObjects(raw)) {
    let parsed;
    try {
      parsed = JSON.parse(objectText);
    } catch {
      continue;
    }
    for (const item of parsed.Metadata || []) {
      if (item?.Type !== 'WordBoundary' || !item.Data?.text?.Text) continue;
      const startMs = Math.max(0, Math.round(Number(item.Data.Offset || 0) / 10000));
      const durationMs = Math.max(30, Math.round(Number(item.Data.Duration || 0) / 10000));
      words.push({
        text: item.Data.text.Text,
        startMs,
        durationMs,
      });
    }
  }
  words.sort((a, b) => a.startMs - b.startMs);
  return words;
}

async function synthesizeEdge(text, voice) {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10000,
    synthesisTimeoutMs: 25000,
  });

  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
      sentenceBoundaryEnabled: false,
    });

    const { audioStream, metadataStream } = tts.toStream(text);
    const audioChunks = [];
    const metadataChunks = [];

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => fail(new Error('Edge TTS quá thời gian chờ.')), 28000);
      const succeed = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setTimeout(resolve, 120);
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      audioStream.on('data', (chunk) => audioChunks.push(Buffer.from(chunk)));
      metadataStream.on('data', (chunk) => metadataChunks.push(chunk.toString()));
      audioStream.on('end', succeed);
      audioStream.on('close', succeed);
      audioStream.on('error', fail);
      metadataStream.on('error', () => {
        // Audio can still be valid when metadata fails.
      });
    });

    const audio = Buffer.concat(audioChunks);
    if (!audio.length) throw new Error('Edge TTS trả về audio rỗng.');

    const words = parseWordBoundaries(metadataChunks);
    const lastEnd = words.length
      ? words[words.length - 1].startMs + words[words.length - 1].durationMs
      : 0;

    return {
      audioBase64: audio.toString('base64'),
      mime: 'audio/mpeg',
      words,
      durationMs: Math.max(lastEnd + 450, Math.round(audio.length / 6)),
      provider: 'edge',
    };
  } finally {
    try {
      tts.close();
    } catch {
      // ignore close errors
    }
  }
}

async function getDurationMs(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath,
    ]);
    const duration = Number(JSON.parse(stdout)?.format?.duration || 0);
    return Math.max(0, Math.round(duration * 1000));
  } catch {
    return 0;
  }
}

async function synthesizeMac(text) {
  const id = crypto.randomUUID();
  const base = path.join(os.tmpdir(), `xiaoya-tts-${id}`);
  const aiff = `${base}.aiff`;
  const mp3 = `${base}.mp3`;

  try {
    let ok = false;
    let lastError;
    for (const voice of ['Tingting', 'Flo']) {
      try {
        await execFileAsync(
          'say',
          ['-v', voice, '-r', '180', '-o', aiff, text],
          { timeout: 30000 },
        );
        ok = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!ok) throw lastError || new Error('Không tìm thấy giọng đọc tiếng Trung của macOS.');

    await execFileAsync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', aiff, '-codec:a', 'libmp3lame', '-q:a', '4', mp3],
      { timeout: 30000 },
    );

    const audio = await fs.readFile(mp3);
    const durationMs = await getDurationMs(mp3);
    return {
      audioBase64: audio.toString('base64'),
      mime: 'audio/mpeg',
      words: [],
      durationMs,
      provider: 'macos',
    };
  } finally {
    await Promise.all([
      fs.rm(aiff, { force: true }).catch(() => {}),
      fs.rm(mp3, { force: true }).catch(() => {}),
    ]);
  }
}

export async function synthesizeSpeech({ text, voice }) {
  const cleanText = sanitizeSpeechText(text);
  if (!cleanText) {
    const error = new Error('Không có nội dung để đọc.');
    error.status = 400;
    throw error;
  }

  const safeVoice = normalizeVoice(voice);
  const key = `${safeVoice}:${cleanText}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let result;
  try {
    result = await synthesizeEdge(cleanText, safeVoice);
  } catch (edgeError) {
    console.warn('[tts] Edge TTS lỗi, chuyển sang giọng macOS:', edgeError.message);
    try {
      result = await synthesizeMac(cleanText);
      result.fallbackReason = 'Edge TTS không khả dụng, đang dùng giọng macOS.';
    } catch (macError) {
      const error = new Error(
        `Không tạo được giọng đọc: ${edgeError.message} / ${macError.message}`,
      );
      error.status = 502;
      throw error;
    }
  }

  cacheSet(key, result);
  return {
    ...result,
    words: result.words.map((word) => ({ ...word })),
  };
}
