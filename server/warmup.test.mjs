import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warmLocalModel } from './warmup.mjs';
test('warmup is local only, bounded, skips recently warmed models and does not cache failure', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.options.num_predict, 1);
    assert.ok(url.endsWith('/api/chat'));
    return new Response('{}');
  };
  await warmLocalModel('ollama', 'fixture', { fetcher, now: 1000000 });
  assert.ok((await warmLocalModel('ollama', 'fixture', { fetcher, now: 1000100 })).cached);
  assert.equal(calls, 1);
  await assert.rejects(warmLocalModel('remote', 'fixture', { fetcher }));
  await assert.rejects(warmLocalModel('ollama', 'bad', { fetcher: async () => new Response('', { status: 500 }) }));
});
