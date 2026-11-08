import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Client for tone/tone_service.py: a per-syllable tone classifier (Mandarin
// wav2vec2 + pitch contour, trained in tone/train.py). The service is optional.
// When it is not running, tones.mjs keeps its rule-based pitch-shape checker.
// Like whisper.cpp, the service is started with the server when its Python
// environment and trained weights exist; TONE_MODEL_URL=off disables it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = process.env.TONE_MODEL_URL || 'http://127.0.0.1:8768';
// Unit tests never consult a service that happens to be running on this machine.
const DISABLED = URL_BASE === 'off' || Boolean(process.env.NODE_TEST_CONTEXT);
const PYTHON =
  process.env.TONE_PYTHON ||
  path.join(ROOT, '.venv-tone', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
const SERVICE = path.join(ROOT, 'tone', 'tone_service.py');
const WEIGHTS = process.env.TONE_WEIGHTS || path.join(ROOT, 'tone', 'weights', 'tone-mlp.pt');
/** below this probability the model's verdict is reported as "not judged" */
export const MIN_CONFIDENCE = Number(process.env.TONE_MIN_CONFIDENCE || 0.6);
/** a confident model verdict overrides the rule checker when the two disagree */
export const OVERRIDE_CONFIDENCE = Number(process.env.TONE_OVERRIDE_CONFIDENCE || 0.8);

let child = null;
let health = null;
let checkedAt = 0;

export function toneModelConfigured() {
  return !DISABLED && fs.existsSync(PYTHON) && fs.existsSync(SERVICE) && fs.existsSync(WEIGHTS);
}

async function probe() {
  try {
    const res = await fetch(`${URL_BASE}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

/** cached /health (15 s); null when the service is not reachable */
export async function toneModelHealth(force = false) {
  if (DISABLED) return null;
  if (!force && Date.now() - checkedAt < 15000) return health;
  health = await probe();
  checkedAt = Date.now();
  return health;
}

export function toneModelReady() {
  return Boolean(health) && Date.now() - checkedAt < 60000;
}

export async function startToneModel() {
  if (DISABLED) return;
  if (await toneModelHealth(true)) {
    console.log(`[tone] model service already running on ${URL_BASE}`);
    return;
  }
  if (!toneModelConfigured()) {
    console.log('[tone] model service not set up (see tone/README.md); the pitch-shape rules are used');
    return;
  }
  child = spawn(PYTHON, ['-I', SERVICE], {
    env: { ...process.env, TONE_PORT: String(new URL(URL_BASE).port || 8768) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.env.TONE_LOG && process.stdout.write(d));
  child.stderr.on('data', (d) => {
    const text = String(d);
    if (/Error|Traceback|SystemExit|Chưa có/.test(text)) process.stderr.write(`[tone] ${text}`);
  });
  child.on('error', () => {
    child = null;
    console.error('[tone] Không chạy được tone_service.py; kiểm tra TONE_PYTHON.');
  });
  child.on('exit', (code) => {
    child = null;
    health = null;
    if (code) console.error(`[tone] tone_service.py exited with code ${code}`);
  });
  // the backbone takes a while to load the first time (it is downloaded on first use)
  for (let i = 0; i < 240 && child; i += 1) {
    if (await toneModelHealth(true)) {
      console.log(`[tone] model service ready on ${URL_BASE} (${health.backbone} L${health.layer}, ${health.device})`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function stopToneModel() {
  child?.kill();
  child = null;
  health = null;
}

/**
 * Per-syllable tone probabilities for 16 kHz float PCM and syllable boundaries
 * (seconds). Returns null when the service is unavailable or fails, so the
 * caller falls back to the rules.
 */
export async function scoreWithModel(pcm, segments) {
  if (DISABLED || !segments?.length) return null;
  if (!toneModelReady() && !(await toneModelHealth())) return null;
  try {
    const res = await fetch(`${URL_BASE}/score`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pcm: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64'),
        segments: segments.map((s) => ({ start: s.start, end: s.end, pos: s.pos })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.syllables) || data.syllables.length !== segments.length) return null;
    return data.syllables.map((s) => ({ tone: Number(s.tone) || 0, confidence: Number(s.confidence) || 0, probs: s.probs }));
  } catch {
    return null;
  }
}

/**
 * Combine the model's verdict with the rule checker's for one syllable.
 * `expected` 1–4 (0 = neutral/unknown); `model` { tone, confidence } or null;
 * `rule` 0–4 (0 = unclear) or null when the rules were not run.
 * Returns { heard, ok, confidence, method }: ok is true/false, or null when
 * the evidence does not support a verdict.
 */
export function mergeVerdict(expected, model, rule, { minConfidence = MIN_CONFIDENCE, overrideConfidence = OVERRIDE_CONFIDENCE } = {}) {
  if (!model) {
    const heard = rule ?? 0;
    return { heard, ok: expected && heard ? heard === expected : null, confidence: null, method: 'rules' };
  }
  const heard = model.tone;
  const confidence = model.confidence;
  // not a tone the classifier knows (1–4, 5 = neutral): no evidence either way
  if (!Number.isInteger(heard) || heard < 1 || heard > 5) return { heard: 0, ok: null, confidence: null, method: 'model' };
  if (!expected) {
    // a neutral syllable: agree when the model also hears a light tone, otherwise stay silent
    return { heard, ok: heard === 5 ? true : null, confidence, method: 'model' };
  }
  if (heard === expected) return { heard, ok: true, confidence, method: rule === expected ? 'model+rules' : 'model' };
  if (rule === expected && confidence < overrideConfidence) return { heard: expected, ok: true, confidence, method: 'rules>model' };
  if (confidence < minConfidence) return { heard, ok: null, confidence, method: 'model' };
  if (rule && rule !== heard && rule !== expected && confidence < overrideConfidence)
    return { heard, ok: null, confidence, method: 'model≠rules' };
  return { heard, ok: false, confidence, method: rule === heard ? 'model+rules' : 'model' };
}
