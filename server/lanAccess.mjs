import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import selfsigned from 'selfsigned';

export const ownerRequest = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const privateV4 = (ip) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip);
export function lanAddresses(interfaces = os.networkInterfaces()) {
  return [
    ...new Set(
      Object.values(interfaces)
        .flat()
        .filter((entry) => entry && !entry.internal && entry.family === 'IPv4' && privateV4(entry.address))
        .map((entry) => entry.address),
    ),
  ];
}
const loginPage = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Misu · PIN Wi-Fi</title><style>body{font:16px system-ui;max-width:420px;margin:10vh auto;padding:20px;background:#fffaf4}input,button{font:inherit;padding:12px;width:100%;box-sizing:border-box;margin:8px 0}</style><h1>Mở Misu trên Wi-Fi</h1><p>Nhập PIN từ Cài đặt trên máy chủ. Thiết bị được cấp quyền sẽ xem và sửa dữ liệu học được chia sẻ trên máy đó.</p><form><label>PIN<input name="pin" inputmode="numeric" autocomplete="off" type="password" required maxlength="10"></label><button>Mở app</button><p role="status" id="status"></p></form><script>document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/lan/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:e.target.pin.value})});if(r.ok)location.href='/';else document.getElementById('status').textContent='PIN sai hoặc đã thử quá nhiều lần. Kiểm tra lại trên máy chủ.';});</script></html>`;
export async function createLanAccess({ host, port, dataDir, env = process.env }) {
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(host)) throw new Error('HOST chỉ hỗ trợ loopback hoặc 0.0.0.0 (HTTPS + PIN).');
  const enabled = host === '0.0.0.0';
  const addresses = enabled ? lanAddresses() : [];
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...addresses]);
  const sessions = new Map(),
    attempts = new Map();
  const pin = env.XIAOYA_LAN_PIN || String(crypto.randomInt(100000, 1000000));
  if (enabled && !/^\d{6,10}$/.test(pin)) throw new Error('XIAOYA_LAN_PIN cần 6–10 chữ số.');
  let tls;
  if (enabled) {
    if (Boolean(env.XIAOYA_TLS_CERT) !== Boolean(env.XIAOYA_TLS_KEY)) throw new Error('Cần cả XIAOYA_TLS_CERT và XIAOYA_TLS_KEY.');
    if (env.XIAOYA_TLS_CERT) {
      tls = { cert: fs.readFileSync(env.XIAOYA_TLS_CERT, 'utf8'), key: fs.readFileSync(env.XIAOYA_TLS_KEY, 'utf8') };
      const parsed = new crypto.X509Certificate(tls.cert);
      if (Date.parse(parsed.validTo) <= Date.now() || addresses.some((ip) => !parsed.checkIP(ip)))
        throw new Error('Chứng chỉ tuỳ chỉnh hết hạn hoặc thiếu IP trong SAN.');
    }
    const dir = path.join(dataDir, 'private');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const keyPath = path.join(dir, 'lan-key.pem'),
      certPath = path.join(dir, 'lan-cert.pem');
    if (!tls)
      try {
        const cert = fs.readFileSync(certPath, 'utf8');
        const parsed = new crypto.X509Certificate(cert);
        if (Date.parse(parsed.validTo) < Date.now() + 86400000 || addresses.some((ip) => !parsed.checkIP(ip))) throw new Error();
        tls = { key: fs.readFileSync(keyPath, 'utf8'), cert };
      } catch {
        const generated = await selfsigned.generate([{ name: 'commonName', value: 'Misu local Wi-Fi' }], {
          keySize: 2048,
          algorithm: 'sha256',
          notAfterDate: new Date(Date.now() + 90 * 86400000),
          extensions: [
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
            { name: 'extKeyUsage', serverAuth: true },
            {
              name: 'subjectAltName',
              altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, ...addresses.map((ip) => ({ type: 7, ip }))],
            },
          ],
        });
        tls = { key: generated.private, cert: generated.cert };
        fs.writeFileSync(keyPath, tls.key, { mode: 0o600 });
        fs.writeFileSync(certPath, tls.cert, { mode: 0o600 });
      }
  }
  function guard(req, res, next) {
    let hostname;
    try {
      hostname = new URL(`http://${req.headers.host}`).hostname;
    } catch {
      return res.sendStatus(403);
    }
    if (!allowedHosts.has(hostname)) return res.sendStatus(403);
    const origin = req.headers.origin;
    const developmentOrigin = !enabled && ownerRequest(req) && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin);
    if (origin && origin !== `${enabled ? 'https' : 'http'}://${req.headers.host}` && !developmentOrigin) return res.sendStatus(403);
    res.set('Cache-Control', 'no-store');
    if (!enabled || ownerRequest(req)) return next();
    if (req.path === '/api/lan/login' && req.method === 'POST') return next();
    const token = String(req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('misu_lan='))
      ?.slice(9);
    const expires = token && sessions.get(token);
    if (expires && expires > Date.now()) return next();
    if (token) sessions.delete(token);
    if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.type('html').send(loginPage);
    return res.status(401).json({ error: 'Cần PIN Wi-Fi. Mở trang chủ để đăng nhập.' });
  }
  function login(req, res) {
    if (!enabled) return res.sendStatus(404);
    const now = Date.now(),
      ip = req.socket.remoteAddress;
    for (const [address, entry] of attempts) if (entry.until <= now) attempts.delete(address);
    let entry = attempts.get(ip);
    if (entry?.count >= 8) return res.status(429).json({ error: 'Thử lại sau 10 phút.' });
    const candidate = String(req.body?.pin || '');
    if (
      !/^\d{6,10}$/.test(candidate) ||
      candidate.length !== pin.length ||
      !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(pin))
    ) {
      entry ||= { count: 0, until: now + 600000 };
      entry.count++;
      attempts.set(ip, entry);
      return res.sendStatus(401);
    }
    for (const [token, expires] of sessions) if (expires <= now) sessions.delete(token);
    if (sessions.size >= 100) return res.sendStatus(429);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, now + 12 * 3600000);
    attempts.delete(ip);
    res.setHeader('Set-Cookie', `misu_lan=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
    return res.json({ ok: true });
  }
  function info(req, res) {
    if (!ownerRequest(req)) return res.sendStatus(403);
    res.json({
      enabled,
      urls: addresses.map((ip) => `https://${ip}:${port}`),
      ...(enabled ? { pin, fingerprint: new crypto.X509Certificate(tls.cert).fingerprint256 } : {}),
    });
  }
  return { enabled, tls, guard, login, info };
}
