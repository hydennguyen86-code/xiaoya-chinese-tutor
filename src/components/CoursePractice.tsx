import { SlowListen } from './ListeningControls';
import { speakBrowser } from '../lib/browserVoice';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTts } from '../lib/api';
import { exerciseFingerprint, gradeListening, speechText } from '../lib/coursePractice';
import type { LessonContent, ListeningExercise, SpeakingExercise } from '../lib/lessonApi';
import type { VoicePhase } from '../lib/voiceInput';
import { MicButton } from './LessonWidgets';

interface Props {
  content: LessonContent;
  learnerId: string;
  voice: string;
  ask: () => Promise<string>;
  micReady: boolean;
  voicePhase: VoicePhase | null;
  onBusy: (busy: boolean) => void;
}
interface StoredListening {
  answers: number[];
  submitted: boolean;
  plays: number;
}
function load(key: string, count: number): StoredListening {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (raw && Array.isArray(raw.answers))
      return {
        answers: Array.from({ length: count }, (_, i) => (Number.isInteger(raw.answers[i]) ? raw.answers[i] : -1)),
        submitted: Boolean(raw.submitted),
        plays: Number.isFinite(raw.plays) ? Math.max(0, raw.plays) : 0,
      };
  } catch {
    /* Start fresh when storage isn't available. */
  }
  return { answers: Array(count).fill(-1), submitted: false, plays: 0 };
}
export function CoursePractice(props: Props) {
  const [checkpoint, setCheckpoint] = useState(false);
  const content = props.content;
  const listening = checkpoint ? (content.checkpoint?.listening ?? []) : content.listening ? [content.listening] : [];
  const speaking = checkpoint ? (content.checkpoint?.speaking ?? []) : (content.speaking ?? []);
  const version = exerciseFingerprint([content.listening, content.speaking, content.checkpoint]);
  const prefix = `xiaoya.coursework.v1:${props.learnerId}:${content.volumeId}:${content.lessonNo}:${content.day}:${checkpoint ? 'exam' : 'lesson'}:${version}`;
  return (
    <section className="course-practice">
      <h3>Nghe hiểu và luyện nói · {content.targetLevel}</h3>
      <p className="lesson-hint">
        Bài tự soạn ưu tiên ứng dụng. Nghe bằng giọng tổng hợp; có thể cần mạng nếu dùng giọng Edge. Điểm bài này không quy đổi sang điểm
        HSK.
      </p>
      {content.checkpoint && (
        <button type="button" className="lesson-secondary" onClick={() => setCheckpoint((v) => !v)}>
          {checkpoint ? 'Về bài luyện của buổi' : content.checkpoint.title}
        </button>
      )}
      {checkpoint && (
        <p>
          {content.checkpoint?.instructions} Thời lượng gợi ý: {content.checkpoint?.practiceMinutes} phút.
        </p>
      )}
      {content.pronunciation && !checkpoint && (
        <PronunciationCard sounds={content.pronunciation} voice={props.voice} onBusy={props.onBusy} />
      )}
      <div key={prefix}>
        {listening.map((exercise, index) => (
          <ListeningCard
            key={`${prefix}:l${index}`}
            exercise={exercise}
            storageKey={`${prefix}:l${index}`}
            voice={props.voice}
            onBusy={props.onBusy}
          />
        ))}
        {speaking.map((exercise, index) => (
          <SpeakingCard
            key={`${prefix}:s${index}`}
            {...props}
            exercise={exercise}
            storageKey={`${prefix}:s${index}`}
            listeningText={listening[0]?.transcript ?? ''}
          />
        ))}
      </div>
    </section>
  );
}
let stopCurrentCourseAudio: (() => void) | null = null;

function useAudio(voice: string, onBusy: (busy: boolean) => void) {
  const player = useRef<HTMLAudioElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const url = useRef('');
  const alive = useRef(true);
  const [playing, setPlaying] = useState(false);
  const loading = useRef(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const stop = useCallback(() => {
    request.current?.abort();
    player.current?.pause();
    player.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    loading.current = false;
    setPlaying(false);
    onBusy(false);
    if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
  }, [onBusy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
      onBusy(false);
    };
  }, []);
  async function play(text: string, onStarted?: () => void) {
    if (loading.current) {
      stop();
      return;
    }
    stopCurrentCourseAudio?.();
    stopCurrentCourseAudio = stop;
    loading.current = true;
    const controller = new AbortController();
    request.current = controller;
    setPlaying(true);
    setError('');
    onBusy(true);
    try {
      const result = await fetchTts(speechText(text), voice, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (result.browserText) {
        setProvider('Giọng dự phòng trình duyệt; tuỳ giọng có thể dùng mạng.');
        await speakBrowser(result.browserText, result.browserLocale ?? 'zh-CN', controller.signal, onStarted, result.browserRate);
        if (alive.current && !controller.signal.aborted) {
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
        return;
      }
      const bytes = Uint8Array.from(atob(result.audioBase64), (ch) => ch.charCodeAt(0));
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const audio = new Audio(url.current);
      player.current = audio;
      audio.onended = () => {
        if (alive.current) {
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
      };
      audio.onerror = () => {
        if (alive.current) {
          setError('Không phát được âm thanh. Hãy thử lại.');
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
      };
      await audio.play();
      if (!alive.current || controller.signal.aborted) {
        audio.pause();
        return;
      }
      setProvider(result.fallbackReason ?? `Giọng ${result.provider}`);
      onStarted?.();
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Chưa phát được.');
        loading.current = false;
        setPlaying(false);
        onBusy(false);
      }
    }
  }
  return { play, stop, playing, error, provider };
}
function ListeningCard({
  exercise,
  storageKey,
  voice,
  onBusy,
}: {
  exercise: ListeningExercise;
  storageKey: string;
  voice: string;
  onBusy: (busy: boolean) => void;
}) {
  const [state, setState] = useState(() => load(storageKey, exercise.questions.length));
  const audio = useAudio(voice, onBusy);
  const result = gradeListening(exercise, state.answers);
  function save(next: StoredListening) {
    setState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep the in-memory answer. */
    }
  }
  const canPlay = state.submitted || state.plays < exercise.playLimit;
  return (
    <article className="lesson-card">
      <h4>{exercise.title}</h4>
      <p>
        Nghe tối đa {exercise.playLimit} lần trước khi nộp. Đã nghe: {state.plays}. Đoạn hội thoại được đọc bằng một giọng, có ngắt lượt.
      </p>
      <button
        type="button"
        className="lesson-secondary"
        disabled={!canPlay && !audio.playing}
        onClick={() => void audio.play(exercise.transcript, () => save({ ...state, plays: state.plays + 1 }))}
      >
        {audio.playing ? 'Dừng âm thanh' : state.submitted ? 'Nghe lại để ôn' : 'Nghe đoạn hội thoại / đoạn văn'}
      </button>
      <SlowListen
        disabled={!canPlay || audio.playing}
        onPlay={() => audio.play(exercise.transcript, () => save({ ...state, plays: state.plays + 1 }))}
      />
      {audio.error && (
        <p role="alert" className="lesson-bad">
          {audio.error}
        </p>
      )}
      {audio.provider && <p className="lesson-hint">{audio.provider}</p>}
      {exercise.questions.map((question, index) => (
        <fieldset key={index} disabled={state.submitted}>
          <legend>
            {index + 1}. {question.prompt}
          </legend>
          {question.options.map((option, choice) => (
            <label className="course-choice" key={choice}>
              <input
                type="radio"
                name={`${storageKey}:${index}`}
                checked={state.answers[index] === choice}
                onChange={() => {
                  const answers = [...state.answers];
                  answers[index] = choice;
                  save({ ...state, answers });
                }}
              />
              {String.fromCharCode(65 + choice)}. {option}
            </label>
          ))}
          {state.submitted && (
            <p className={result.items[index].correct ? 'lesson-ok' : 'lesson-bad'}>
              {result.items[index].correct ? 'Đúng.' : 'Chưa đúng.'} Đáp án: {result.items[index].answer}. {result.items[index].explanation}
            </p>
          )}
        </fieldset>
      ))}
      {!state.submitted ? (
        <button
          type="button"
          className="lesson-primary"
          disabled={state.answers.some((a) => a < 0) || audio.playing}
          onClick={() => save({ ...state, submitted: true })}
        >
          Nộp bài nghe
        </button>
      ) : (
        <>
          <p className="lesson-ok">
            Nghe hiểu: {result.correct}/{result.total} câu đúng.
          </p>
          <details>
            <summary>Bản chép lời, pinyin và dịch nghĩa để ôn</summary>
            <p lang="zh">{exercise.transcript}</p>
            {exercise.pinyin && <p>{exercise.pinyin}</p>}
            <p>{exercise.translation}</p>
          </details>
          <button
            type="button"
            className="lesson-secondary"
            onClick={() => {
              audio.stop();
              save({ answers: Array(exercise.questions.length).fill(-1), submitted: false, plays: 0 });
            }}
          >
            Luyện lại từ đầu (xóa đáp án lần này)
          </button>
        </>
      )}
    </article>
  );
}
function SpeakingCard({
  exercise,
  storageKey,
  listeningText,
  ...props
}: Props & { exercise: SpeakingExercise; storageKey: string; listeningText: string }) {
  const [answer, setAnswer] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });
  const [reveal, setReveal] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const audio = useAudio(props.voice, props.onBusy);
  const phase = useRef<'prepare' | 'answer'>('prepare');
  useEffect(() => {
    if (seconds === null) return;
    if (seconds <= 0) {
      if (phase.current === 'prepare') {
        phase.current = 'answer';
        setSeconds(exercise.responseSeconds);
      }
      return;
    }
    const timer = window.setTimeout(() => setSeconds((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, exercise.responseSeconds]);
  const source = exercise.audioText || (exercise.kind === 'retell' ? listeningText : exercise.text);
  return (
    <article className="lesson-card">
      <h4>
        Luyện nói:{' '}
        {
          {
            repeat: 'Nghe và nhắc lại',
            retell: 'Nghe rồi kể lại',
            read: 'Đọc thành tiếng',
            answer: 'Trả lời câu hỏi',
            opinion: 'Trình bày quan điểm',
          }[exercise.kind]
        }
      </h4>
      <p lang="zh">{exercise.prompt}</p>
      {exercise.promptVi && <p>{exercise.promptVi}</p>}
      {exercise.kind === 'read' && (
        <p className="lesson-example" lang="zh">
          {exercise.text}
        </p>
      )}
      <p>
        Chuẩn bị {exercise.prepareSeconds} giây · nói khoảng {exercise.responseSeconds} giây. Đồng hồ chỉ hỗ trợ luyện, không tự chấm độ
        trôi chảy. Với bài dài nên dùng nhận dạng cục bộ; trình duyệt có thể dừng sau một câu.
      </p>
      <div className="lesson-actions">
        {source && <SlowListen onPlay={() => audio.play(source)} disabled={audio.playing} />}
        {source && (
          <button type="button" className="lesson-secondary" onClick={() => void audio.play(source)}>
            {audio.playing ? 'Dừng âm thanh' : 'Nghe lời đọc / đoạn để kể lại'}
          </button>
        )}
        <button
          type="button"
          className="lesson-secondary"
          onClick={() => {
            phase.current = 'prepare';
            setSeconds(exercise.prepareSeconds);
          }}
        >
          Bắt đầu tính giờ
        </button>
        {seconds !== null && (
          <span role="timer">
            {phase.current === 'prepare' ? 'Chuẩn bị' : 'Nói'}: {seconds}s
          </span>
        )}
        <MicButton
          micReady={props.micReady && !audio.playing}
          voicePhase={props.voicePhase}
          onClick={() => {
            stopCurrentCourseAudio?.();
            audio.stop();
            void props.ask().then((text) => {
              if (text) {
                setAnswer(text);
                try {
                  localStorage.setItem(storageKey, text);
                } catch {}
              }
            });
          }}
        />
      </div>
      {audio.error && (
        <p role="alert" className="lesson-bad">
          {audio.error}
        </p>
      )}
      {answer && <p>Bản máy nhận dạng (có thể sai): {answer}</p>}
      <button type="button" className="lesson-secondary" onClick={() => setReveal((v) => !v)}>
        {reveal ? 'Ẩn gợi ý' : 'Xem dàn ý và tự đối chiếu sau khi nói'}
      </button>
      {reveal && (
        <>
          <p>{exercise.reference}</p>
          {exercise.sampleZh && (
            <>
              <p lang="zh">{exercise.sampleZh}</p>
              <p>{exercise.sampleVi}</p>
              <button type="button" className="lesson-secondary" onClick={() => void audio.play(exercise.sampleZh!)}>
                {audio.playing ? 'Dừng âm thanh' : 'Nghe bài nói mẫu'}
              </button>
            </>
          )}
          <ul>
            {exercise.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="lesson-hint">
            Đây là gợi ý tự đối chiếu; nói khác câu mẫu vẫn có thể đúng. Nhận dạng ra chữ không chứng minh phát âm chuẩn.
          </p>
        </>
      )}
    </article>
  );
}

function PronunciationCard({
  sounds,
  voice,
  onBusy,
}: {
  sounds: NonNullable<LessonContent['pronunciation']>;
  voice: string;
  onBusy: (busy: boolean) => void;
}) {
  const audio = useAudio(voice, onBusy);
  return (
    <article className="lesson-card">
      <h4>Nghe thanh điệu và biến điệu</h4>
      <p>Nghe từng mục, so hướng lên/xuống rồi thử nhắc lại. Đây là bài nhận âm, chưa cần thuộc nghĩa bốn từ đầu.</p>
      {sounds.map((sound) => (
        <p key={sound.text}>
          <SlowListen disabled={audio.playing} onPlay={() => audio.play(sound.text)} />
          <button type="button" className="lesson-secondary" disabled={audio.playing} onClick={() => void audio.play(sound.text)}>
            {sound.text} · {sound.pinyin}
          </button>{' '}
          {sound.hint}
        </p>
      ))}
      {audio.playing && (
        <button type="button" onClick={audio.stop}>
          Dừng âm thanh
        </button>
      )}
      {audio.error && (
        <p role="alert" className="lesson-bad">
          {audio.error}
        </p>
      )}
    </article>
  );
}
