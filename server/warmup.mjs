import { PROVIDER_DEFS } from './providers.mjs';
const warmed = new Map();
export async function warmLocalModel(provider, model, { fetcher = fetch, now = Date.now() } = {}) {
  if (!['ollama', 'lmstudio'].includes(provider) || typeof model !== 'string' || !model.trim() || model.length > 200)
    throw Error('Invalid local model');
  const key = `${provider}:${model}`;
  if (warmed.get(key) > now - 600000) return { warmed: true, cached: true };
  const ollama = provider === 'ollama',
    base = PROVIDER_DEFS[provider].url;
  const response = await fetcher(`${base}${ollama ? '/api/chat' : '/v1/chat/completions'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify(
      ollama
        ? { model, messages: [], stream: false, keep_alive: '2h', options: { num_predict: 1 } }
        : { model, messages: [{ role: 'user', content: '你好' }], stream: false, max_tokens: 1, temperature: 0 },
    ),
  });
  if (!response.ok) throw Error('Local warmup unavailable');
  await response.arrayBuffer();
  warmed.set(key, now);
  if (warmed.size > 8) warmed.delete(warmed.keys().next().value);
  return { warmed: true, cached: false };
}
