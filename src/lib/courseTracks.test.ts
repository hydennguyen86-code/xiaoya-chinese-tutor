import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groupTracks, trackIdOf } from './courseTracks.ts';

test('volumes without a trackId stay as their own track', () => {
  const tracks = groupTracks([
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B', trackId: 't', trackTitle: 'Track T' },
    { id: 'c', title: 'C', trackId: 't', trackTitle: 'Track T' },
  ]);
  assert.deepEqual(
    tracks.map((t) => [t.id, t.title, t.volumes.map((v) => v.id)]),
    [
      ['a', 'A', ['a']],
      ['t', 'Track T', ['b', 'c']],
    ],
  );
  assert.equal(trackIdOf({ id: 'a', title: 'A' }), 'a');
});

test('bundled syllabus lists three level tracks and keeps every volume id', () => {
  const syllabus = JSON.parse(fs.readFileSync(new URL('../../lessons/courses/syllabus.json', import.meta.url), 'utf8'));
  const tracks = groupTracks(syllabus.volumes as { id: string; title: string }[]);
  assert.deepEqual(
    tracks.map((t) => [t.id, t.title, t.volumes.map((v) => v.id)]),
    [
      ['hsk1', 'HSK 1–2', ['pinyin-intro', 'hsk1-practical', 'misu30-1']],
      ['hsk3', 'HSK 3–4', ['hsk3-practical', 'misu30-2']],
      ['hsk5', 'HSK 5–6', ['hsk5-practical', 'misu30-3']],
    ],
  );
});
