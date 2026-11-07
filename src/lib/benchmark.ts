// Fixed "milestone" test results per learner: first attempt is the baseline,
// later attempts (suggested every four weeks) are compared with it. Nothing is
// converted to a level or shared; it only answers "is this child learning?".
export interface BenchmarkPart {
  right: number;
  total: number;
  /** speaking: syllables the checker could not judge */
  unclear?: number;
}
export interface BenchmarkAttempt {
  at: number;
  listening: BenchmarkPart;
  meaning: BenchmarkPart;
  speaking: BenchmarkPart;
  /** 'model' when the tone classifier judged the speaking part, 'rules' otherwise */
  toneMethod: string;
}
export interface BenchmarkData {
  version: 1;
  attempts: BenchmarkAttempt[];
}
const KEY = (id: string) => `xiaoya.benchmark.v1:${id}`;
export const BENCHMARK_INTERVAL_DAYS = 28;

export function loadBenchmark(id: string): BenchmarkData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(id)) || 'null');
    if (!raw || !Array.isArray(raw.attempts)) return { version: 1, attempts: [] };
    return {
      version: 1,
      attempts: raw.attempts
        .filter((a: BenchmarkAttempt) => a && Number.isFinite(a.at) && a.listening && a.meaning && a.speaking)
        .slice(-24),
    };
  } catch {
    return { version: 1, attempts: [] };
  }
}
export function saveBenchmark(id: string, data: BenchmarkData) {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}
export function addAttempt(data: BenchmarkData, attempt: BenchmarkAttempt): BenchmarkData {
  return { version: 1, attempts: [...data.attempts, attempt].slice(-24) };
}
/** when the next milestone test is suggested: never taken, or four weeks since the last */
export function benchmarkDue(data: BenchmarkData, now = Date.now()) {
  const last = data.attempts[data.attempts.length - 1];
  return !last || now - last.at >= BENCHMARK_INTERVAL_DAYS * 86400000;
}
export function percent(part: BenchmarkPart) {
  return part.total ? Math.round((part.right / part.total) * 100) : null;
}
/** change of a part between the first and the latest attempt, in points */
export function delta(first: BenchmarkPart, latest: BenchmarkPart) {
  const a = percent(first);
  const b = percent(latest);
  return a === null || b === null ? null : b - a;
}
