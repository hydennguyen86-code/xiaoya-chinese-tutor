import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retainSpokenTurn } from './spokenTurns.ts';
test('spoken turns retain only ten memory blobs and never pretend browser transcripts have recordings', () => {
  let turns = {};
  for (let i = 0; i < 12; i++) turns = retainSpokenTurn(turns, String(i), { text: '你好', tones: null, audio: new Blob(['synthetic']) });
  assert.equal(Object.keys(turns).length, 10);
  assert.ok(!('0' in turns));
  assert.equal(retainSpokenTurn(turns, 'none', { text: '你好', tones: null }), turns);
});
