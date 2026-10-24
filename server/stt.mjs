import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Local speech-to-text with whisper.cpp's server (Metal GPU on Apple Silicon),
// so the learner's voice never leaves this computer. Defaults reuse the build
// and model already present in the sibling AI-Chinese-Teacher folder.
const SIBLING = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'AI-Chinese-Teacher');
const BIN = process.env.WHISPER_BIN || path.join(SIBLING, 'whisper.cpp', 'build', 'bin', 'whisper-server');
const MODEL = process.env.WHISPER_MODEL || path.join(SIBLING, 'models', 'ggml-small.bin');
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
    console.log('[stt] whisper.cpp not found; the browser speech API is used instead');
    return;
  }
  if (await probe()) {
    ready = true; // already running (e.g. left over from a previous server)
    return;
  }
  // ffmpeg (for --convert) lives in ~/.local/bin on this machine
  const PATH = [path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', process.env.PATH].join(':');
  child = spawn(BIN, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '-l', 'zh', '-t', '4', '--convert'], {
    env: { ...process.env, PATH },
    stdio: ['ignore', 'ignore', 'pipe'],
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

export async function transcribe(audio, mimeType = 'audio/webm') {
  if (!ready) throw Object.assign(new Error('Nhận dạng giọng nói cục bộ chưa sẵn sàng.'), { status: 503 });
  const ext = /mp4|m4a|aac/.test(mimeType) ? 'm4a' : /wav/.test(mimeType) ? 'wav' : /ogg/.test(mimeType) ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `speech.${ext}`);
  form.append('response_format', 'json');
  form.append('language', 'zh');
  form.append('temperature', '0');
  form.append('prompt', PROMPT);
  const res = await fetch(`${URL_BASE}/inference`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Object.assign(new Error(`whisper-server HTTP ${res.status}`), { status: 502 });
  const data = await res.json();
  return String(data?.text ?? '').trim();
}
