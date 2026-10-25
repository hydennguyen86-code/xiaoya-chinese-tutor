// Measures the correction pipeline against eval/corrections.json through the
// running server: false corrections of correct sentences, detected errors and
// errors fixed as expected.
//   npm run eval:corrections -- [model] [server-url]
import fs from 'node:fs';
import { saveResult } from './record.mjs';

const applyAll = (text, hits) => hits.reduce((out, c) => out.split(c.original).join(c.corrected), text);

const provider = process.env.EVAL_PROVIDER || 'ollama';
const model = process.argv[2] || 'qwen3.5:4b';
const base = process.argv[3] || 'http://127.0.0.1:8787';
const cases = JSON.parse(fs.readFileSync(new URL('./corrections.json', import.meta.url), 'utf8'));

async function check(text) {
  const res = await fetch(`${base}/api/corrections`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, model, text }),
  });
  return (await res.json()).corrections;
}

let falseFixes = 0;
let detected = 0;
let fixed = 0;
const notes = [];
for (const text of cases.correct) {
  const found = await check(text);
  if (found.length) {
    falseFixes += 1;
    notes.push(`false fix  ${text} -> ${found.map((c) => `${c.original}→${c.corrected}`).join('; ')}`);
  }
}
for (const [text, expected] of cases.wrong) {
  const found = await check(text);
  if (!found.length) {
    notes.push(`missed     ${text}`);
    continue;
  }
  detected += 1;
  // apply every fix to the whole sentence; it only counts if the result reads as expected
  const ok = applyAll(text, found).includes(expected);
  if (ok) fixed += 1;
  else notes.push(`off target ${text} -> ${found.map((c) => `${c.original}→${c.corrected}`).join('; ')}`);
}
console.log(`model ${model}`);
console.log(`false corrections of correct sentences: ${falseFixes}/${cases.correct.length}`);
console.log(`errors detected:                        ${detected}/${cases.wrong.length}`);
console.log(`errors fixed as expected:               ${fixed}/${cases.wrong.length}`);
if (notes.length) console.log(`\n${notes.join('\n')}`);
saveResult(
  'corrections',
  { model, provider },
  {
    falseCorrections: falseFixes,
    correctSentences: cases.correct.length,
    detected,
    fixed,
    wrongSentences: cases.wrong.length,
    notes,
  },
);
