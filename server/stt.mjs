import { fileURLToPath } from 'node:url';
import { mediaToolEnv } from './mediaTools.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Local speech-to-text with whisper.cpp's server (Metal GPU on Apple Silicon),
// so the learner's voice never leaves this computer. `npm run setup:whisper`
// builds it into vendor/ and downloads the model into models/; WHISPER_BIN /
// WHISPER_MODEL point to a build elsewhere.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const firstExisting = (...candidates) => candidates.find((file) => fs.existsSync(file)) || candidates[0];
const BIN =
  process.env.WHISPER_BIN ||
  firstExisting(
    path.join(ROOT, 'vendor', 'whisper-windows', 'whisper-server.exe'),
    path.join(ROOT, 'vendor', 'whisper.cpp', 'build', 'bin', process.platform === 'win32' ? 'whisper-server.exe' : 'whisper-server'),
    path.join(ROOT, 'vendor', 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-server.exe'),
  );
const MODEL = process.env.WHISPER_MODEL || path.join(ROOT, 'models', 'ggml-small.bin');
const PORT = Number(process.env.WHISPER_PORT || 8178);
const URL_BASE = `http://127.0.0.1:${PORT}`;
const PROMPT = '以下是普通话的简体中文句子。';

let child = null;
let ready = false;

export function sttConfigured() {
  return fs.existsSync(BIN) && fs.existsSync(MODEL);
}

export function sttReady() {
  return ready;
}

async function probe() {
  try {
    const res = await fetch(URL_BASE, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startStt() {
  if (!sttConfigured()) {
    console.log('[stt] whisper.cpp not found (run `npm run setup:whisper`); the browser speech API is used instead');
    return;
  }
  if (await probe()) {
    ready = true; // already running (e.g. left over from a previous server)
    return;
  }
  child = spawn(BIN, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '-l', 'zh', '-t', '4', '--convert'], {
    env: mediaToolEnv(),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.on('error', () => {
    ready = false;
    child = null;
    console.error('[stt] Không chạy được whisper-server; kiểm tra WHISPER_BIN và quyền thực thi.');
  });
  child.stderr.on('data', () => {}); // whisper logs a lot; keep the pipe drained
  child.on('exit', (code) => {
    ready = false;
    child = null;
    if (code) console.error(`[stt] whisper-server exited with code ${code}`);
  });
  for (let i = 0; i < 60 && child; i += 1) {
    if (await probe()) {
      ready = true;
      console.log(`[stt] whisper.cpp ready on ${URL_BASE}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export function stopStt() {
  child?.kill();
  child = null;
  ready = false;
}

async function inference(audio, mimeType, format) {
  if (!ready) throw Object.assign(new Error('Nhận dạng giọng nói cục bộ chưa sẵn sàng.'), { status: 503 });
  const ext = /mp4|m4a|aac/.test(mimeType)
    ? 'm4a'
    : /wav/.test(mimeType)
      ? 'wav'
      : /ogg/.test(mimeType)
        ? 'ogg'
        : /mpeg|mp3/.test(mimeType)
          ? 'mp3'
          : 'webm';
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `speech.${ext}`);
  form.append('response_format', format);
  form.append('language', 'zh');
  form.append('temperature', '0');
  form.append('prompt', PROMPT);
  const res = await fetch(`${URL_BASE}/inference`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Object.assign(new Error(`whisper-server HTTP ${res.status}`), { status: 502 });
  return res.json();
}

export async function transcribe(audio, mimeType = 'audio/webm') {
  const data = await inference(audio, mimeType, 'json');
  return String(data?.text ?? '').trim();
}

// Whisper receives standard PCM WAV, so compressed input is decoded once by the caller.
export function pcmWav(pcm) {
  if (!(pcm instanceof Float32Array)) throw new Error('Expected mono 16 kHz PCM.');
  const out = Buffer.alloc(44 + pcm.length * 2);
  out.write('RIFF');
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24);
  out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((v, i) => out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return out;
}
export function transcribePcm(pcm) {
  return transcribe(pcmWav(pcm), 'audio/wav');
}
