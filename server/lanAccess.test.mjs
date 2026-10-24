import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLanAccess, lanAddresses } from './lanAccess.mjs';
function response() {
  return {
    code: 200,
    headers: {},
    status(n) {
      this.code = n;
      return this;
    },
    sendStatus(n) {
      this.code = n;
      return this;
    },
    json(value) {
      this.value = value;
      return this;
    },
    send(value) {
      this.value = value;
      return this;
    },
    type(value) {
      this.mime = value;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
  };
}
test('LAN requires TLS/PIN for remote data, rejects cross-origin and rebinding, rate-limits attempts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-lan-test-'));
  try {
    const lan = await createLanAccess({ host: '0.0.0.0', port: 8791, dataDir: dir, env: { XIAOYA_LAN_PIN: '123456' } });
    assert.ok(new crypto.X509Certificate(lan.tls.cert).checkIP('127.0.0.1'));
    const request = { socket: { remoteAddress: '192.168.1.80' }, headers: { host: 'localhost:8791' }, path: '/api/store', method: 'GET' };
    let next = false;
    const denied = response();
    lan.guard(request, denied, () => {
      next = true;
    });
    assert.equal(denied.code, 401);
    assert.equal(next, false);
    const local = { ...request, socket: { remoteAddress: '127.0.0.1' } };
    const evil = response();
    lan.guard({ ...local, headers: { host: 'evil.example:8791' } }, evil, () => assert.fail('Rebinding allowed'));
    assert.equal(evil.code, 403);
    const crossOrigin = response();
    lan.guard({ ...local, headers: { host: 'localhost:8791', origin: 'https://evil.example' } }, crossOrigin, () =>
      assert.fail('CSRF allowed'),
    );
    assert.equal(crossOrigin.code, 403);
    const login = response();
    lan.login({ ...request, body: { pin: '123456' } }, login);
    const cookie = login.headers['Set-Cookie'];
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    const allowed = response();
    lan.guard({ ...request, headers: { ...request.headers, cookie: cookie.split(';')[0] } }, allowed, () => {
      next = true;
    });
    assert.equal(next, true);
    const privateInfo = response();
    lan.info(request, privateInfo);
    assert.equal(privateInfo.code, 403);
    const ownerInfo = response();
    lan.info(local, ownerInfo);
    assert.equal(ownerInfo.value.pin, '123456');
    assert.equal(JSON.stringify(ownerInfo.value).includes('PRIVATE KEY'), false);
    for (let i = 0; i < 8; i++) {
      const invalid = response();
      lan.login({ ...request, body: { pin: '中文字中文字' } }, invalid);
      assert.equal(invalid.code, 401);
    }
    const limited = response();
    lan.login({ ...request, body: { pin: '123456' } }, limited);
    assert.equal(limited.code, 429);
    await assert.rejects(() => createLanAccess({ host: '192.168.1.2', port: 8791, dataDir: dir }), /HOST/);
    const selected = lanAddresses({
      fixture: [
        { internal: false, family: 'IPv4', address: '192.168.1.10' },
        { internal: false, family: 'IPv4', address: '8.8.8.8' },
      ],
    });
    assert.deepEqual(selected, ['192.168.1.10']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
