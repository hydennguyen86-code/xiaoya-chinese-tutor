import fs from 'node:fs';
import path from 'node:path';
let config = null;
let filename;
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
  };
}
export function saveRemoteSettings(raw) {
  const value = validateRemoteConfig(raw, config);
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename + '.tmp', JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(filename + '.tmp', filename);
  config = value;
  return publicRemoteSettings();
}
export function deleteRemoteSettings() {
  fs.rmSync(filename, { force: true });
  config = null;
}
export async function streamRemote({ model, messages = [], signal, onDelta, schema, maxTokens = 700, temperature = 0.7 }) {
  const settings = remoteSettings();
  if (!settings?.consent || model !== settings.model)
    throw Object.assign(new Error('Chưa cấu hình và đồng ý dùng API này, hoặc model không khớp.'), { status: 400 });
  // Prefer JSON-object mode for broad compatibility. Do not silently retry a
  // paid request or send provider response/error bodies to the browser/log.
  const res = await fetch(`${settings.url}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: `Return one JSON object matching this schema: ${JSON.stringify(schema || {})}` }, ...messages],
      stream: false,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature,
    }),
  }).catch(() => {
    throw Object.assign(new Error('Không kết nối được API đã cấu hình. Kiểm tra URL/key trên máy chủ.'), { status: 502 });
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw Object.assign(new Error(`API đã cấu hình trả HTTP ${res.status}. Kiểm tra URL/key, model, hạn mức và quyền truy cập.`), {
      status: 502,
    });
  }
  const value = await res.json().catch(() => null);
  const text = value?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw Object.assign(new Error('API không trả nội dung JSON hợp lệ.'), { status: 502 });
  onDelta(text);
  return { usage: { promptTokens: value.usage?.prompt_tokens, completionTokens: value.usage?.completion_tokens } };
}
