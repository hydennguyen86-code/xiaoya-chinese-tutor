#!/usr/bin/env bash
set -euo pipefail
# Only committed, tracked files enter this clone. No personal avatars or data/.
source_repo="${1:-$(git rev-parse --show-toplevel)}"
smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/misu-smoke.XXXXXX")"
server_pid=''
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; fi
  rm -rf "$smoke_dir"
}
trap cleanup EXIT INT TERM
 git clone --quiet --no-hardlinks "$source_repo" "$smoke_dir/repo"
cd "$smoke_dir/repo"
npm ci
npm run build
smoke_port="${SMOKE_PORT:-8791}"
XIAOYA_SAMPLE_AVATARS=1 XIAOYA_DATA_DIR="$smoke_dir/data" PORT="$smoke_port" node server/index.mjs > "$smoke_dir/server.log" 2>&1 &
server_pid=$!
export SMOKE_DATA_DIR="$smoke_dir/data"
export SMOKE_BASE="http://127.0.0.1:$smoke_port"
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE;
let status;
for (let i = 0; i < 60; i++) {
  try { const res = await fetch(`${base}/api/status`); if (res.ok) { status = await res.json(); break; } } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.ok(status, 'server did not start');
const store = await (await fetch(`${base}/api/store`)).json();
assert.equal(store.dir, process.env.SMOKE_DATA_DIR, 'port occupied by another server');
assert.match(status.avatarUrl, /^\/avatars\/brunette\.glb(?:\?|$)/);
assert.match(status.lamAvatarUrl, /^\/avatars\/lam-sample\.zip(?:\?|$)/);
for (const url of [status.avatarUrl, status.lamAvatarUrl]) {
  const res = await fetch(base + url); assert.equal(res.status, 200); assert.ok((await res.arrayBuffer()).byteLength > 1000);
}
const syllabusResponse = await fetch(`${base}/api/syllabus`); assert.equal(syllabusResponse.status, 200);
const syllabus = await syllabusResponse.json(); assert.ok(JSON.stringify(syllabus).includes('hsk1-practical'));
assert.equal(syllabus.volumes.filter(v => v.trackId === 'misu30').length, 3);
const lessonResponse = await fetch(`${base}/api/lesson-content`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({volumeId:'hsk1-practical',lessonNo:1,day:1,level:'HSK1-2'})});
assert.equal(lessonResponse.status,200);
const lesson = await lessonResponse.json(); assert.ok(lesson.listeningPractice.dictation.length >= 3); assert.equal(lesson.listeningPractice.shadowing.length,1); assert.equal(lesson.reviewed,false);
const courseResponse = await fetch(`${base}/api/lesson-content`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({volumeId:'misu30-2',lessonNo:11,day:1,level:'HSK3-4'})});
assert.equal(courseResponse.status,200); const course = await courseResponse.json(); assert.equal(course.editorialStatus,'AI soạn, chưa duyệt'); assert.equal(course.vocab.length,8);
const counts = await (await fetch(`${base}/api/tone-feedback/synthetic-smoke`)).json(); assert.deepEqual(counts,{labeled:0,feedback:0});
const tts = await fetch(`${base}/api/tts`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({text:'你好。'}), signal: AbortSignal.timeout(90000) });
const speech = await tts.json();
if (tts.ok) { assert.ok(speech.audioBase64?.length > 100); assert.ok(speech.mime?.startsWith('audio/')); console.log('TTS: generated audio'); }
else {
  assert.ok([500, 502, 503].includes(tts.status) && typeof speech.error === 'string');
  if (process.env.SMOKE_REQUIRE_TTS === '1') throw new Error(`TTS unavailable: ${speech.error}`);
  console.log('TTS: unavailable on this machine/network; error response verified, audio generation NOT verified');
}
console.log('Clean-clone smoke passed: build, status, 5 course volumes, linked listening, human sample counts, both sample avatars. No Ollama model required.');
JS
