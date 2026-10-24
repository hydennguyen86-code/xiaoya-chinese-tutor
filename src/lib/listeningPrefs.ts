export const SPEEDS = [0.7, 0.85, 1] as const;
export const LISTENING_KEY = 'xiaoya.listening.v1';
export function normalizeSpeed(value: unknown) {
  return SPEEDS.includes(value as (typeof SPEEDS)[number]) ? Number(value) : 1;
}
export function listeningPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(LISTENING_KEY) || '{}');
    return { rate: normalizeSpeed(raw.rate), listenFirst: raw.listenFirst !== false };
  } catch {
    return { rate: 1, listenFirst: true };
  }
}
export function updateListeningPrefs(change: Partial<{ rate: number; listenFirst: boolean }>) {
  const next = { ...listeningPrefs(), ...change };
  next.rate = normalizeSpeed(next.rate);
  try {
    localStorage.setItem(LISTENING_KEY, JSON.stringify(next));
  } catch {
    /* Storage optional. */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('misu:listening'));
}
let override: number | undefined;
export const speechRate = () => override ?? listeningPrefs().rate;
export function withSpeechRate<T>(rate: number, action: () => T): T {
  const previous = override;
  override = normalizeSpeed(rate);
  try {
    return action();
  } finally {
    override = previous;
  }
}
