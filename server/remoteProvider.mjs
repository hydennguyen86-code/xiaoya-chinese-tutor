import fs from 'node:fs';
import path from 'node:path';
let config = null;
let filename;
/** last known cloud status: { state: 'ok'|'warn'|'error'|'unknown', ms, at, message } — never contains the key */
let health = null;
export function validateRemoteConfig(raw, previous = null) {
  const url = new URL(String(raw.url || ''));
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash)
    throw new Error('URL cần HTTPS, không chứa key/query; HTTP chỉ dùng với localhost.');
  const model = String(raw.model || '').trim();
  if (!/^[A-Za-z0-9_./:+-]{1,160}$/.test(model) || raw.consent !== true)
    throw new Error('Cần model và xác nhận gửi hội thoại tới dịch vụ.');
  const key = raw.apiKey === '' && previous?.url === url.href.replace(/\/$/, '') ? previous.apiKey : String(raw.apiKey || '');
  if (key.length > 2000 || /[\r\n]/.test(key)) throw new Error('API key không hợp lệ.');
  return { url: url.href.replace(/\/$/, ''), model, apiKey: key, consent: true };
}
export function initializeRemoteProvider(dataDir) {
  filename = path.join(dataDir, 'private', 'provider.json');
  config = null;
  try {
    config = validateRemoteConfig(JSON.parse(fs.readFileSync(filename, 'utf8')));
  } catch {
    /* Not configured; never log credentials. */
  }
}
export function remoteSettings() {
  return config;
}
export function publicRemoteSettings() {
  return {
    configured: Boolean(config),
    url: config?.url || '',
    model: config?.model || '',
    hasKey: Boolean(config?.apiKey),
    consent: Boolean(config?.consent),
    health: config ? health : null,
  };
}
export function saveRemoteSettings(raw) {
  const value = validateRemoteConfig(raw, config);
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename + '.tmp', JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(filename + '.tmp', filename);
  config = value;
  health = null;
  return publicRemoteSettings();
}
export function deleteRemoteSettings() {
  fs.rmSync(filename, { force: true });
  config = null;
  health = null;
}
export function remoteHealth() {
  return config ? health : null;
}

function setHealth(state, startedAt, message) {
  health = { state, ms: Date.now() - startedAt, at: Date.now(), message };
  return health;
}

/**
 * Free reachability check: GET /models costs no tokens. It confirms the URL and key and,
 * when the service lists its models, that the configured model exists.
 */
export async function pingRemote() {
  const settings = remoteSettings();
  if (!settings) return null;
  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(`${settings.url}/models`, {
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
    });
  } catch (error) {
    return setHealth(
      'error',
      startedAt,
      error?.name === 'TimeoutError' ? 'API không phản hồi trong 8 giây.' : 'Không kết nối được API (mạng, tường lửa hoặc URL sai).',
    );
  }
  if (res.status === 404 || res.status === 405) {
    await res.body?.cancel();
    return setHealth('unknown', startedAt, 'Máy chủ API phản hồi nhưng không có danh sách model; bấm “Thử trả lời 1 câu” để chắc chắn.');
  }
  if (!res.ok) return setHealth('error', startedAt, (await httpError(res, settings.apiKey)).message);
  const value = await res.json().catch(() => null);
  const ids = Array.isArray(value?.data) ? value.data.map((item) => item?.id).filter((id) => typeof id === 'string') : null;
  if (ids?.length && !ids.includes(settings.model))
    return setHealth('warn', startedAt, `Key và URL đúng, nhưng dịch vụ không có model “${settings.model}”. Kiểm tra lại mã model.`);
  return setHealth('ok', startedAt, ids?.length ? `Key hợp lệ, có model ${settings.model}.` : 'Key hợp lệ, máy chủ API đang chạy.');
}

function remoteError(message, status = 502) {
  return Object.assign(new Error(message), { status, remote: true });
}

// Cloud "thinking" models (Gemini, GPT-5…) count reasoning inside max_tokens. A cap
// that is too small returns empty content; an unused cap is not billed.
export function remoteMaxTokens(maxTokens = 700) {
  return Math.min(8192, Math.max(2048, Math.round(Number(maxTokens) || 700) * 3));
}

// What the provider said, shortened and scrubbed of anything key-like, so a failure says why
// (for example "model not available for this key") instead of only an HTTP code.
export function providerDetail(body, secret = '') {
  let text = '';
  try {
    const parsed = JSON.parse(body);
    const value = parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? parsed?.detail;
    text = typeof value === 'string' ? value : '';
  } catch {
    text = /^\s*</.test(body) ? '' : body;
  }
  if (secret.length >= 6) text = text.split(secret).join('[đã ẩn]');
  text = text
    .replace(/\b(?:sk|key|tok|vk)[-_][\w-]{8,}/gi, '[đã ẩn]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [đã ẩn]')
    .replace(/[\w-]{32,}/g, '[đã ẩn]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return text ? ` API nói: “${text}”.` : '';
}

// The provider's error body is read to classify it and to quote a short, scrubbed reason.
async function httpError(res, secret = '') {
  let body = '';
  try {
    body = (await res.text()).slice(0, 2000);
  } catch {
    /* ignore */
  }
  const s = res.status;
  if (s === 429) return remoteError(`API đang giới hạn tốc độ (HTTP 429). Đợi một chút rồi thử lại.${providerDetail(body, secret)}`);
  if (s === 402 || /insufficient|balance|credit|quota|số dư|hết tiền|top.?up/i.test(body))
    return remoteError(`API báo hết credit/hạn mức (HTTP ${s}). Nạp thêm credit cho key rồi thử lại.${providerDetail(body, secret)}`);
  if (s === 401 || s === 403) return remoteError(`API key sai, hết hạn hoặc chưa kích hoạt (HTTP ${s}).`);
  if (s === 404 || /model_not_found|model not found|no such model|unknown model/i.test(body))
    return remoteError(`Không tìm thấy model hoặc sai URL (HTTP ${s}). Mã model phải đúng như trang Models; URL kết thúc bằng /v1.${providerDetail(body, secret)}`);
  if (s >= 500) return remoteError(`Dịch vụ API đang lỗi (HTTP ${s}). Thử lại sau ít phút.${providerDetail(body, secret)}`);
  return remoteError(`API đã cấu hình trả HTTP ${s}. Kiểm tra URL/key, model, hạn mức và quyền truy cập.${providerDetail(body, secret)}`);
}

function postChat(settings, body, signal) {
  return fetch(`${settings.url}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify(body),
  }).catch((error) => {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
    throw remoteError('Không kết nối được API đã cấu hình. Kiểm tra mạng và URL/key trên máy chủ.');
  });
}

async function* sseEvents(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return null;
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const event = parse(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        if (event) yield event;
      }
    }
    const event = parse(buffer + decoder.decode());
    if (event) yield event;
  } finally {
    reader.releaseLock();
  }
}

export async function streamRemote({ model, messages = [], signal, onDelta, schema, maxTokens = 700, temperature = 0.7 }) {
  const settings = remoteSettings();
  if (!settings?.consent || model !== settings.model)
    throw Object.assign(new Error('Chưa cấu hình và đồng ý dùng API này, hoặc model không khớp.'), { status: 400 });
  const base = {
    model,
    messages: [{ role: 'system', content: `Return one JSON object matching this schema: ${JSON.stringify(schema || {})}` }, ...messages],
    max_tokens: remoteMaxTokens(maxTokens),
    temperature,
    stream: true,
  };
  // Stream so the tutor starts speaking early. HTTP 400 means the gateway rejected an
  // option before the model ran (not billed), so retry once without the extras. Never
  // retry after the model has produced output.
  const startedAt = Date.now();
  let res = await postChat(settings, { ...base, response_format: { type: 'json_object' }, stream_options: { include_usage: true } }, signal);
  if (res.status === 400) {
    await res.body?.cancel();
    res = await postChat(settings, base, signal);
  }
  if (!res.ok) {
    const error = await httpError(res, settings.apiKey);
    setHealth('error', startedAt, error.message);
    throw error;
  }

  if (!(res.headers.get('content-type') || '').includes('event-stream')) {
    const value = await res.json().catch(() => null);
    const text = value?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text) throw remoteError('API không trả nội dung JSON hợp lệ.');
    onDelta(text);
    setHealth('ok', startedAt, 'Lượt gần nhất trả lời bình thường.');
    return { usage: { promptTokens: value.usage?.prompt_tokens, completionTokens: value.usage?.completion_tokens } };
  }

  const usage = {};
  let sawToken = false;
  for await (const event of sseEvents(res)) {
    if (event.error) throw remoteError('API báo lỗi giữa chừng. Thử lại hoặc kiểm tra credit/model.');
    const choice = event.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content;
    if (typeof delta === 'string' && delta) {
      sawToken = true;
      onDelta(delta);
    }
    if (event.usage) {
      usage.promptTokens = event.usage.prompt_tokens;
      usage.completionTokens = event.usage.completion_tokens;
    }
    if (choice?.finish_reason) usage.doneReason = choice.finish_reason;
  }
  if (!sawToken) throw remoteError('API không trả nội dung (model có thể đã dùng hết token cho phần suy luận). Thử lại sau.');
  setHealth('ok', startedAt, 'Lượt gần nhất trả lời bình thường.');
  return { usage };
}

/** One tiny request to confirm URL, key, model and credit. */
export async function testRemote() {
  const settings = remoteSettings();
  if (!settings?.consent) throw Object.assign(new Error('Chưa lưu cấu hình API.'), { status: 400 });
  const startedAt = Date.now();
  const res = await postChat(
    settings,
    { model: settings.model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 1024, temperature: 0, stream: false },
    AbortSignal.timeout(60000),
  );
  if (!res.ok) {
    const error = await httpError(res, settings.apiKey);
    setHealth('error', startedAt, error.message);
    throw error;
  }
  const value = await res.json().catch(() => null);
  if (typeof value?.choices?.[0]?.message?.content !== 'string') {
    setHealth('error', startedAt, 'API có trả lời nhưng không đúng định dạng Chat Completions. Kiểm tra URL có /v1.');
    throw remoteError(health.message);
  }
  setHealth('ok', startedAt, `Model ${settings.model} đã trả lời câu thử.`);
  return { ok: true, model: settings.model, elapsedMs: Date.now() - startedAt, health };
}
