import { useEffect, useMemo, useState } from 'react';
import benchmark from '../../lessons/benchmark/hsk1.json' with { type: 'json' };
import { useLessonAudio } from '../lib/useLessonAudio';
import { listen, type VoiceHandle, type ToneReport } from '../lib/voiceInput';
import {
  addAttempt,
  benchmarkDue,
  delta,
  loadBenchmark,
  percent,
  saveBenchmark,
  type BenchmarkAttempt,
  type BenchmarkData,
} from '../lib/benchmark';
import { useTeacher } from '../lib/persona';

// A fixed 16-item milestone test, always the same, so a learner can be compared
// with themself: the first attempt is the baseline, the next ones (every four
// weeks) show whether listening, meaning and spoken tones actually moved.
// Results stay on this computer and are never turned into a level.

interface ListeningItem {
  id: string;
  word: string;
  pinyin: string;
  tones: number[];
}
interface MeaningItem {
  id: string;
  word: string;
  options: string[];
  answer: number;
}
interface SpeakingItem {
  id: string;
  word: string;
  pinyin: string;
}
const DATA = benchmark as unknown as { source: string; listening: ListeningItem[]; meaning: MeaningItem[]; speaking: SpeakingItem[] };
const TONE_OPTIONS = [1, 2, 3, 4];
type Step = 'intro' | 'listening' | 'meaning' | 'speaking' | 'done';

export function BenchmarkTest({
  learnerId,
  voice,
  localStt,
  onClose,
}: {
  learnerId: string;
  voice: string;
  localStt: boolean;
  onClose: () => void;
}) {
  const teacher = useTeacher();
  const [data, setData] = useState<BenchmarkData>(() => loadBenchmark(learnerId));
  const [step, setStep] = useState<Step>('intro');
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState<number[]>([]);
  const [meaning, setMeaning] = useState<number[]>([]);
  const [speaking, setSpeaking] = useState<ToneReport[]>([]);
  const [handle, setHandle] = useState<VoiceHandle | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [note, setNote] = useState('');
  const audio = useLessonAudio(voice, () => {});
  const due = benchmarkDue(data);
  useEffect(() => () => handle?.cancel(), [handle]);

  const start = () => {
    setListening([]);
    setMeaning([]);
    setSpeaking([]);
    setIndex(0);
    setStep('listening');
  };
  const answerListening = (tone: number) => {
    const next = [...listening, tone];
    setListening(next);
    if (next.length >= DATA.listening.length) {
      setIndex(0);
      setStep('meaning');
    } else setIndex(next.length);
  };
  const answerMeaning = (option: number) => {
    const next = [...meaning, option];
    setMeaning(next);
    if (next.length >= DATA.meaning.length) {
      setIndex(0);
      setStep('speaking');
    } else setIndex(next.length);
  };
  const record = async () => {
    if (handle) {
      handle.stop();
      return;
    }
    const item = DATA.speaking[index];
    setNote('');
    const h = listen({ local: localStt, pronounce: item.word, learnerId, onPhase: (p) => setPhase(p), silenceMs: 1400, maxMs: 12000 });
    setHandle(h);
    try {
      const result = await h.details;
      const report = result.tones ?? { syllables: [], checked: 0, correct: 0 };
      if (!result.text && !result.tones) setNote('Chưa nghe được. Bấm ghi và đọc to hơn nhé.');
      const next = [...speaking, report];
      setSpeaking(next);
      if (next.length >= DATA.speaking.length) finish(listening, meaning, next);
      else setIndex(next.length);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Không nghe được. Thử lại nhé.');
    } finally {
      setHandle(null);
      setPhase('');
    }
  };
  const skipSpeaking = () => {
    const next = [...speaking, { syllables: [], checked: 0, correct: 0 }];
    setSpeaking(next);
    if (next.length >= DATA.speaking.length) finish(listening, meaning, next);
    else setIndex(next.length);
  };
  const finish = (l: number[], m: number[], s: ToneReport[]) => {
    const attempt: BenchmarkAttempt = {
      at: Date.now(),
      listening: { right: l.filter((t, i) => t === DATA.listening[i].tones[0]).length, total: DATA.listening.length },
      meaning: { right: m.filter((o, i) => o === DATA.meaning[i].answer).length, total: DATA.meaning.length },
      speaking: {
        right: s.reduce((sum, r) => sum + r.correct, 0),
        total: s.reduce((sum, r) => sum + r.checked, 0),
        unclear: s.reduce((sum, r) => sum + r.syllables.filter((x) => x.ok === null && x.expected).length, 0),
      },
      toneMethod: s.some((r) => r.method === 'model') ? 'model' : 'rules',
    };
    const next = addAttempt(data, attempt);
    saveBenchmark(learnerId, next);
    setData(next);
    setStep('done');
  };

  const first = data.attempts[0];
  const latest = data.attempts[data.attempts.length - 1];
  const history = useMemo(
    () =>
      data.attempts.map((a) => ({
        date: new Date(a.at).toLocaleDateString('vi-VN'),
        listening: percent(a.listening),
        meaning: percent(a.meaning),
        speaking: percent(a.speaking),
        unclear: a.speaking.unclear ?? 0,
        method: a.toneMethod,
      })),
    [data],
  );

  return (
    <section className="benchmark">
      <div className="learning-section-head">
        <div>
          <h3>Bài kiểm tra mốc (16 mục, luôn giống nhau)</h3>
          <p>
            Lần đầu là mốc xuất phát; sau mỗi 4 tuần làm lại để thấy mình tiến tới đâu. So với chính mình, không quy ra HSK. {DATA.source}.
          </p>
        </div>
        <button type="button" className="learning-secondary" onClick={onClose}>
          Đóng
        </button>
      </div>

      {(step === 'intro' || step === 'done') && (
        <>
          {history.length > 0 && (
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Nghe thanh</th>
                  <th>Nghĩa</th>
                  <th>Đọc thanh</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={i}>
                    <td>{row.date}</td>
                    <td>{row.listening === null ? '—' : `${row.listening}%`}</td>
                    <td>{row.meaning === null ? '—' : `${row.meaning}%`}</td>
                    <td>
                      {row.speaking === null ? '—' : `${row.speaking}%`}
                      {row.unclear ? <small> ({row.unclear} chữ chưa chấm)</small> : null}
                      <small> · {row.method === 'model' ? 'mô hình' : 'luật'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {first && latest && first !== latest && (
            <p className="lesson-ok">
              So với mốc đầu: nghe thanh {fmt(delta(first.listening, latest.listening))}, nghĩa {fmt(delta(first.meaning, latest.meaning))},
              đọc thanh {fmt(delta(first.speaking, latest.speaking))}.
            </p>
          )}
          {step === 'done' && <p className="lesson-ok">Đã lưu lần làm này. Hẹn 4 tuần nữa làm lại nhé.</p>}
          <p className="lesson-hint">
            {due
              ? history.length
                ? 'Đã đủ 4 tuần: nên làm lại hôm nay.'
                : 'Chưa có mốc nào. Làm lần đầu mất khoảng 5 phút.'
              : 'Chưa đến hẹn 4 tuần; vẫn làm được nhưng kết quả gần nhau sẽ ít nói lên điều gì.'}
          </p>
          <button type="button" className="learning-primary" onClick={start}>
            {history.length ? 'Làm lại bài kiểm tra mốc' : 'Làm bài kiểm tra mốc lần đầu'}
          </button>
        </>
      )}

      {step === 'listening' && (
        <div className="benchmark-item">
          <p className="lesson-count">
            Phần 1 · Nghe chọn thanh · {index + 1}/{DATA.listening.length}
          </p>
          <p>Bấm nghe, rồi chọn thanh bạn nghe được. Chỉ nghe, không hiện chữ.</p>
          <button
            type="button"
            className="lesson-secondary"
            disabled={audio.playing}
            onClick={() => void audio.play(DATA.listening[index].word)}
          >
            🔊 Nghe
          </button>
          <div className="reading-options">
            {TONE_OPTIONS.map((tone) => (
              <button key={tone} type="button" onClick={() => answerListening(tone)}>
                Thanh {tone}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'meaning' && (
        <div className="benchmark-item">
          <p className="lesson-count">
            Phần 2 · Chữ này nghĩa gì · {index + 1}/{DATA.meaning.length}
          </p>
          <p className="lesson-word">{DATA.meaning[index].word}</p>
          <div className="reading-options">
            {DATA.meaning[index].options.map((option, oi) => (
              <button key={oi} type="button" onClick={() => answerMeaning(oi)}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'speaking' && (
        <div className="benchmark-item">
          <p className="lesson-count">
            Phần 3 · Đọc to · {index + 1}/{DATA.speaking.length}
          </p>
          <p className="lesson-word">
            {DATA.speaking[index].word} <small>{DATA.speaking[index].pinyin}</small>
          </p>
          <p className="lesson-hint">
            Bấm ghi rồi đọc từ này; {teacher.vi} chấm thanh từng chữ bằng máy. Chữ không chắc sẽ không tính.
            {!localStt && ' Chưa có nhận dạng trên máy: phần này chỉ ghi âm, không chấm được.'}
          </p>
          <div className="lesson-actions">
            <button type="button" className="learning-primary" onClick={() => void record()}>
              {handle ? (phase === 'transcribing' ? 'Đang chấm…' : '■ Dừng') : '🎙 Ghi'}
            </button>
            <button type="button" className="lesson-secondary" onClick={skipSpeaking} disabled={Boolean(handle)}>
              Bỏ qua chữ này
            </button>
          </div>
          {note && <p className="lesson-hint">{note}</p>}
        </div>
      )}
    </section>
  );
}

function fmt(value: number | null) {
  if (value === null) return '—';
  return value > 0 ? `+${value} điểm` : value < 0 ? `${value} điểm` : 'không đổi';
}
