import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaToolPath } from './mediaTools.mjs';
test('media tools honor configuration and find local binaries without a login PATH', () => {
  assert.equal(
    mediaToolPath('ffmpeg', { FFMPEG_PATH: '/custom/ffmpeg' }, () => false),
    '/custom/ffmpeg',
  );
  assert.equal(
    mediaToolPath('ffmpeg', {}, (p) => p === '/user/.local/bin/ffmpeg', '/user', 'darwin'),
    '/user/.local/bin/ffmpeg',
  );
  assert.equal(
    mediaToolPath('ffprobe', { FFMPEG_PATH: '/custom/ffmpeg' }, (p) => p === '/custom/ffprobe', '/user', 'darwin'),
    '/custom/ffprobe',
  );
  assert.equal(
    mediaToolPath('ffmpeg', {}, () => false, '/user', 'darwin'),
    'ffmpeg',
  );
});
test('Windows media paths use exe and derive ffprobe beside configured ffmpeg', () => {
  const env = { FFMPEG_PATH: 'C:\\Tools with spaces\\ffmpeg.exe' };
  assert.equal(
    mediaToolPath('ffprobe', env, (p) => p === 'C:\\Tools with spaces\\ffprobe.exe', 'C:\\Users\\Test', 'win32'),
    'C:\\Tools with spaces\\ffprobe.exe',
  );
  assert.equal(
    mediaToolPath('ffmpeg', {}, () => false, 'C:\\Users\\Test', 'win32'),
    'ffmpeg.exe',
  );
});
