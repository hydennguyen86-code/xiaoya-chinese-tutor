import type { ToneReport } from './voiceInput';
export interface ToneItem { id: string; level: string; hanzi: string; pinyin: string; meaningVi: string; tone: number | number[]; distractors: (number | number[])[]; baseTone?: number[]; baseTones?: number[]; acceptTones?: number[][]; uncertain?: boolean }
const seq = (value: number | number[]) => Array.isArray(value) ? value : [value];
export function acceptedTones(item: ToneItem) { return item.acceptTones?.length ? item.acceptTones : [seq(item.tone)]; }
export function gradeTone(item: ToneItem, answer: number[]) { return acceptedTones(item).some((a) => a.length === answer.length && a.every((v, i) => v === answer[i])); }
export function toneOptions(item: ToneItem) {
  const values = seq(item.tone).length === 1 ? [1, 2, 3, 4, 5].map((n) => [n]) : [...acceptedTones(item), ...item.distractors.map(seq)];
  return [...new Map(values.map((a) => [a.join('-'), a])).values()];
}
export interface ListeningHistory { matrix: Record<string, number>; attempts: Record<string, number> }
export function listeningHistory(scope: string): ListeningHistory {
  try { const raw = JSON.parse(localStorage.getItem(`xiaoya.ear.v1:${scope}`) || 'null'); return { matrix: raw?.matrix || {}, attempts: raw?.attempts || {} }; } catch { return { matrix: {}, attempts: {} }; }
}
export function recordToneAnswer(scope: string, item: ToneItem, answer: number[]) {
  const history = listeningHistory(scope);
  history.attempts[item.id] = (history.attempts[item.id] || 0) + 1;
  if (!gradeTone(item, answer)) seq(item.tone).forEach((expected, i) => { if(expected!==answer[i]&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('misu:pronunciation-error',{detail:{learnerId:scope,kind:'tone',target:[...item.hanzi][i],contrast:String(expected),heard:String(answer[i])}}));
    const key = `${expected}:${answer[i]}`; history.matrix[key] = (history.matrix[key] || 0) + 1; });
  save(scope, history);
}
function save(scope: string, value: ListeningHistory) { try { localStorage.setItem(`xiaoya.ear.v1:${scope}`, JSON.stringify(value)); } catch { /* optional storage */ } }
export function recordSpokenTones(scope: string, report: ToneReport) {
  const history = listeningHistory(scope);
  for (const s of report.syllables) if (s.ok === false && s.heard >= 1 && s.heard <= 5) {
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('misu:pronunciation-error',{detail:{learnerId:scope,kind:'tone',target:s.char,contrast:String(s.expected),heard:String(s.heard)}}));
    const key = `${s.expected}:${s.heard}`; history.matrix[key] = (history.matrix[key] || 0) + 1; }
  save(scope, history);
}
export function tonePriority(item: ToneItem, history: ListeningHistory) {
  return 1 / (1 + (history.attempts[item.id] || 0)) + seq(item.tone).reduce((score, expected) => score + [1,2,3,4,5].reduce((n, heard) => n + (expected === heard ? 0 : history.matrix[`${expected}:${heard}`] || 0), 0), 0);
}
export function nextTone(items: ToneItem[], history: ListeningHistory, previous = '', random = Math.random()) {
  const pool = items.filter((i) => i.id !== previous && !i.uncertain);
  const candidates = pool.length ? pool : items.filter((i) => !i.uncertain);
  const total = candidates.reduce((n, i) => n + tonePriority(i, history), 0);
  let cursor = random * total;
  return candidates.find((i) => (cursor -= tonePriority(i, history)) <= 0) || candidates.at(-1);
}
