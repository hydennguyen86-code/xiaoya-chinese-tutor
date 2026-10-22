const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const LMSTUDIO_URL = (process.env.LMSTUDIO_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');

export const PROVIDER_DEFS = {
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    url: OLLAMA_URL,
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    url: LMSTUDIO_URL,
  },
};

async function fetchJson(url, timeoutMs = 1800) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function looksLikeEmbedding(name = '') {
  return /embed|bge|minilm|rerank/i.test(name);
}

function pickRecommended(models) {
  const candidates = [
    /^qwen3\.5/i,
    /^qwen3/i,
    /^qwen2\.5/i,
    /qwen/i,
    /^gemma/i,
    /^llama/i,
  ];
  for (const re of candidates) {
    const match = models.find((m) => re.test(m));
    if (match) return match;
  }
  return models[0] || '';
}

async function detectOllama() {
  try {
    const data = await fetchJson(`${OLLAMA_URL}/api/tags`);
    const models = (data.models || [])
      .map((m) => m.name || m.model)
      .filter((name) => name && !looksLikeEmbedding(name));
    return {
      ...PROVIDER_DEFS.ollama,
      online: true,
      models,
      recommendedModel: pickRecommended(models),
    };
  } catch {
    return {
      ...PROVIDER_DEFS.ollama,
      online: false,
      models: [],
      recommendedModel: '',
    };
  }
}

async function detectLmStudio() {
  try {
    const data = await fetchJson(`${LMSTUDIO_URL}/v1/models`);
    const models = (data.data || [])
      .map((m) => m.id)
      .filter((name) => name && !looksLikeEmbedding(name));
    return {
      ...PROVIDER_DEFS.lmstudio,
      online: true,
      models,
      recommendedModel: pickRecommended(models),
    };
  } catch {
    return {
      ...PROVIDER_DEFS.lmstudio,
      online: false,
      models: [],
      recommendedModel: '',
    };
  }
}

export async function detectProviders() {
  const [ollama, lmstudio] = await Promise.all([detectOllama(), detectLmStudio()]);
  return [ollama, lmstudio];
}

export function getProvider(id) {
  return PROVIDER_DEFS[id] || null;
}

export async function ensureProviderOnline(id) {
  const providers = await detectProviders();
  return providers.find((p) => p.id === id) || null;
}
