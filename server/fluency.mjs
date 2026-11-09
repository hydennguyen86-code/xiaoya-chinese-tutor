import { hasDigits, numberCandidates } from '../src/lib/hanziNumbers.mjs';
import { syllableCount } from './coursePinyin.mjs';
export function measureFluency(timing, text) {
  // 儿 hoá (哪儿) is one spoken syllable, not two. Chữ số (25) đếm theo cách đọc chữ Hán (二十五).
  const han = hasDigits(text) ? numberCandidates(text)[0] : text;
  const syllables = syllableCount(han || '');
  const span = timing ? timing.speechEnd - timing.speechStart : 0;
  if (!timing || span <= 0 || !syllables) return null;
  return {
    syllables,
    speechSeconds: span,
    syllablesPerSecond: syllables / span,
    pausesOverOneSecond: timing.pauses.length,
    pauseSeconds: timing.pauses.reduce((n, p) => n + p.end - p.start, 0),
    method: 'energy+recognized-han',
    advisory: true,
  };
}
