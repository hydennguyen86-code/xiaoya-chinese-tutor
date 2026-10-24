// Measures the tone checker through the running server (/api/pronounce) on
// reference speech from the TTS voice, as a stand-in for a learner:
//  1. ten sentences let the server learn the voice's pitch range (as it does
//     for a learner who has been talking to the app for a while);
//  2. single syllables of known tone, in sets that differ only in tone
//     (妈麻马骂 …): confusion matrix;
//  3. two-syllable words: share of syllables judged with the right tone.
//   npm run eval:tones -- [server-url] [--voice=<Edge voice> | --say=<macOS voice>]
// --say uses a macOS system voice directly (e.g. Reed, Flo, Grandpa, Shelley),
// which is how to check voices that were not used to tune the thresholds.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8787';
const voice = (args.find((a) => a.startsWith('--voice=')) || '--voice=zh-CN-XiaoxiaoNeural').slice(8);
const sayVoice = (args.find((a) => a.startsWith('--say=')) || '').slice(6);
// one profile per voice, so several voices can be measured at the same time
const learner = `eval-${(sayVoice || voice).replace(/[^A-Za-z0-9]+/g, '').slice(0, 30)}`;
let usedVoice = sayVoice ? `macOS ${sayVoice}` : voice;

const SENTENCES = [
  '我今天很忙。', '你明天有空吗？', '我们一起去吃饭吧。', '这本书很有意思。', '他在银行工作。',
  '我想喝一杯咖啡。', '周末你打算做什么？', '天气越来越冷了。', '我觉得这个办法不错。', '请问地铁站怎么走？',
];
const SYLLABLES = {
  1: '妈八衣汤诗温天方书飞',
  2: '麻拔姨糖十文甜房熟肥',
  3: '马把椅躺使稳舔访鼠匪',
  4: '骂爸意烫是问店放树费',
};
const WORDS = ['中国', '学习', '汉语', '老师', '银行', '工作', '电脑', '飞机', '回家', '地铁', '北京', '上海', '手机', '音乐', '周末', '咖啡'];

async function speech(text) {
  if (sayVoice) {
    const file = path.join(os.tmpdir(), `eval-tone-${process.pid}.aiff`);
    execFileSync('say', ['-v', sayVoice, '-o', file, text]);
    const audio = fs.readFileSync(file);
    fs.rmSync(file, { force: true });
    return audio;
  }
  const res = await fetch(`${base}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const data = await res.json();
  if (data.fallbackReason) usedVoice = `${voice} unavailable → server fallback voice (${data.fallbackReason})`;
  return Buffer.from(data.audioBase64, 'base64');
}

async function pronounce(text, retry = 1) {
  const audio = await speech(text);
  let res;
  try {
    res = await post(text, audio);
  } catch (error) {
    if (!retry) throw error;
    return pronounce(text, retry - 1); // a dropped keep-alive connection: try once more
  }
  if (!res.ok) throw new Error(`pronounce HTTP ${res.status}`);
  return (await res.json()).tones;
}

function post(text, audio) {
  return fetch(`${base}/api/pronounce?learner=${learner}&target=${encodeURIComponent(text)}`, {
    method: 'POST',
    headers: { 'content-type': sayVoice ? 'audio/aiff' : 'audio/mpeg' },
    body: audio,
  });
}

await fetch(`${base}/api/store/xiaoya.pitch.v1:${learner}`, { method: 'DELETE' });
for (const sentence of SENTENCES) await pronounce(sentence);

const matrix = { 1: [0, 0, 0, 0, 0], 2: [0, 0, 0, 0, 0], 3: [0, 0, 0, 0, 0], 4: [0, 0, 0, 0, 0] };
for (const [tone, chars] of Object.entries(SYLLABLES)) {
  for (const ch of chars) {
    const report = await pronounce(ch);
    matrix[tone][report.syllables[0]?.heard ?? 0] += 1;
  }
}
let right = 0;
let total = 0;
let unclear = 0;
console.log(`voice: ${usedVoice}\n\nsingle syllables (rows: true tone; columns: heard 1 2 3 4 | unclear)`);
for (const tone of [1, 2, 3, 4]) {
  const row = matrix[tone];
  right += row[tone];
  total += row.reduce((a, b) => a + b, 0);
  unclear += row[0];
  console.log(`  tone ${tone}: ${row.slice(1).map((n) => String(n).padStart(2)).join(' ')} | ${row[0]}`);
}
const judged = total - unclear;
console.log(`  correct ${right}/${total}; of the ${judged} judged: ${Math.round((right / Math.max(1, judged)) * 100)}% right; unclear ${unclear}`);

let wordRight = 0;
let wordJudged = 0;
let wordSyll = 0;
const misses = [];
for (const word of WORDS) {
  const report = await pronounce(word);
  for (const s of report.syllables) {
    if (!s.expected) continue;
    wordSyll += 1;
    if (s.ok === null) continue;
    wordJudged += 1;
    if (s.ok) wordRight += 1;
    else misses.push(`${word} ${s.char}: expected ${s.expected}, heard ${s.heard}`);
  }
}
console.log(`\ntwo-syllable words: ${wordRight}/${wordJudged} judged syllables right (${Math.round((wordRight / Math.max(1, wordJudged)) * 100)}%), ${wordSyll - wordJudged}/${wordSyll} unclear`);
if (misses.length) console.log(`  ${misses.join('\n  ')}`);

await fetch(`${base}/api/store/xiaoya.pitch.v1:${learner}`, { method: 'DELETE' });
