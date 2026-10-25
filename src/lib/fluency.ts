export interface Fluency {
  syllables: number;
  speechSeconds: number;
  syllablesPerSecond: number;
  pausesOverOneSecond: number;
  pauseSeconds: number;
  advisory: true;
}
export interface FluencyEntry extends Fluency {
  at: number;
}
export function loadFluency(scope: string): FluencyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(`xiaoya.fluency.v1:${scope}`) || '[]')
      .filter((e: FluencyEntry) => e && e.syllables > 0 && e.speechSeconds > 0 && Number.isFinite(e.at))
      .slice(-500);
  } catch {
    return [];
  }
}
export function saveFluency(scope: string, metrics: Fluency, at = Date.now()) {
  if (!scope) return;
  try {
    localStorage.setItem(`xiaoya.fluency.v1:${scope}`, JSON.stringify([...loadFluency(scope), { ...metrics, at }].slice(-500)));
    window.dispatchEvent(new Event('misu:fluency-update'));
  } catch {
    /* optional storage */
  }
}
export function weeklyFluency(entries: FluencyEntry[]) {
  const groups = new Map<string, { week: string; turns: number; syllables: number; seconds: number; pauses: number }>();
  for (const e of entries) {
    const date = new Date(e.at);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const week = date.toISOString().slice(0, 10);
    const g = groups.get(week) || { week, turns: 0, syllables: 0, seconds: 0, pauses: 0 };
    g.turns++;
    g.syllables += e.syllables;
    g.seconds += e.speechSeconds;
    g.pauses += e.pausesOverOneSecond;
    groups.set(week, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8)
    .map((g) => ({ ...g, rate: g.syllables / g.seconds, pausesPerMinute: (g.pauses / g.seconds) * 60 }));
}
