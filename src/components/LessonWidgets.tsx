import { pinyinLine } from '../lib/text';
import type { VoicePhase } from '../lib/voiceInput';
export function MicButton({ voicePhase, micReady, onClick, label = 'Nói' }: { voicePhase: VoicePhase | null; micReady: boolean; onClick: () => void; label?: string }) {
  return <button type="button" className={`lesson-mic${voicePhase ? ' is-active' : ''}`} disabled={!micReady || voicePhase === 'transcribing'} onClick={onClick}>
    {voicePhase === 'listening' ? 'Đang nghe… (bấm để dừng)' : voicePhase === 'transcribing' ? 'Đang nhận dạng…' : label}
  </button>;
}
export function Han({text,pinyinText}: {text:string;pinyinText?:string}) {
  return <span className="lesson-han">{(pinyinText || pinyinLine(text)) && <small>{pinyinText || pinyinLine(text)}</small>}<span>{text}</span></span>;
}

/** Add readings to Chinese fragments while keeping surrounding Vietnamese text readable. */
export function ReadableChinese({ text }: { text: string }) {
  return <>{text.split(/([\p{Script=Han}]+)/gu).map((part, i) => /[\p{Script=Han}]/u.test(part) ? <span key={i}>{part} <span className="lesson-correction-pinyin">({pinyinLine(part)})</span></span> : part)}</>;
}
