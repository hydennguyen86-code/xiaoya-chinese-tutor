import type { VoiceResult } from './voiceInput';
export function retainSpokenTurn(current: Record<string, VoiceResult>, id: string, result: VoiceResult): Record<string, VoiceResult> {
  if (!result.audio || result.audio.size > 15_000_000 || !result.text.trim()) return current;
  const next = { ...current, [id]: result };
  const keys = Object.keys(next);
  let bytes = Object.values(next).reduce((sum, turn) => sum + (turn.audio?.size || 0), 0);
  while (keys.length > 5 || bytes > 20_000_000) {
    const old = keys.shift()!;
    bytes -= next[old].audio?.size || 0;
    delete next[old];
  }
  return next;
}
