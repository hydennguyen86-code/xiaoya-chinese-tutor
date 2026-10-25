import { pinyinCitation } from '../lib/coursePinyin.mjs';
import { useState } from 'react';
import bank from '../../lessons/listening/dictation.json';
import { gradeDictation, type DictationItem } from '../lib/authoredListening';
import { useLessonAudio } from '../lib/useLessonAudio';
import type { LessonContent } from '../lib/lessonApi';
import { SlowListen } from './ListeningControls';
export function DictationPractice({ content, voice, onBusy }: { content: LessonContent; voice: string; onBusy: (busy: boolean) => void }) {
  const [mode, setMode] = useState('bank');
  const course: DictationItem[] = [
    ...content.vocab
      .filter((w) => w.example && w.examplePinyin)
      .map((w, i) => ({
        id: `course-${i}`,
        level: content.level || 'HSK1-2',
        hanzi: w.example,
        pinyin: w.examplePinyin,
        meaningVi: w.exampleVi,
      })),
    {
      id: 'roleplay',
      level: content.level || 'HSK1-2',
      hanzi: content.roleplay.opening,
      pinyin: pinyinCitation(content.roleplay.opening),
      meaningVi: content.roleplay.openingVi,
    },
  ].filter((x) => x.pinyin);
  const items =
    mode === 'bank' ? (bank.items as DictationItem[]).filter((i) => i.level === (content.level || 'HSK1-2') && !i.uncertain) : course;
  return (
    <details className="course-practice">
      <summary>Nghe chép · chữ Hán hoặc pinyin</summary>
      <p>{bank.source}. Không bắt buộc ghi dấu thanh; nếu có ghi, đối chiếu acceptTones của nội dung đã tính biến điệu.</p>
      <label>
        Nguồn câu
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="bank">Bộ DeepSeek</option>
          <option value="course">Ví dụ của buổi học</option>
        </select>
      </label>
      <DictationRound key={`${mode}:${content.volumeId}:${content.lessonNo}:${content.day}`} {...{ items, voice, onBusy }} />
    </details>
  );
}
function DictationRound({ items, voice, onBusy }: { items: DictationItem[]; voice: string; onBusy: (busy: boolean) => void }) {
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(''),
    [submitted, setSubmitted] = useState(false),
    [played, setPlayed] = useState(false);
  const audio = useLessonAudio(voice, onBusy),
    item = items[index];
  if (!item) return <p>Buổi này chưa có câu kèm pinyin để nghe chép.</p>;
  const play = () => audio.play(item.hanzi, () => setPlayed(true));
  const result = gradeDictation(item, answer);
  const chunks = item.hanzi.split(/[，。！？；]/).filter(Boolean);
  return (
    <div>
      <button type="button" onClick={() => void play()}>
        Nghe câu
      </button>
      <SlowListen onPlay={play} />
      <div className="lesson-actions">
        {chunks.map((chunk, i) => (
          <button type="button" key={i} onClick={() => void audio.play(chunk, () => setPlayed(true))}>
            Nghe đoạn {i + 1}
          </button>
        ))}
      </div>
      <label>
        Bản chép của bạn (pinyin cách từng âm tiết)
        <input
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setSubmitted(false);
          }}
        />
      </label>
      <button type="button" disabled={!played || !answer.trim()} onClick={() => setSubmitted(true)}>
        Đối chiếu
      </button>
      {submitted && (
        <>
          <p>
            {result.correct ? 'Khớp bản chép.' : 'Có chỗ khác bản chép.'}{' '}
            {!result.tonesCorrect && 'Thanh ghi chưa khớp các biến thể được chấp nhận.'}
          </p>
          <p>
            {result.parts.map((p, i) => (
              <span key={i} style={{ color: p.ok ? 'inherit' : '#d04b24' }} title={`Bạn gõ: ${p.actual || '(thiếu)'}`}>
                {p.expected || `[+${p.actual}]`}
              </span>
            ))}
          </p>
          <p>{item.pinyin}</p>
          <p>{item.meaningVi}</p>
          {item.baseTones && (
            <p>
              Thanh gốc: {item.baseTones.join('–')}; chấp nhận: {item.acceptTones?.map((t) => t.join('–')).join(' / ')}.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              audio.stop();
              setIndex((index + 1) % items.length);
              setAnswer('');
              setSubmitted(false);
              setPlayed(false);
            }}
          >
            Câu tiếp
          </button>
        </>
      )}
      {audio.error && <p role="alert">{audio.error}</p>}
    </div>
  );
}
