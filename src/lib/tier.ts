// Which kind of course a learner is in. Pure, no imports beyond types.
//
// foundation: Vỡ lòng Pinyin and HSK 1–2. New words with model pronunciation,
//   full pronunciation tools (per-syllable tones, pitch, ear drills) and an easy Coach.
// coach: HSK 3 and above. Word cards with Hán Việt, origin and examples, then
//   conversation with the Coach, who explains every mistake. No pronunciation scoring.
import type { Level } from '../types';

export type Tier = 'foundation' | 'coach';

/**
 * A course volume decides the tier when known (its `levels` list from the syllabus);
 * otherwise the learner's level does.
 */
export function tierFor(level: Level, volume?: { levels?: readonly string[] } | null): Tier {
  if (volume?.levels?.length) return volume.levels.includes('HSK1-2') ? 'foundation' : 'coach';
  return level === 'HSK1-2' ? 'foundation' : 'coach';
}

/** Per-syllable tone scoring, pitch curves, pronunciation repair and ear drills. */
export function showsAdvancedPronunciation(tier: Tier): boolean {
  return tier === 'foundation';
}
