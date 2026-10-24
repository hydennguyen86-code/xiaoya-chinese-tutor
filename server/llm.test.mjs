import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamCompletion, completeJson } from './llm.mjs';
test('LLM adapters parse Ollama NDJSON and compatible SSE, including format fallback and failures', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response('bad-json\n' + JSON.stringify({ message: { content: '{"ok":true}' }, done: true, prompt_eval_count: 2 }) + '\n');
    const local = await completeJson({ provider: 'ollama', model: 'fixture', messages: [], schema: {} });
    assert.equal(JSON.parse(local.raw).ok, true);
    assert.equal(local.usage.promptTokens, 2);
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      if (calls === 1) {
        assert.equal(body.response_format.type, 'json_schema');
        return new Response('', { status: 400 });
      }
      assert.equal(body.response_format.type, 'json_object');
      return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: '{"ok":true}' } }] }) + '\n\ndata: [DONE]\n');
    };
    const lm = await completeJson({ provider: 'lmstudio', model: 'fixture', messages: [], schema: {} });
    assert.equal(JSON.parse(lm.raw).ok, true);
    assert.equal(calls, 2);
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(() => completeJson({ provider: 'ollama', model: 'fixture', messages: [] }), /HTTP 503/);
    globalThis.fetch = async () => new Response('{"done":true}\n');
    await assert.rejects(() => completeJson({ provider: 'ollama', model: 'fixture', messages: [] }), /không trả về/);
    await assert.rejects(() => streamCompletion({ provider: 'invalid' }), /Provider/);
  } finally {
    globalThis.fetch = original;
  }
});
