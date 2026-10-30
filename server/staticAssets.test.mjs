import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import express from 'express';
import { staticAssets } from './staticAssets.mjs';

const BIG_JS = `console.log("${'xiaoya '.repeat(900)}");`;

async function withServer(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoya-static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbCd1234.js'), BIG_JS);
  fs.writeFileSync(path.join(dir, 'tiny.js'), 'a=1');
  fs.writeFileSync(path.join(dir, 'photo.png'), Buffer.alloc(4096, 7));
  fs.writeFileSync(path.join(dir, 'model.glb'), Buffer.alloc(8192, 1));
  const app = express();
  app.use(staticAssets(dir));
  app.use((_req, res) => res.status(404).end('nope'));
  const server = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const get = (url, headers = {}) => fetch(url, { headers: { 'accept-encoding': 'identity', ...headers } });

// fetch() transparently decodes gzip, so read the raw bytes through http instead
function raw(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

test('gzips text assets when the browser accepts it', async () => {
  await withServer(async (base) => {
    const res = await raw(`${base}/assets/index-AbCd1234.js`, { 'accept-encoding': 'gzip, br' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'gzip');
    assert.match(res.headers['content-type'], /javascript/);
    assert.match(res.headers.vary, /Accept-Encoding/i);
    assert.equal(zlib.gunzipSync(res.body).toString(), BIG_JS);
    assert.ok(res.body.length < BIG_JS.length / 3);
  });
});

test('hashed bundles are cached for a year, other files for an hour', async () => {
  await withServer(async (base) => {
    const hashed = await raw(`${base}/assets/index-AbCd1234.js`, { 'accept-encoding': 'gzip' });
    assert.match(hashed.headers['cache-control'], /max-age=31536000.*immutable/);
    const png = await raw(`${base}/photo.png`, { 'accept-encoding': 'gzip' });
    assert.equal(png.headers['cache-control'], 'public, max-age=3600');
    const plainHashed = await get(`${base}/assets/index-AbCd1234.js`);
    assert.match(plainHashed.headers.get('cache-control'), /immutable/);
  });
});

test('leaves images, tiny files and non-gzip clients alone', async () => {
  await withServer(async (base) => {
    const png = await raw(`${base}/photo.png`, { 'accept-encoding': 'gzip' });
    assert.equal(png.headers['content-encoding'], undefined);
    const tiny = await raw(`${base}/tiny.js`, { 'accept-encoding': 'gzip' });
    assert.equal(tiny.headers['content-encoding'], undefined);
    const plain = await raw(`${base}/assets/index-AbCd1234.js`, { 'accept-encoding': 'identity' });
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal(plain.body.toString(), BIG_JS);
  });
});

test('answers a repeat request with 304 and compresses 3D models', async () => {
  await withServer(async (base) => {
    const first = await raw(`${base}/model.glb`, { 'accept-encoding': 'gzip' });
    assert.equal(first.headers['content-encoding'], 'gzip');
    const again = await raw(`${base}/model.glb`, {
      'accept-encoding': 'gzip',
      'if-none-match': first.headers.etag,
    });
    assert.equal(again.status, 304);
  });
});

test('range requests and path tricks fall back to the plain handler', async () => {
  await withServer(async (base) => {
    const ranged = await raw(`${base}/model.glb`, { 'accept-encoding': 'gzip', range: 'bytes=0-9' });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers['content-encoding'], undefined);
    const up = await raw(`${base}/..%2f..%2fetc%2fpasswd`, { 'accept-encoding': 'gzip' });
    assert.notEqual(up.status, 200);
    const missing = await raw(`${base}/assets/missing-AbCd1234.js`, { 'accept-encoding': 'gzip' });
    assert.equal(missing.status, 404);
  });
});
