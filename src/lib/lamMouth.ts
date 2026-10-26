type Weights = Record<string, number>;

// ARKit targets for the visemes emitted by lipsync.ts. A small jaw range
// preserves a/o/i/u/ü differences on this LAM avatar without a constant gape.
const VISEMES: Record<string, Weights> = {
  sil: {},
  PP: { mouthClose: 0.8, mouthPressLeft: 0.6, mouthPressRight: 0.6 },
  FF: { mouthRollLower: 0.45, mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2, jawOpen: 0.05 },
  DD: { jawOpen: 0.11, mouthLowerDownLeft: 0.04, mouthLowerDownRight: 0.04 },
  nn: { jawOpen: 0.08 },
  RR: { mouthPucker: 0.28, mouthFunnel: 0.15, jawOpen: 0.1 },
  kk: { jawOpen: 0.13 },
  CH: { mouthPucker: 0.34, mouthFunnel: 0.25, jawOpen: 0.08 },
  SS: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, jawOpen: 0.04 },
  aa: { jawOpen: 0.34, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
  E: { jawOpen: 0.16, mouthStretchLeft: 0.28, mouthStretchRight: 0.28 },
  I: { jawOpen: 0.06, mouthStretchLeft: 0.46, mouthStretchRight: 0.46 },
  O: { jawOpen: 0.18, mouthFunnel: 0.56, mouthPucker: 0.22 },
  U: { jawOpen: 0.06, mouthPucker: 0.58, mouthFunnel: 0.42 },
  Y: { jawOpen: 0.06, mouthPucker: 0.44, mouthFunnel: 0.25, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },
};

/** Keep text-derived closures and vowel shapes authoritative over loudness. */
export function mouthShape(viseme: string | null, level: number): Weights {
  if (viseme !== null) return { ...(VISEMES[viseme] ?? {}) };

  // Browser speech and the unlabelled edges of a clip have no timestamps.
  // Loudness is only a modest fallback; it must not override PP or silence.
  const open = Math.min(0.09, Math.max(0, level) * 0.16);
  return open > 0.025
    ? { jawOpen: open, mouthLowerDownLeft: open * 0.18, mouthLowerDownRight: open * 0.18 }
    : {};
}
