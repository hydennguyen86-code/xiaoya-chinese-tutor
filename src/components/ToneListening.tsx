import { useState } from 'react';
import bank from '../../lessons/listening/tone-pairs.json';
import { useLessonAudio } from '../lib/useLessonAudio';
import { gradeTone, listeningHistory, nextTone, recordToneAnswer, toneOptions, type ToneItem } from '../lib/listeningPractice';
import { SlowListen } from './ListeningControls';
export function ToneListening({ learnerId, level, voice, onBusy }: { learnerId: string; level: string; voice: string; onBusy: (busy: boolean) => void }) {
  return <details className="course-practice"><summary>Luyện tai thanh điệu</summary><ToneRound key={`${learnerId}:${level}`} {...{learnerId, level, voice, onBusy}} /></details>;
}
function ToneRound({ learnerId, level, voice, onBusy }: { learnerId: string; level: string; voice: string; onBusy: (busy: boolean) => void }) {
  const items = (bank.items as ToneItem[]).filter((i) => i.level === level && !i.uncertain);
  const [item, setItem] = useState(() => nextTone(items, listeningHistory(learnerId)));
  const [answered, setAnswered] = useState<number[] | null>(null);
  const [played, setPlayed] = useState(false);
  const audio = useLessonAudio(voice, onBusy);
  if (!item) return <p>Chưa có câu cho bậc này.</p>;
  const play = () => audio.play(item.hanzi, () => setPlayed(true));
  return <div>
    <p>{bank.source}. Giọng tổng hợp; mục không chắc cách đọc được bỏ khỏi phần chấm. Câu tiếp ưu tiên cặp thanh hay nhầm trong nghe và nói của riêng bạn.</p>
    <button type="button" onClick={() => void play()}>Nghe âm / từ</button><SlowListen onPlay={play} />
    <div className="lesson-actions">{toneOptions(item).sort((a,b)=>a.join('-').localeCompare(b.join('-'))).map((tones) => <button key={tones.join('-')} type="button" disabled={!played || Boolean(answered)} onClick={() => { setAnswered(tones); recordToneAnswer(learnerId,item,tones); }}>Thanh {tones.join('–')}</button>)}</div>
    {answered && <p>{gradeTone(item,answered) ? 'Khớp.' : 'Chưa khớp.'} {item.hanzi} · {item.pinyin} · {item.meaningVi}. {(item.baseTones || item.baseTone) && `Thanh gốc: ${(item.baseTones || item.baseTone)?.join('–')}.`} Chấp nhận: {(item.acceptTones || [Array.isArray(item.tone) ? item.tone : [item.tone]]).map(t=>t.join('–')).join(' / ')}.</p>}
    {answered && <button type="button" onClick={() => { audio.stop(); setItem(nextTone(items,listeningHistory(learnerId),item.id)); setAnswered(null); setPlayed(false); }}>Câu tiếp</button>}
    {audio.error && <p role="alert">{audio.error}</p>}
  </div>;
}
