import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDataStore } from './dataStore.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoya-store-'));
}

test('writes, reads back and removes values, including per-learner keys', () => {
  const store = createDataStore(tempDir());
  store.write('xiaoya.learners.v2', '{"learners":[]}');
  store.write('xiaoya.chat.v1:4e6dcd08', '{"messages":[1]}');
  assert.deepEqual(store.readAll(), {
    'xiaoya.learners.v2': '{"learners":[]}',
    'xiaoya.chat.v1:4e6dcd08': '{"messages":[1]}',
  });
  store.remove('xiaoya.chat.v1:4e6dcd08');
  assert.deepEqual(Object.keys(store.readAll()), ['xiaoya.learners.v2']);
});

test('rejects keys outside the app namespace and path tricks', () => {
  const dir = tempDir();
  const store = createDataStore(dir);
  for (const key of ['other.key', 'xiaoya./../evil', '../xiaoya.x', 'xiaoya.', '']) {
    assert.throws(() => store.write(key, '1'), (error) => error.status === 400, key);
  }
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('rejects non-string and oversized values', () => {
  const store = createDataStore(tempDir());
  assert.throws(() => store.write('xiaoya.a', 5), (error) => error.status === 400);
  assert.throws(() => store.write('xiaoya.a', 'x'.repeat(2 * 1024 * 1024 + 1)), (error) => error.status === 413);
});

test('backs up existing files before the first change of the day', () => {
  const dir = tempDir();
  createDataStore(dir).write('xiaoya.settings.v1', '{"v":1}');
  // a fresh process (new store) changing data for the first time today
  createDataStore(dir).write('xiaoya.settings.v1', '{"v":2}');
  const days = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(days.length, 1);
  const saved = fs.readFileSync(path.join(dir, 'backups', days[0], 'xiaoya.settings.v1.json'), 'utf8');
  assert.equal(saved, '{"v":1}');
  assert.equal(createDataStore(dir).readAll()['xiaoya.settings.v1'], '{"v":2}');
});

test('does not mark the day as backed up while the folder is still empty', () => {
  const dir = tempDir();
  const store = createDataStore(dir);
  store.write('xiaoya.a', '1'); // nothing to back up yet
  store.write('xiaoya.a', '2'); // now there is a file: back it up
  const days = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(fs.readFileSync(path.join(dir, 'backups', days[0], 'xiaoya.a.json'), 'utf8'), '1');
});
