import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Nhận giọng tiếng Trung chuyên dụng chạy ngay trong tiến trình Node
// (sherpa-onnx + SenseVoice / Paraformer), giọng người học không rời máy.
// `npm run setup:stt` tải model vào models/. Không có addon hoặc model thì
// backend này tự tắt và stt.mjs dùng whisper như cũ.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = path.join(ROOT, 'models');
const require = createRequire(import.meta.url);

let addon; // undefined = chưa thử nạp, null = không có
let recognizer = null;
let kind = null; // 'sense-voice' | 'paraformer'
let modelName = '';

function loadAddon() {
  // Test chạy trên máy đã cài model thật vẫn không được nạp addon thật (giống toneModel).
  if (addon === undefined && process.env.NODE_TEST_CONTEXT) addon = null;
  if (addon === undefined) {
    try {
      addon = require('sherpa-onnx-node');
    } catch {
      addon = null;
    }
  }
  return addon;
}

/** Chỉ dùng trong test: tiêm addon giả (null = coi như chưa cài) và đặt lại trạng thái. */
export function _setAddonForTests(fake) {
  addon = fake;
  recognizer = null;
  kind = null;
  modelName = '';
}

export function sherpaKindOf(dir) {
  const name = path.basename(dir).toLowerCase();
  if (name.includes('sense-voice')) return 'sense-voice';
  if (name.includes('paraformer')) return 'paraformer';
  return null;
}

function usableDir(dir) {
  if (!dir || !fs.existsSync(path.join(dir, 'tokens.txt'))) return null;
  const kindOfDir = sherpaKindOf(dir);
  if (!kindOfDir) return null;
  const model = ['model.int8.onnx', 'model.onnx'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  return model ? { dir, kind: kindOfDir, model, tokens: path.join(dir, 'tokens.txt') } : null;
}

/** Thư mục model: STT_SHERPA_MODEL_DIR, hoặc tự dò trong models/ (SenseVoice trước, rồi Paraformer). */
export function findSherpaModel(modelsDir = MODELS, envDir = process.env.STT_SHERPA_MODEL_DIR) {
  if (envDir) return usableDir(path.resolve(envDir));
  let names = [];
  try {
    names = fs.readdirSync(modelsDir).sort();
  } catch {
    return null;
  }
  for (const prefix of ['sherpa-onnx-sense-voice-', 'sherpa-onnx-paraformer-zh-']) {
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const found = usableDir(path.join(modelsDir, name));
      if (found) return found;
    }
  }
  return null;
}

export function sherpaConfig(found) {
  const modelConfig =
    found.kind === 'sense-voice'
      ? { senseVoice: { model: found.model, language: 'zh', useInverseTextNormalization: 1 } }
      : { paraformer: { model: found.model } };
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: { ...modelConfig, tokens: found.tokens, numThreads: 4, provider: 'cpu', debug: 0 },
  };
}

export function sherpaConfigured() {
  return Boolean(loadAddon()?.OfflineRecognizer) && Boolean(findSherpaModel());
}

export function sherpaReady() {
  return recognizer !== null;
}

/** 'sense-voice' | 'paraformer' | null */
export function sherpaKind() {
  return recognizer ? kind : null;
}

export async function startSherpa() {
  if (recognizer) return true;
  const mod = loadAddon();
  const found = findSherpaModel();
  if (!mod?.OfflineRecognizer || !found) {
    console.log('[stt] sherpa-onnx chưa sẵn sàng (chạy `npm run setup:stt`); dùng whisper nếu có');
    return false;
  }
  const config = sherpaConfig(found);
  const { OfflineRecognizer } = mod;
  recognizer =
    typeof OfflineRecognizer.createAsync === 'function' ? await OfflineRecognizer.createAsync(config) : new OfflineRecognizer(config);
  kind = found.kind;
  modelName = path.basename(found.dir);
  console.log(`[stt] sherpa-onnx ${modelName} ready`);
  return true;
}

export function stopSherpa() {
  recognizer = null;
  kind = null;
  modelName = '';
}

const HAN_CLASS = '\\u3400-\\u9fff\\uf900-\\ufaff';
const BETWEEN_HAN = new RegExp(`([${HAN_CLASS}])\\s+(?=[${HAN_CLASS}])`, 'gu');

export function cleanSherpaText(text) {
  return String(text ?? '')
    .replace(/<\|[^|>]*\|>/g, '')
    .replace(BETWEEN_HAN, '$1')
    .replace(BETWEEN_HAN, '$1') // lần hai cho các chữ liền nhau xen kẽ
    .replace(/\s+/g, ' ')
    .trim();
}

export async function transcribeSherpaPcm(pcm) {
  if (!(pcm instanceof Float32Array)) throw new Error('Expected mono 16 kHz PCM.');
  if (!recognizer) throw Object.assign(new Error('Nhận dạng giọng nói cục bộ chưa sẵn sàng.'), { status: 503 });
  const stream = recognizer.createStream();
  stream.acceptWaveform({ samples: pcm, sampleRate: 16000 });
  let result;
  if (typeof recognizer.decodeAsync === 'function') {
    result = await recognizer.decodeAsync(stream);
  } else {
    recognizer.decode(stream);
    result = recognizer.getResult(stream);
  }
  if (!result || typeof result !== 'object') result = recognizer.getResult(stream);
  return {
    text: cleanSherpaText(result?.text),
    tokens: Array.isArray(result?.tokens) ? result.tokens : [],
    timestamps: Array.isArray(result?.timestamps) ? result.timestamps : [],
  };
}
