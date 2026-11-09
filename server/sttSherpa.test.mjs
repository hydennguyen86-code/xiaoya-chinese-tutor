import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as sherpa from './sttSherpa.mjs';

function makeModels(...names) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-sherpa-'));
  for (const name of names) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'model.int8.onnx'), 'x');
    fs.writeFileSync(path.join(dir, 'tokens.txt'), 'x');
  }
  return root;
}

function fakeAddon(text = '你 好 <|zh|> 世界', { asyncApi = true } = {}) {
  const calls = { configs: [], waves: [] };
  class OfflineRecognizer {
    constructor(config) {
      calls.configs.push(config);
    }
    static async createAsync(config) {
      return new OfflineRecognizer(config);
    }
    createStream() {
      return { acceptWaveform: (w) => calls.waves.push(w) };
    }
    decode() {}
    getResult() {
      return { text, tokens: ['你', '好'], timestamps: [0, 0.2] };
    }
  }
  if (asyncApi) OfflineRecognizer.prototype.decodeAsync = async () => ({ text, tokens: ['你', '好'], timestamps: [0, 0.2] });
  if (!asyncApi) delete OfflineRecognizer.createAsync;
  return { addon: { OfflineRecognizer }, calls };
}

test('chọn model theo tên thư mục: SenseVoice trước, Paraformer sau, env ghi đè', () => {
  const both = makeModels('sherpa-onnx-paraformer-zh-2024-03-09', 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17');
  assert.equal(sherpa.findSherpaModel(both, '').kind, 'sense-voice');
  const para = makeModels('sherpa-onnx-paraformer-zh-2024-03-09');
  assert.equal(sherpa.findSherpaModel(para, '').kind, 'paraformer');
  assert.equal(sherpa.findSherpaModel(makeModels('other'), ''), null);
  assert.equal(sherpa.findSherpaModel(path.join(both, 'nope'), ''), null);
  const forced = sherpa.findSherpaModel(both, path.join(both, 'sherpa-onnx-paraformer-zh-2024-03-09'));
  assert.equal(forced.kind, 'paraformer');
});

test('cấu hình sherpa đúng dạng cho SenseVoice và Paraformer', () => {
  const root = makeModels('sherpa-onnx-sense-voice-x', 'sherpa-onnx-paraformer-zh-x');
  const sense = sherpa.sherpaConfig(sherpa.findSherpaModel(root, path.join(root, 'sherpa-onnx-sense-voice-x')));
  assert.deepEqual(sense.modelConfig.senseVoice, {
    model: path.join(root, 'sherpa-onnx-sense-voice-x', 'model.int8.onnx'),
    language: 'zh',
    useInverseTextNormalization: 0,
  });
  assert.equal(sense.modelConfig.numThreads, 4);
  assert.deepEqual(sense.featConfig, { sampleRate: 16000, featureDim: 80 });
  const para = sherpa.sherpaConfig(sherpa.findSherpaModel(root, path.join(root, 'sherpa-onnx-paraformer-zh-x')));
  assert.ok(para.modelConfig.paraformer.model.endsWith('model.int8.onnx'));
  assert.equal(para.modelConfig.senseVoice, undefined);
});

test('làm sạch văn bản', () => {
  assert.equal(sherpa.cleanSherpaText('<|zh|><|NEUTRAL|> 你 好 ， hello world 。'), '你好 ， hello world 。');
  assert.equal(sherpa.cleanSherpaText('  我 是 学 生  '), '我是学生');
  assert.equal(sherpa.cleanSherpaText(undefined), '');
});

test('nhận dạng qua addon giả (async và sync)', async () => {
  const root = makeModels('sherpa-onnx-sense-voice-x');
  const prev = process.env.STT_SHERPA_MODEL_DIR;
  process.env.STT_SHERPA_MODEL_DIR = path.join(root, 'sherpa-onnx-sense-voice-x');
  try {
    sherpa._setAddonForTests(null);
    assert.equal(sherpa.sherpaConfigured(), false);
    assert.equal(await sherpa.startSherpa(), false);
    await assert.rejects(() => sherpa.transcribeSherpaPcm(new Float32Array(10)), /chưa sẵn sàng/);

    for (const asyncApi of [true, false]) {
      const { addon, calls } = fakeAddon('你 好 <|zh|> 世界', { asyncApi });
      sherpa._setAddonForTests(addon);
      assert.equal(sherpa.sherpaConfigured(), true);
      assert.equal(await sherpa.startSherpa(), true);
      assert.equal(sherpa.sherpaKind(), 'sense-voice');
      const pcm = new Float32Array(160);
      const out = await sherpa.transcribeSherpaPcm(pcm);
      assert.equal(out.text, '你好世界');
      assert.deepEqual(out.tokens, ['你', '好']);
      assert.equal(calls.waves[0].sampleRate, 16000);
      assert.equal(calls.waves[0].samples, pcm);
      assert.equal(calls.configs.length, 1);
    }
    sherpa.stopSherpa();
    assert.equal(sherpa.sherpaReady(), false);
  } finally {
    sherpa._setAddonForTests(undefined);
    if (prev === undefined) delete process.env.STT_SHERPA_MODEL_DIR;
    else process.env.STT_SHERPA_MODEL_DIR = prev;
  }
});

test('stt.mjs chọn backend theo STT_BACKEND', async () => {
  const root = makeModels('sherpa-onnx-paraformer-zh-x');
  const keep = { b: process.env.STT_BACKEND, d: process.env.STT_SHERPA_MODEL_DIR, w: process.env.WHISPER_BIN };
  process.env.STT_SHERPA_MODEL_DIR = path.join(root, 'sherpa-onnx-paraformer-zh-x');
  process.env.WHISPER_BIN = path.join(root, 'no-whisper');
  const stt = await import(`./stt.mjs?dispatch=${Date.now()}`);
  const { addon } = fakeAddon('你 好');
  try {
    sherpa._setAddonForTests(addon);
    process.env.STT_BACKEND = 'off';
    await stt.startStt();
    assert.equal(stt.sttReady(), false);
    assert.equal(stt.sttBackend(), null);

    process.env.STT_BACKEND = 'whisper'; // whisper không cấu hình -> không backend nào
    await stt.startStt();
    assert.equal(stt.sttBackend(), null);

    process.env.STT_BACKEND = 'auto';
    await stt.startStt();
    assert.equal(stt.sttBackend(), 'sherpa:paraformer');
    assert.equal(stt.sttReady(), true);
    assert.equal(await stt.transcribePcm(new Float32Array(160)), '你好');
    stt.stopStt();
    assert.equal(stt.sttBackend(), null);

    sherpa._setAddonForTests(null); // không có addon -> auto rơi về whisper (không có) -> null
    process.env.STT_BACKEND = 'auto';
    await stt.startStt();
    assert.equal(stt.sttBackend(), null);
  } finally {
    stt.stopStt();
    sherpa._setAddonForTests(undefined);
    for (const [key, name] of [
      ['b', 'STT_BACKEND'],
      ['d', 'STT_SHERPA_MODEL_DIR'],
      ['w', 'WHISPER_BIN'],
    ]) {
      if (keep[key] === undefined) delete process.env[name];
      else process.env[name] = keep[key];
    }
  }
});
