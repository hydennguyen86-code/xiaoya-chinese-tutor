import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAvatarStore } from './avatars.mjs';
import { checkBuildPrivacy } from '../scripts/buildPrivacy.mjs';
test('legacy migration copies fixtures without deleting/overwriting; sample mode serves none', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-avatar-'));
  try {
    const publicDir = path.join(root, 'public'),
      dataDir = path.join(root, 'data');
    fs.mkdirSync(path.join(publicDir, 'avatars'), { recursive: true });
    const old = path.join(publicDir, 'avatars', 'personal.glb');
    fs.writeFileSync(old, 'SYNTHETIC AVATAR FIXTURE');
    let store = createAvatarStore({ dataDir, publicDir });
    assert.equal(fs.readFileSync(store.resolve('personal.glb'), 'utf8'), 'SYNTHETIC AVATAR FIXTURE');
    assert.ok(fs.existsSync(old));
    fs.writeFileSync(store.resolve('personal.glb'), 'NEW FIXTURE');
    store = createAvatarStore({ dataDir, publicDir });
    assert.equal(fs.readFileSync(store.resolve('personal.glb'), 'utf8'), 'NEW FIXTURE');
    assert.equal(store.resolve('../secret'), null);
    assert.match(store.glbUrl(), /^\/api\/avatars\//);
    const sample = createAvatarStore({ dataDir: path.join(root, 'sample'), publicDir, samplesOnly: true });
    assert.equal(sample.resolve('personal.glb'), null);
    assert.equal(sample.glbUrl(), '/avatars/brunette.glb');
    assert.equal(fs.existsSync(path.join(root, 'sample')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('post-build allowlist refuses old personal files and unknown files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'misu-dist-'));
  try {
    fs.writeFileSync(path.join(dir, '.misu-build-files.json'), '["index.html"]');
    fs.writeFileSync(path.join(dir, 'index.html'), 'fixture');
    checkBuildPrivacy(dir);
    fs.writeFileSync(path.join(dir, 'personal.glb'), 'fixture');
    assert.throws(() => checkBuildPrivacy(dir), /personal/);
    fs.rmSync(path.join(dir, 'personal.glb'));
    fs.writeFileSync(path.join(dir, 'unknown.txt'), 'fixture');
    assert.throws(() => checkBuildPrivacy(dir), /unknown/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
