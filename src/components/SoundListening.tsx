import { useState } from 'react';
import bank from '../../lessons/listening/sound-pairs.json';
import { useLessonAudio } from '../lib/useLessonAudio';
import { SlowListen } from './ListeningControls';
export function SoundListening({learnerId,voice,onBusy}:{learnerId:string;voice:string;onBusy:(busy:boolean)=>void}) {
  const [pairIndex,setPairIndex]=useState(0);
  const pair=bank.pairs[pairIndex];
  return <details className="course-practice"><summary>Phân biệt âm dễ lẫn</summary><p>{bank.source}. Chọn theo tai nghe, không cần nhận dạng giọng nói. Mẹo khẩu hình chỉ gần đúng. Các từ có ghi uncertain được bỏ khỏi bài chấm.</p><label>Cặp âm<select value={pairIndex} onChange={e=>setPairIndex(Number(e.target.value))}>{bank.pairs.map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select></label><SoundRound key={`${learnerId}:${pair.id}`} {...{learnerId,voice,onBusy,pair}}/></details>;
}
function SoundRound({learnerId,voice,onBusy,pair,onAnswer}:{learnerId:string;voice:string;onBusy:(busy:boolean)=>void;pair:typeof bank.pairs[number];onAnswer?:(correct:boolean)=>void}) {
  const examples=pair.examples.filter(e=>!('uncertain' in e && e.uncertain));
  const [index,setIndex]=useState(0),[side,setSide]=useState<'a'|'b'>(()=>Math.random()<.5?'a':'b');
  const [answered,setAnswered]=useState<'a'|'b'|null>(null),[played,setPlayed]=useState(false);
  const audio=useLessonAudio(voice,onBusy);
  const example=examples[index];
  if (!example) return <p>Chưa có cặp đủ chắc cách đọc.</p>;
  const play=()=>audio.play(example[side].hanzi,()=>setPlayed(true));
  function answer(value:'a'|'b') {
    setAnswered(value);

    try { const key=`xiaoya.sound-confusion.v1:${learnerId}`;const history=JSON.parse(localStorage.getItem(key)||'{}');const id=`${pair.id}:${side}:${value}`;history[id]=(history[id]||0)+1;localStorage.setItem(key,JSON.stringify(history)); } catch { /* optional storage */ }
    window.dispatchEvent(new CustomEvent('misu:sound-answer',{detail:{learnerId,pairId:pair.id,text:example[side].hanzi,correct:side===value,heard:example[value].pinyin,contrast:pair.id}}));
    onAnswer?.(value===side);
  }
  return <div><button type="button" onClick={()=>void play()}>Nghe một âm</button><SlowListen onPlay={play}/><div className="lesson-actions">{(['a','b'] as const).map(s=><button key={s} type="button" disabled={!played||Boolean(answered)} onClick={()=>answer(s)}>{example[s].pinyin}</button>)}</div>{answered&&<><p>{answered===side?'Khớp.':'Chưa khớp.'} {example[side].hanzi} · {example[side].pinyin} · {example[side].meaningVi}</p><p>{pair.tipVi}</p><button type="button" onClick={()=>{audio.stop();setIndex((index+1)%examples.length);setSide(Math.random()<.5?'a':'b');setAnswered(null);setPlayed(false);}}>Cặp tiếp</button></>}{audio.error&&<p role="alert">{audio.error}</p>}</div>;
}

export function SoundReview({learnerId,voice,pairId,onAnswer}:{learnerId:string;voice:string;pairId:string;onAnswer:(correct:boolean)=>void}) {
 const pair=bank.pairs.find(p=>p.id===pairId);return pair?<SoundRound {...{learnerId,voice,pair,onAnswer}} onBusy={()=>{}}/>:<p>Không còn nhóm âm này trong bộ hiện tại.</p>;
}
