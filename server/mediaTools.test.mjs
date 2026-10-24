import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaToolPath } from './mediaTools.mjs';
test('media tools honor configuration and find local binaries without a login PATH', () => {
  assert.equal(mediaToolPath('ffmpeg', { FFMPEG_PATH: '/custom/ffmpeg' }, () => false), '/custom/ffmpeg');
  assert.equal(mediaToolPath('ffmpeg', {}, (p) => p === '/user/.local/bin/ffmpeg', '/user'), '/user/.local/bin/ffmpeg');
  assert.equal(mediaToolPath('ffprobe', { FFMPEG_PATH: '/custom/ffmpeg' }, (p) => p === '/custom/ffprobe'), '/custom/ffprobe');
  assert.equal(mediaToolPath('ffmpeg', {}, () => false), 'ffmpeg');
});
