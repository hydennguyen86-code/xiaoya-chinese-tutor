// Reference measurement with Azure Speech "pronunciation assessment" (zh-CN), used
// only to compare against the app's own tone checker on the same private
// recordings. Nothing in the app depends on Azure; this script is opt-in and
// needs a key you own:
//
//   AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=southeastasia \
//   node eval/azure-pronunciation.mjs /Users/you/misu-recordings/split/learner-01 [--labels=labels.X.json] [--limit=20]
//
// Each recording (decoded to 16 kHz WAV on this machine) is sent to Azure with
// its reference text; Azure returns accuracy/fluency/completeness and a
// per-word accuracy score with an error type. Azure does not grade tones by
// number, so the comparison is: does its per-character accuracy mark the same
// characters the human labeller and the app flagged? Results are printed and
// saved to eval/results/ without audio or names.
import fs from 'node:fs';
import { readRecordingDataset } from './recordings.mjs';
import { decodeToPcm, expectedTones, analyseTones } from '../server/tones.mjs';
import { pcmWav } from '../server/stt.mjs';
import { saveResult } from './record.mjs';

const dir = process.argv[2];
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!dir || !key || !region) {
  console.error(
    'usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node eval/azure-pronunciation.mjs <recording dir> [--labels=<file>] [--limit=N]',
  );
  process.exit(1);
}
const labelsFile = process.argv.find((a) => a.startsWith('--labels='))?.slice(9);
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) || 0);
const { recordings } = readRecordingDataset(dir, { labelsFile });
const items = limit ? recordings.slice(0, limit) : recordings;

async function assess(wav, referenceText) {
  const config = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      Dimension: 'Comprehensive',
      EnableMiscue: false,
    }),
  ).toString('base64');
  const res = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-CN&format=detailed`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': config,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
      },
      body: wav,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!res.ok) throw new Error(`Azure HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const best = data.NBest?.[0];
  if (!best) throw new Error(`Azure: ${data.RecognitionStatus || 'no result'}`);
  return {
    accuracy: best.PronunciationAssessment?.AccuracyScore ?? null,
    fluency: best.PronunciationAssessment?.FluencyScore ?? null,
    completeness: best.PronunciationAssessment?.CompletenessScore ?? null,
    words: (best.Words || []).map((w) => ({
      word: w.Word,
      accuracy: w.PronunciationAssessment?.AccuracyScore ?? null,
      errorType: w.PronunciationAssessment?.ErrorType || '',
    })),
  };
}

const rows = [];
let agreeHumanAzure = 0;
let agreeHumanApp = 0;
let compared = 0;
for (const entry of items) {
  const audio = fs.readFileSync(entry.file);
  const pcm = await decodeToPcm(audio);
  let azure;
  try {
    azure = await assess(pcmWav(pcm), entry.text);
  } catch (error) {
    console.error(`[${entry.id}] ${error.message}`);
    continue;
  }
  const app = await analyseTones(audio, entry.text, { pcm });
  const expected = expectedTones(entry.text).map((s) => s.expected);
  // one flag per character: human says the tone differs from the dictionary tone;
  // Azure says accuracy < 60 for the word containing it; the app says ok === false
  const chars = [...entry.text];
  const azureChar = chars.map((ch) => {
    const word = azure.words.find((w) => w.word.includes(ch));
    return word ? word.accuracy !== null && word.accuracy < 60 : null;
  });
  chars.forEach((ch, i) => {
    const human = entry.label.tones[i];
    if (!human || human === 5 || !expected[i]) return;
    const humanFlag = human !== expected[i];
    const appFlag = app.syllables[i]?.ok === false;
    if (azureChar[i] !== null) {
      compared += 1;
      if (azureChar[i] === humanFlag) agreeHumanAzure += 1;
      if (appFlag === humanFlag) agreeHumanApp += 1;
    }
  });
  rows.push({
    id: entry.id,
    text: entry.text,
    azure: { accuracy: azure.accuracy, fluency: azure.fluency, words: azure.words },
    appMethod: app.method,
  });
  console.log(
    `${entry.id} ${entry.text}: Azure accuracy ${azure.accuracy} · words ${azure.words.map((w) => `${w.word}=${w.accuracy}`).join(' ')}`,
  );
}
console.log(`\ncharacters compared: ${compared}`);
console.log(`Azure flag agrees with the human labeller on ${agreeHumanAzure}/${compared}; the app on ${agreeHumanApp}/${compared}`);
console.log('(Azure scores pronunciation as a whole, not the tone number; a disagreement is not proof that either side is wrong.)');
saveResult(
  'azure-reference',
  { service: 'azure-pronunciation-assessment', language: 'zh-CN', granularity: 'phoneme' },
  { compared, agreeHumanAzure, agreeHumanApp, rows },
);
