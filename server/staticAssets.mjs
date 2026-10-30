import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import express from 'express';

const gzip = promisify(zlib.gzip);

// Text-like formats shrink a lot; PNG, JPEG, MP3 and ZIP are already compressed.
const COMPRESSIBLE = new Set([
  '.js', '.mjs', '.css', '.html', '.json', '.svg', '.glb', '.wasm', '.txt', '.map',
]);
const MIN_BYTES = 1024;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
// Vite names built files `name-<8 char hash>.ext`, so their content never changes under one name.
const HASHED_ASSET = /^\/assets\/[^/]+-[\w-]{8}\.\w+$/;
const IMMUTABLE = 'public, max-age=31536000, immutable';

function cacheControl(urlPath, maxAge) {
  return HASHED_ASSET.test(urlPath) ? IMMUTABLE : `public, max-age=${maxAge}`;
}

/**
 * Serves the built app: gzip for text-like files (compressed once, then kept in memory) and a
 * one-year cache for hashed bundles. Everything else falls through to express.static.
 * The /api routes never pass through here, so streamed chat replies stay untouched.
 */
export function staticAssets(root, { maxAgeSeconds = 3600 } = {}) {
  const base = path.resolve(root);
  const compressed = new Map(); // file -> { mtimeMs, size, body, bytes }
  let cachedBytes = 0;

  const plain = express.static(base, {
    index: false,
    setHeaders(res, file) {
      const rel = '/' + path.relative(base, file).split(path.sep).join('/');
      res.setHeader('Cache-Control', cacheControl(rel, maxAgeSeconds));
      res.setHeader('Vary', 'Accept-Encoding');
    },
  });

  async function body(file, stat) {
    const hit = compressed.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.body;
    const data = await gzip(await fs.promises.readFile(file), { level: 6 });
    if (hit) cachedBytes -= hit.bytes;
    if (cachedBytes + data.length <= MAX_CACHE_BYTES) {
      compressed.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, body: data, bytes: data.length });
      cachedBytes += data.length;
    }
    return data;
  }

  return async function serve(req, res, next) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const wantsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
      if (!wantsGzip || req.headers.range) return plain(req, res, next);

      let urlPath;
      try {
        urlPath = decodeURIComponent(req.path);
      } catch {
        return plain(req, res, next);
      }
      const ext = path.extname(urlPath).toLowerCase();
      if (!COMPRESSIBLE.has(ext) || urlPath.includes('\0')) return plain(req, res, next);

      const file = path.resolve(base, '.' + urlPath);
      if (file !== base && !file.startsWith(base + path.sep)) return plain(req, res, next);
      // dotfiles stay hidden, as express.static does by default
      if (path.relative(base, file).split(path.sep).some((part) => part.startsWith('.'))) {
        return plain(req, res, next);
      }

      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat?.isFile() || stat.size < MIN_BYTES || stat.size > MAX_BYTES) return plain(req, res, next);

      res.type(ext);
      res.setHeader('Cache-Control', cacheControl(urlPath, maxAgeSeconds));
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      res.setHeader('ETag', `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}-gz"`);
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      const data = await body(file, stat);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', data.length);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      next(error);
    }
  };
}
