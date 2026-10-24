import { generateGecV2, EDGE_TOKEN } from './edgeGec.mjs';
import { mediaToolPath } from './mediaTools.mjs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// msedge-tts 2.1.0 implements GEC v1; keep its stream/clock-skew handling,
// replace only the public URL builder with the v2 upstream protocol.
MsEdgeTTS.getSynthUrl = async function () {
  const query = new URLSearchParams({ TrustedClientToken: EDGE_TOKEN, ConnectionId: crypto.randomUUID().replaceAll('-', ''), 'Sec-MS-GEC': generateGecV2(Date.now() + (MsEdgeTTS._clockOffsetMs || 0)), 'Sec-MS-GEC-Version': '2-143.0.3650.75' });
  return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${query}`;
};
const execFileAsync = promisify(execFile);
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
export const DEFAULT_VI_VOICE = 'vi-VN-HoaiMyNeural';

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

export const VI_TTS_VOICES = [
  {
    id: 'vi-VN-HoaiMyNeural',
    label: 'HoaiMy · tiếng Việt chuẩn, nữ',
    short: 'HoaiMy',
  },
  {
    id: 'vi-VN-NamMinhNeural',
    label: 'NamMinh · tiếng Việt, nam',
    short: 'NamMinh',
  },
];

// Voices served by the two local voice-clone services in the mandarin-teacher
// folder, which copy the reference recording. These do not need the network,
// unlike the Edge voices above. tts_service.py (Qwen3-TTS) handles Chinese;
// vitts_service.py (VieNeu-TTS) handles Vietnamese.
export const CLONE_VOICES = [
  {
    id: 'clone-zh',
    label: 'Giọng riêng · bản sao giọng nói tiếng Trung (offline)',
    short: 'Giọng riêng',
  },
  {
    id: 'clone-vi',
    label: 'Giọng riêng · bản sao giọng nói tiếng Việt (offline)',
    short: 'Giọng riêng (Việt)',
  },
];

const CLONE_SERVICES = {
  'clone-zh': {
    url: process.env.VOICE_CLONE_URL || 'http://127.0.0.1:8766',
    language: 'Chinese',
    fallbackVoice: DEFAULT_VOICE,
    hint: 'Chưa kết nối được dịch vụ clone giọng tiếng Trung (VOICE_CLONE_URL, mặc định cổng 8766). Xem docs/voice-clone.md.',
  },
  'clone-vi': {
    url: process.env.VOICE_CLONE_VI_URL || 'http://127.0.0.1:8767',
    language: 'Vietnamese',
    fallbackVoice: DEFAULT_VI_VOICE,
    hint: 'Chưa kết nối được dịch vụ clone giọng tiếng Việt (VOICE_CLONE_VI_URL, mặc định cổng 8767). Xem docs/voice-clone.md.',
  },
};

const voiceIds = new Set(
  [...TTS_VOICES, ...VI_TTS_VOICES, ...CLONE_VOICES].map((voice) => voice.id),
);

export function isCloneVoice(voice) {
  return Object.hasOwn(CLONE_SERVICES, voice);
}

export function isCloneVietnameseVoice(voice) {
  return voice === 'clone-vi';
}
const cache = new Map();
const CACHE_LIMIT = 48;

export function normalizeVoice(voice) {
  return voiceIds.has(voice) ? voice : DEFAULT_VOICE;
}

function isVietnameseVoice(voice) {
  return voice.startsWith('vi-');
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

export async function synthesizeEdge(text, voice) {
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
    const { stdout } = await execFileAsync(mediaToolPath('ffprobe'), [
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

async function synthesizeMac(text, voice = DEFAULT_VOICE) {
  const id = crypto.randomUUID();
  const base = path.join(os.tmpdir(), `xiaoya-tts-${id}`);
  const aiff = `${base}.aiff`;
  const mp3 = `${base}.mp3`;
  const vietnamese = isVietnameseVoice(voice);
  const macVoices = vietnamese ? ['Linh'] : ['Tingting', 'Flo'];

  try {
    let ok = false;
    let lastError;
    for (const macVoice of macVoices) {
      try {
        await execFileAsync(
          'say',
          ['-v', macVoice, '-r', vietnamese ? '175' : '180', '-o', aiff, text],
          { timeout: 30000 },
        );
        ok = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!ok) {
      throw (
        lastError ||
        new Error(
          vietnamese
            ? 'Không tìm thấy giọng đọc tiếng Việt của macOS (Linh).'
            : 'Không tìm thấy giọng đọc tiếng Trung của macOS.',
        )
      );
    }

    await execFileAsync(
      mediaToolPath('ffmpeg'),
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

// Duration of a PCM WAV file, used when the clone service omits the header.
function wavDurationMs(buffer) {
  try {
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return 0;
    let offset = 12;
    let byteRate = 0;
    let dataSize = 0;
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
      else if (id === 'data') {
        dataSize = size;
        break;
      }
      offset += 8 + size + (size % 2);
    }
    if (!byteRate || !dataSize) return 0;
    return Math.round((dataSize / byteRate) * 1000);
  } catch {
    return 0;
  }
}

async function synthesizeClone(text, voice) {
  const service = CLONE_SERVICES[voice];
  const res = await fetch(`${service.url}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: service.language }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error || '';
    } catch {
      // the service may answer with an empty or non-JSON body
    }
    throw new Error(detail || `Dịch vụ clone giọng trả về HTTP ${res.status}.`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (!audio.length) throw new Error('Dịch vụ clone giọng trả về audio rỗng.');

  const headerDuration = Number(res.headers.get('x-duration-ms') || 0);
  const durationMs = headerDuration > 0 ? headerDuration : wavDurationMs(audio);

  return {
    audioBase64: audio.toString('base64'),
    mime: 'audio/wav',
    // The clone service does not emit word boundaries, so the client falls back
    // to distributing visemes evenly across the clip.
    words: [],
    durationMs: Math.max(300, durationMs),
    provider: 'clone',
  };
}

// Edge TTS over the network, with the macOS `say` voice as a local fallback.
async function synthesizeEdgeOrMac(text, voice) {
  try {
    return await synthesizeEdge(text, voice);
  } catch (edgeError) {
    if (process.platform !== 'darwin') throw Object.assign(new Error('Giọng Edge tạm không khả dụng. Hãy dùng giọng trình duyệt.'), { status: 502 });
    console.warn('[tts] Edge TTS không khả dụng; dùng giọng macOS.');
    try {
      const result = await synthesizeMac(text, voice);
      result.fallbackReason = 'Edge TTS không khả dụng, đang dùng giọng macOS.';
      return result;
    } catch (macError) {
      const error = new Error(
        `Không tạo được giọng đọc: ${edgeError.message} / ${macError.message}`,
      );
      error.status = 502;
      throw error;
    }
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
  if (isCloneVoice(safeVoice)) {
    const service = CLONE_SERVICES[safeVoice];
    try {
      result = await synthesizeClone(cleanText, safeVoice);
    } catch (cloneError) {
      console.warn('[tts] clone giọng lỗi, dùng giọng Edge:', cloneError.message);
      result = await synthesizeEdgeOrMac(cleanText, service.fallbackVoice);
      result.fallbackReason = `Dịch vụ clone giọng chưa chạy, tạm dùng giọng Edge. ${service.hint}`;
    }
  } else {
    result = await synthesizeEdgeOrMac(cleanText, safeVoice);
  }

  cacheSet(key, result);
  return {
    ...result,
    words: result.words.map((word) => ({ ...word })),
  };
}
