import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { MsEdgeTTS } from 'msedge-tts';
import { synthesizeEdge, synthesizeSpeech, sanitizeSpeechText } from './tts.mjs';
test('TTS adapter collects audio/word boundaries, closes failed streams, rejects empty input', async () => {
  const proto = MsEdgeTTS.prototype;
  const old = { setMetadata: proto.setMetadata, toStream: proto.toStream, close: proto.close };
  let closed = 0,
    empty = false;
  try {
    proto.setMetadata = async () => {};
    proto.close = () => {
      closed++;
    };
    proto.toStream = () => {
      const audioStream = new PassThrough(),
        metadataStream = new PassThrough();
      queueMicrotask(() => {
        metadataStream.end(
          JSON.stringify({ Metadata: [{ Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 2000000, text: { Text: '你好' } } }] }),
        );
        audioStream.end(empty ? Buffer.alloc(0) : Buffer.alloc(1200, 1));
      });
      return { audioStream, metadataStream };
    };
    const result = await synthesizeEdge('你好', 'zh-CN-XiaoxiaoNeural');
    assert.equal(result.provider, 'edge');
    assert.equal(result.words[0].startMs, 100);
    assert.equal(result.words[0].durationMs, 200);
    assert.equal(closed, 1);
    empty = true;
    await assert.rejects(() => synthesizeEdge('你好', 'zh-CN-XiaoxiaoNeural'), /rỗng/);
    assert.equal(closed, 2);
    await assert.rejects(() => synthesizeSpeech({ text: '', voice: '' }), /Không có nội dung/);
    assert.equal(sanitizeSpeechText('你好 <script> 😀'), '你好 script');
  } finally {
    Object.assign(proto, old);
  }
});
