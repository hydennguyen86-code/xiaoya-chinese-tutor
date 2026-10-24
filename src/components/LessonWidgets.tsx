import type { VoicePhase } from '../lib/voiceInput';
export function MicButton({ voicePhase, micReady, onClick, label = 'Nói' }: { voicePhase: VoicePhase | null; micReady: boolean; onClick: () => void; label?: string }) {
  return <button type="button" className={`lesson-mic${voicePhase ? ' is-active' : ''}`} disabled={!micReady || voicePhase === 'transcribing'} onClick={onClick}>
    {voicePhase === 'listening' ? 'Đang nghe… (bấm để dừng)' : voicePhase === 'transcribing' ? 'Đang nhận dạng…' : label}
  </button>;
}
export function Han({text,pinyinText}: {text:string;pinyinText?:string}) {
  return <span className="lesson-han">{pinyinText && <small>{pinyinText}</small>}<span>{text}</span></span>;
}
