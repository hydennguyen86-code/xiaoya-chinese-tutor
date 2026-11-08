import { syllableCount } from './coursePinyin.mjs';
export function measureFluency(timing, text) {
  // 儿 hoá (哪儿) is one spoken syllable, not two
  const syllables = syllableCount(text || '');
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
