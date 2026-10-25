export interface VoiceTiming {
  speechEnd: number;
  recordingEnd: number;
  sttStart: number;
  sttEnd: number;
}
export interface LatencyTrace extends VoiceTiming {
  scope: string;
  modelStart: number;
  sentence?: number;
  ttsStart?: number;
  ttsReady?: number;
  audio?: number;
}
export interface LatencyResult {
  at: number;
  total: number;
  silenceWait: number;
  uploadRecognition: number;
  model: number;
  tts: number;
  decodePlayback: number;
  method: 'scheduled-audio-estimate';
}
const traces = new Map<string, LatencyTrace>();
let serial = 0;
export function latencyResult(t: LatencyTrace, at = Date.now()): LatencyResult | null {
  const stamps = [t.speechEnd, t.recordingEnd, t.sttStart, t.sttEnd, t.modelStart, t.sentence, t.ttsStart, t.ttsReady, t.audio];
  if (stamps.some((v) => v === undefined || !Number.isFinite(v)) || stamps.some((v, i) => i > 0 && Number(v) < Number(stamps[i - 1])))
    return null;
  return {
    at,
    total: t.audio! - t.speechEnd,
    silenceWait: t.recordingEnd - t.speechEnd,
    uploadRecognition: t.sttEnd - t.sttStart,
    model: t.sentence! - t.modelStart,
    tts: t.ttsReady! - t.ttsStart!,
    decodePlayback: t.audio! - t.ttsReady!,
    method: 'scheduled-audio-estimate',
  };
}
export function beginLatency(scope: string, timing?: VoiceTiming) {
  traces.clear();
  if (!timing) return undefined;
  const id = String(++serial);
  traces.set(id, { ...timing, scope, modelStart: performance.now() });
  return id;
}
export function markLatency(id: string | undefined, stage: 'sentence' | 'ttsStart' | 'ttsReady' | 'audio', at = performance.now()) {
  if (!id) return;
  const t = traces.get(id);
  if (!t || t[stage] !== undefined) return;
  t[stage] = at;
  if (stage === 'audio') {
    const result = latencyResult(t);
    traces.delete(id);
    if (!result) return;
    try {
      localStorage.setItem(`xiaoya.latency.v1:${t.scope}`, JSON.stringify([...loadLatency(t.scope), result].slice(-100)));
      window.dispatchEvent(new Event('misu:latency-update'));
    } catch {
      /* optional storage */
    }
  }
}
export function cancelLatency() {
  traces.clear();
}
export function loadLatency(scope: string): LatencyResult[] {
  try {
    return JSON.parse(localStorage.getItem(`xiaoya.latency.v1:${scope}`) || '[]')
      .filter((v: LatencyResult) => v && Number.isFinite(v.total) && v.total >= 0)
      .slice(-100);
  } catch {
    return [];
  }
}
