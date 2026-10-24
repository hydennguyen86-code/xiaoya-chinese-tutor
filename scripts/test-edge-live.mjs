// Deliberately outside npm test/CI. Synthetic text only; no fallback allowed.
import assert from 'node:assert/strict';
import { synthesizeEdge } from '../server/tts.mjs';
const started = Date.now();
const result = await synthesizeEdge('你好，这是米苏的语音测试。', 'zh-CN-XiaoxiaoNeural');
assert.equal(result.provider, 'edge');
assert.ok(Buffer.from(result.audioBase64, 'base64').length > 1000);
console.log(
  JSON.stringify({
    provider: result.provider,
    bytes: Buffer.from(result.audioBase64, 'base64').length,
    words: result.words.length,
    elapsedMs: Date.now() - started,
  }),
);
