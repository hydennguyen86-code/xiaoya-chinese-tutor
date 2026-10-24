import { CoursePractice } from './CoursePractice';
import { CommunicationTask } from './CommunicationTask';
import { MicButton, Han } from './LessonWidgets';
import { rememberLesson, loadAssessment, saveAssessment } from '../lib/assessment';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AvatarApi } from '../lib/avatarApi';
import { fetchCorrections, streamChat } from '../lib/api';
import type { Learner } from '../lib/learners';
import { dueWords, recordLearningCorrections, recordLearningTurn, reviewWord, topMistakes } from '../lib/learning';
import { fetchLessonContent, fetchSyllabus, type LessonContent } from '../lib/lessonApi';
import {
  SECTIONS,
  beginSession,
  completeSession,
  planToday,
  remainingMs,
  sectionBudgetMs as baseSectionBudgetMs,
  type DialogLine,
  type LessonProgress,
  type Pointer,
  type SessionState,
  type Syllabus,
} from '../lib/lessonPlan';
import { loadLessonProgress, saveLessonProgress } from '../lib/lessonStore';
import { dayKey } from '../lib/storage';
import { ToneFeedback } from './ToneFeedback';
import {
  bareChinese,
  listen,
  voiceSupported,
  type ToneReport,
  type VoiceHandle,
  type VoicePhase,
  type VoiceResult,
} from '../lib/voiceInput';
import type { Correction, LearningProfile, Level } from '../types';

interface DailyLessonProps {
  learner: Learner;
  level: Level;
  provider: string;
  model: string;
  voice: string;
  localStt: boolean;
  getAvatar: () => AvatarApi | null;
  learning: LearningProfile;
  onLearningUpdate: (update: (previous: LearningProfile) => LearningProfile) => void;
  onClose: () => void;
  onLevelChange?: (level: Level) => void;
}

type Screen =
  | { kind: 'loading'; note?: string }
  | { kind: 'error'; message: string }
  | { kind: 'done-today'; next: Pointer | null }
  | { kind: 'finished' }
  | { kind: 'ready' }
  | { kind: 'completed'; next: Pointer | null };

const AUTO_ADVANCE_GRACE_MS = 20_000;

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function lessonLabel(syllabus: Syllabus | null, pointer: Pointer | null) {
  if (!syllabus || !pointer) return '';
  const volume = syllabus.volumes.find((v) => v.id === pointer.volumeId);
  const lesson = volume?.lessons.find((l) => l.no === pointer.lessonNo);
  return lesson ? `${volume?.title} · Bài ${lesson.no}: ${lesson.title} · buổi ${pointer.day}/${lesson.days}` : '';
}

export function DailyLesson(props: DailyLessonProps) {
  const { learner, level, provider, model, voice, localStt, getAvatar, onLearningUpdate, onClose } = props;
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(() => loadLessonProgress(learner.id));
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase | null>(null);
  const [notice, setNotice] = useState('');
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const voiceRef = useRef<VoiceHandle | null>(null);
  const loadRequest = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy || voicePhase !== null;

  const save = useCallback(
    (next: LessonProgress) => {
      progressRef.current = next;
      setProgress(next);
      saveLessonProgress(learner.id, next);
      saveLessonProgress(`${learner.id}:${next.volumeId}`, next);
    },
    [learner.id],
  );

  const updateSession = useCallback(
    (change: (session: SessionState) => SessionState) => {
      const current = progressRef.current;
      if (!current?.current) return;
      save({ ...current, current: change(current.current) });
    },
    [save],
  );

  // ---- load the outline, decide today's session, fetch its material ----
  const load = useCallback(async () => {
    loadRequest.current?.abort();
    const request = new AbortController();
    loadRequest.current = request;
    setScreen({ kind: 'loading' });
    try {
      const outline = await fetchSyllabus(request.signal);
      if (request.signal.aborted) return;
      setSyllabus(outline);
      const today = dayKey();
      const stored = loadLessonProgress(learner.id);
      const plan = planToday(stored, outline, level, today);
      if (plan.kind === 'done-today') {
        setScreen({ kind: 'done-today', next: plan.next });
        return;
      }
      if (plan.kind === 'finished') {
        setScreen({ kind: 'finished' });
        return;
      }
      const pointer = plan.kind === 'resume' ? plan.session : plan.pointer;
      setScreen({
        kind: 'loading',
        note: outline.volumes.find((v) => v.id === pointer.volumeId)?.authored
          ? 'Đang mở bài cố định trong lộ trình…'
          : 'Misu đang soạn bài cho hôm nay. Lần đầu có thể mất khoảng 20–40 giây.',
      });
      const material = await fetchLessonContent(
        {
          provider,
          model,
          volumeId: pointer.volumeId,
          lessonNo: pointer.lessonNo,
          day: pointer.day,
          level,
        },
        request.signal,
      );
      if (request.signal.aborted) return;
      setContent(material);
      save(plan.kind === 'resume' ? (stored as LessonProgress) : beginSession(stored, outline, level, plan.pointer, today));
      setScreen({ kind: 'ready' });
    } catch (error) {
      if (request.signal.aborted) return;
      setScreen({ kind: 'error', message: error instanceof Error ? error.message : 'Không mở được bài học.' });
    }
  }, [learner.id, level, provider, model, save]);

  useEffect(() => {
    void load();
    return () => loadRequest.current?.abort();
  }, [load]);

  useEffect(
    () => () => {
      voiceRef.current?.cancel();
      getAvatar()?.stopSpeech();
    },
    [getAvatar],
  );

  const lessonBudget = (content?.authored ? (content.recommendedMinutes ?? 20) : 20) * 60000;
  const sectionBudgetMs = (index: number) => (baseSectionBudgetMs(index) * lessonBudget) / (20 * 60000);
  const session = progress?.current ?? null;
  const section = session?.section ?? 0;

  // ---- timer: counts only while the lesson is open, visible and not paused ----
  useEffect(() => {
    if (screen.kind !== 'ready' || paused) return undefined;
    let ticks = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const current = progressRef.current;
      if (!current?.current) return;
      const s = current.current;
      const elapsedMs = [...s.elapsedMs];
      elapsedMs[s.section] = (elapsedMs[s.section] || 0) + 1000;
      const next = { ...current, current: { ...s, elapsedMs } };
      progressRef.current = next;
      setProgress(next);
      ticks += 1;
      if (ticks % 5 === 0) saveLessonProgress(learner.id, next);
      // past the section budget plus a grace period and idle: move on
      if (
        !content?.authored &&
        s.section < SECTIONS.length - 1 &&
        elapsedMs[s.section] > sectionBudgetMs(s.section) + AUTO_ADVANCE_GRACE_MS &&
        !busyRef.current
      ) {
        goToSection(s.section + 1);
        setNotice(`Hết giờ phần trước, chuyển sang "${SECTIONS[s.section + 1].title}".`);
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      if (progressRef.current) saveLessonProgress(learner.id, progressRef.current);
    };
    // goToSection is stable through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.kind, paused, learner.id, content?.authored]);

  // ---- shared helpers for the sections ----
  const say = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      getAvatar()?.speakAll(text, voice, 'happy', 'none');
    },
    [getAvatar, voice],
  );

  // record one answer; with a target text and local speech-to-text, its tones are checked too
  const listenFor = useCallback(
    async (pronounce?: string): Promise<VoiceResult> => {
      if (voiceRef.current) {
        voiceRef.current.stop();
        return { text: '', tones: null };
      }
      getAvatar()?.stopSpeech();
      const handle = listen({
        local: localStt,
        onPhase: setVoicePhase,
        learnerId: learner.id,
        pronounce,
        maxMs: content?.targetLevel === 'HSK5' ? 125000 : 45000,
        silenceMs: content?.targetLevel === 'HSK5' ? 3000 : 1600,
      });
      voiceRef.current = handle;
      try {
        return await handle.details;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Không nghe được. Thử lại nhé.');
        return { text: '', tones: null };
      } finally {
        voiceRef.current = null;
        setVoicePhase(null);
      }
    },
    [getAvatar, localStt, learner.id],
  );
  const ask = useCallback(async () => (await listenFor()).text, [listenFor]);
  const read = useCallback((target: string) => listenFor(target), [listenFor]);

  const stopVoice = useCallback(() => voiceRef.current?.stop(), []);

  function goToSection(index: number) {
    voiceRef.current?.cancel();
    getAvatar()?.stopSpeech();
    updateSession((s) => ({
      ...s,
      section: Math.min(index, SECTIONS.length - 1),
      item: 0,
      dialog: SECTIONS[index]?.id === 'freetalk' ? [] : s.dialog,
    }));
  }

  const finish = useCallback(() => {
    const current = progressRef.current;
    if (!current || !syllabus) return;
    if (content) rememberLesson(learner.id, content);
    const done = completeSession(current, syllabus, dayKey());
    save(done);
    const next = done.finished ? null : { volumeId: done.volumeId, lessonNo: done.lessonNo, day: done.day };
    setScreen({ kind: 'completed', next });
    // prepare the next session's material in the background
    if (next) void fetchLessonContent({ provider, model, ...next, level }).catch(() => {});
  }, [syllabus, save, provider, model, level, content, learner.id]);

  function chooseCourse(volumeId: string, lessonNo?: number, day = 1) {
    if (!syllabus) return;
    const volume = syllabus.volumes.find((v) => v.id === volumeId);
    if (!volume?.lessons.length) return;
    voiceRef.current?.cancel();
    getAvatar()?.stopSpeech();
    setBusy(false);
    const current = progressRef.current;
    if (current) saveLessonProgress(`${learner.id}:${current.volumeId}`, current);
    const remembered = loadLessonProgress(`${learner.id}:${volumeId}`);
    const pointer = {
      volumeId,
      lessonNo: lessonNo ?? remembered?.lessonNo ?? volume.lessons[0].no,
      day: lessonNo ? day : (remembered?.day ?? 1),
    };
    const base = current ?? beginSession(null, syllabus, level, pointer, dayKey());
    save({ ...base, ...pointer, current: lessonNo ? null : (remembered?.current ?? null), finished: false, lastCompletedDate: '' });
    const nextLevel: Level = volume.targetLevel === 'HSK5' ? 'HSK5-6' : volume.targetLevel === 'HSK1' ? 'HSK1-2' : level;
    if (nextLevel !== level && props.onLevelChange) props.onLevelChange(nextLevel);
    else void load();
  }
  const currentVolume = syllabus?.volumes.find((v) => v.id === progress?.volumeId);
  const coursePicker = syllabus && (
    <div className="course-picker">
      <label>
        Lộ trình{' '}
        <select aria-label="Lộ trình học" value={currentVolume?.id ?? ''} onChange={(event) => chooseCourse(event.target.value)}>
          {!currentVolume && <option value="">Chọn lộ trình</option>}
          {syllabus.volumes.map((volume) => (
            <option key={volume.id} value={volume.id}>
              {volume.title}
            </option>
          ))}
        </select>
      </label>
      {currentVolume && (
        <label>
          Bài{' '}
          <select
            aria-label="Chọn bài trong lộ trình"
            value={progress?.lessonNo ?? 1}
            onChange={(event) => chooseCourse(currentVolume.id, Number(event.target.value))}
          >
            {currentVolume.lessons.map((lesson) => (
              <option key={lesson.no} value={lesson.no}>
                {lesson.no}. {lesson.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {currentVolume && (
        <label>
          Buổi{' '}
          <select
            aria-label="Chọn buổi học"
            value={progress?.day ?? 1}
            onChange={(event) => chooseCourse(currentVolume.id, progress?.lessonNo ?? 1, Number(event.target.value))}
          >
            {Array.from({ length: currentVolume.lessons.find((lesson) => lesson.no === progress?.lessonNo)?.days ?? 2 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
  const teachingLevel: Level = content?.targetLevel === 'HSK5' ? 'HSK5-6' : content?.targetLevel === 'HSK1' ? 'HSK1-2' : level;
  const handleCourseBusy = useCallback(
    (value: boolean) => {
      if (value) getAvatar()?.stopSpeech();
      setBusy(value);
    },
    [getAvatar],
  );
  const micReady = voiceSupported(localStt);

  // ---------------------------------------------------------------- render
  if (screen.kind !== 'ready' || !session || !content) {
    return (
      <section className="lesson-panel">
        <LessonTop title="Bài hôm nay" subtitle={learner.name} onClose={onClose} />
        {coursePicker}
        <div className="lesson-state">
          {screen.kind === 'loading' && (
            <>
              <div className="lesson-spinner" aria-hidden="true" />
              <p>{screen.note || 'Đang mở bài học…'}</p>
            </>
          )}
          {screen.kind === 'error' && (
            <>
              <p className="lesson-error">{screen.message}</p>
              <button className="lesson-primary" type="button" onClick={() => void load()}>
                Thử lại
              </button>
            </>
          )}
          {screen.kind === 'done-today' && (
            <>
              <h3>Hôm nay bạn đã học xong rồi</h3>
              <p>Chuỗi ngày học: {progress?.streak ?? 0} ngày.</p>
              {screen.next && <p>Buổi tới: {lessonLabel(syllabus, screen.next)}</p>}
              <button className="lesson-primary" type="button" onClick={onClose}>
                Về trò chuyện
              </button>
            </>
          )}
          {screen.kind === 'completed' && (
            <>
              <h3>Hoàn thành buổi học</h3>
              <p>
                Chuỗi ngày học: {progress?.streak ?? 0} ngày · đã học {progress?.completed ?? 0} buổi.
              </p>
              {screen.next ? <p>Ngày mai: {lessonLabel(syllabus, screen.next)}</p> : <p>Bạn đã học hết giáo trình.</p>}
              <button className="lesson-primary" type="button" onClick={onClose}>
                Về trò chuyện
              </button>
            </>
          )}
          {screen.kind === 'finished' && (
            <>
              <h3>Bạn đã học hết giáo trình</h3>
              <button className="lesson-primary" type="button" onClick={onClose}>
                Về trò chuyện
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  const sectionInfo = SECTIONS[section];
  const sectionElapsed = session.elapsedMs[section] || 0;
  const overBudget = sectionElapsed > sectionBudgetMs(section);
  const shared = {
    content,
    session,
    say,
    ask,
    read,
    stopVoice,
    voicePhase,
    micReady,
    busy,
    setBusy,
    updateSession,
    onLearningUpdate,
    setNotice,
  };

  return (
    <section className="lesson-panel">
      <LessonTop
        title={`Bài ${content.lessonNo}: ${content.lessonTitle}`}
        subtitle={`${content.volumeTitle} · buổi ${content.day}/${content.days} · ${learner.name}`}
        onClose={() => {
          if (progressRef.current) saveLessonProgress(learner.id, progressRef.current);
          onClose();
        }}
      />
      {coursePicker}
      <p className={`lesson-ref${content.placeholder ? ' is-warning' : ''}`}>
        {content.authored
          ? `${content.editorialStatus}. Thời lượng gợi ý ${content.recommendedMinutes} phút; tự chuyển phần khi sẵn sàng.`
          : content.placeholder
            ? 'Đang dùng chủ đề tạm vì chưa có mục lục sách 《体验汉语口语》. Nội dung do Misu tự soạn.'
            : `Tham khảo: Bài ${content.lessonNo}, ${content.volumeTitle}${content.pages ? `, trang ${content.pages}` : ''} trong sách 《体验汉语口语》. Nội dung luyện tập do Misu tự soạn.`}
      </p>

      {content.learningNotes && (
        <details className="lesson-card">
          <summary>Kiến thức cần biết và cách học buổi này</summary>
          <ul>
            {content.learningNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="lesson-timeline" role="list">
        {SECTIONS.map((item, index) => {
          const spent = session.elapsedMs[index] || 0;
          const pct = Math.min(100, (spent / sectionBudgetMs(index)) * 100);
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={`lesson-step${index === section ? ' is-current' : ''}${index < section ? ' is-done' : ''}`}
              onClick={() => goToSection(index)}
              title={`${item.title} · khoảng ${Math.round(sectionBudgetMs(index) / 60000)} phút`}
            >
              <span className="lesson-step-bar">
                <span style={{ width: `${index < section ? 100 : pct}%` }} />
              </span>
              <span className="lesson-step-name">{item.title}</span>
            </button>
          );
        })}
      </div>

      <div className="lesson-clockrow">
        <span>
          <strong>{sectionInfo.title}</strong> · còn {clock(sectionBudgetMs(section) - sectionElapsed)}
        </span>
        <span>Cả buổi còn {clock(Math.max(0, lessonBudget - session.elapsedMs.reduce((a, b) => a + b, 0)))}</span>
      </div>
      {overBudget && section < SECTIONS.length - 1 && (
        <p className="lesson-notice">Đã hết thời gian phần này. Làm nốt câu đang dở rồi bấm "Phần tiếp".</p>
      )}
      {notice && (
        <p className="lesson-notice" onClick={() => setNotice('')}>
          {notice}
        </p>
      )}

      <div className="lesson-body">
        {content.reviewed && <p className="lesson-hint">Đã duyệt bởi {content.review?.reviewer}</p>}
        {sectionInfo.id === 'review' && <ReviewSection {...shared} learning={props.learning} />}
        {sectionInfo.id === 'vocab' && <VocabSection {...shared} />}
        {sectionInfo.id === 'patterns' && <PatternSection {...shared} provider={provider} model={model} />}
        {(sectionInfo.id === 'roleplay' || sectionInfo.id === 'freetalk') && (
          <>
            {content.authored && sectionInfo.id === 'roleplay' && (
              <CoursePractice
                content={content}
                learnerId={learner.id}
                voice={voice}
                ask={shared.ask}
                micReady={micReady}
                voicePhase={voicePhase}
                onBusy={handleCourseBusy}
              />
            )}
            {model ? (
              <DialogSection {...shared} mode={sectionInfo.id} provider={provider} model={model} level={teachingLevel} />
            ) : (
              <p className="lesson-notice">
                Bài nghe và luyện nói cố định vẫn học được. Chọn model trong Cài đặt để nhập vai tương tác với Misu.
              </p>
            )}
          </>
        )}
        {sectionInfo.id === 'summary' && (
          <>
            <CommunicationTask
              task={content.roleplay}
              provider={provider}
              model={model}
              level={teachingLevel}
              ask={shared.ask}
              say={say}
              micReady={micReady}
              voicePhase={voicePhase}
              onComplete={(result) => {
                const data = loadAssessment(learner.id);
                saveAssessment(learner.id, {
                  ...data,
                  tasks: [...data.tasks, { date: Date.now(), task: content.roleplay, result }].slice(-90),
                });
              }}
            />
            <SummarySection session={session} content={content} onFinish={finish} />
          </>
        )}
      </div>

      <div className="lesson-controls">
        <button type="button" className="lesson-secondary" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Tiếp tục' : 'Tạm dừng'}
        </button>
        {section < SECTIONS.length - 1 && (
          <button type="button" className="lesson-primary" onClick={() => goToSection(section + 1)}>
            Phần tiếp: {SECTIONS[section + 1].title}
          </button>
        )}
      </div>
      {paused && <div className="lesson-paused">Đang tạm dừng · đồng hồ đứng yên</div>}
    </section>
  );
}

// ------------------------------------------------------------------ pieces

function LessonTop({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <header className="lesson-top">
      <div>
        <p className="lesson-kicker">Bài hôm nay · Nghe và nói</p>
        <h2>{title}</h2>
        <p className="lesson-sub">{subtitle}</p>
      </div>
      <button type="button" className="lesson-secondary" onClick={onClose}>
        Thoát
      </button>
    </header>
  );
}

interface SharedProps {
  content: LessonContent;
  session: SessionState;
  say: (text: string) => void;
  ask: () => Promise<string>;
  read: (target: string) => Promise<VoiceResult>;
  stopVoice: () => void;
  voicePhase: VoicePhase | null;
  micReady: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  updateSession: (change: (session: SessionState) => SessionState) => void;
  onLearningUpdate: (update: (previous: LearningProfile) => LearningProfile) => void;
  setNotice: (text: string) => void;
}

// 1. Warm-up review: words due for this learner, plus a recurring mistake or two.
function ReviewSection(props: SharedProps & { learning: LearningProfile }) {
  const { session, say, ask, voicePhase, micReady, updateSession, onLearningUpdate } = props;
  const items = useMemo(() => {
    const words = dueWords(props.learning)
      .slice(0, 6)
      .map((w) => ({ kind: 'word' as const, word: w.word, pinyin: w.pinyin, meaning: w.meaning }));
    const mistakes = topMistakes(props.learning, 2).map((m) => ({
      kind: 'mistake' as const,
      original: m.original,
      corrected: m.corrected,
      explanation: m.explanation,
    }));
    return [...words, ...mistakes];
    // fixed when the section opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [result, setResult] = useState<{ ok: boolean; heard: string } | null>(null);
  const item = items[session.item];

  if (!items.length) {
    return (
      <div className="lesson-card">
        <p>Hôm nay chưa có từ hay lỗi nào đến hạn ôn. Bạn sang phần Từ mới nhé.</p>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="lesson-card">
        <p>
          Đã ôn xong {session.stats.reviewed} mục, nhớ {session.stats.remembered}. Sang phần Từ mới nhé.
        </p>
      </div>
    );
  }

  const answer = async () => {
    const heard = await ask();
    if (!heard) return;
    const target = item.kind === 'word' ? item.word : item.corrected;
    const ok = bareChinese(heard).includes(bareChinese(target));
    setResult({ ok, heard });
    if (item.kind === 'word') onLearningUpdate((p) => reviewWord(p, item.word, ok));
    updateSession((s) => ({ ...s, stats: { ...s.stats, reviewed: s.stats.reviewed + 1, remembered: s.stats.remembered + (ok ? 1 : 0) } }));
  };
  const skip = () => {
    if (item.kind === 'word' && !result) onLearningUpdate((p) => reviewWord(p, item.word, false));
    if (!result) updateSession((s) => ({ ...s, stats: { ...s.stats, reviewed: s.stats.reviewed + 1 } }));
    setResult(null);
    updateSession((s) => ({ ...s, item: s.item + 1 }));
  };

  return (
    <div className="lesson-card">
      <p className="lesson-count">
        Ôn tập {session.item + 1}/{items.length}
      </p>
      {item.kind === 'word' ? (
        <>
          <p className="lesson-prompt">
            Nói bằng tiếng Trung: <strong>{item.meaning}</strong>
          </p>
          {result && (
            <p className={result.ok ? 'lesson-ok' : 'lesson-bad'}>
              {result.ok ? 'Đúng rồi!' : `Mình nghe: "${result.heard}". Đáp án:`} <Han text={item.word} pinyinText={item.pinyin} />
            </p>
          )}
        </>
      ) : (
        <>
          <p className="lesson-prompt">
            Bạn từng nói <s>{item.original}</s>. Hãy nói lại cho đúng.
          </p>
          <p className="lesson-hint">{item.explanation}</p>
          {result && (
            <p className={result.ok ? 'lesson-ok' : 'lesson-bad'}>
              {result.ok ? 'Chuẩn rồi!' : `Mình nghe: "${result.heard}". Cách nói đúng: ${item.corrected}`}
            </p>
          )}
        </>
      )}
      <div className="lesson-actions">
        <MicButton voicePhase={voicePhase} micReady={micReady} onClick={() => void answer()} />
        {result && item.kind === 'word' && (
          <button type="button" className="lesson-secondary" onClick={() => say(item.word)}>
            Nghe
          </button>
        )}
        <button type="button" className="lesson-secondary" onClick={skip}>
          {result ? 'Tiếp' : 'Không nhớ'}
        </button>
      </div>
    </div>
  );
}

// 2. New words: listen, repeat, and they go into the learner's review list.
function VocabSection(props: SharedProps) {
  const { content, session, say, read, voicePhase, micReady, updateSession, onLearningUpdate } = props;
  const word = content.vocab[session.item];
  const [heard, setHeard] = useState<({ target: string } & VoiceResult) | null>(null);

  useEffect(() => {
    setHeard(null);
    if (word) say(`${word.word}。${word.example}`);
    // speak once per card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.item]);

  if (!word) {
    return (
      <div className="lesson-card">
        <p>Xong {content.vocab.length} từ của buổi này. Các từ đã được thêm vào mục ôn tập của bạn.</p>
      </div>
    );
  }

  const readAloud = async (target: string) => {
    const result = await read(target);
    if (result.text || result.tones) setHeard({ target, ...result });
  };
  const next = () => {
    onLearningUpdate((p) =>
      recordLearningTurn(
        p,
        '',
        { corrections: [], vocab: [{ word: word.word, pinyin: word.pinyin, meaning: word.meaning }] },
        { countTurn: false },
      ),
    );
    updateSession((s) => ({ ...s, item: s.item + 1, stats: { ...s.stats, newWords: s.stats.newWords + 1 } }));
  };
  const ok = heard !== null && bareChinese(heard.text).includes(bareChinese(heard.target));

  return (
    <div className="lesson-card">
      <p className="lesson-count">
        {content.day === 1 ? 'Từ mới' : 'Ôn từ của bài'} {session.item + 1}/{content.vocab.length}
      </p>
      <p className="lesson-word">
        <Han text={word.word} pinyinText={word.pinyin} />
      </p>
      <p className="lesson-meaning">{word.meaning}</p>
      <p className="lesson-example">
        <Han text={word.example} pinyinText={word.examplePinyin} />
      </p>
      <p className="lesson-hint">{word.exampleVi}</p>
      {heard !== null && heard.text && (
        <p className={ok ? 'lesson-ok' : 'lesson-bad'}>
          {ok ? 'Mình nghe đúng chữ rồi.' : `Mình nghe thành: "${heard.text}". Nghe lại rồi thử lần nữa nhé.`}
        </p>
      )}
      {heard?.tones && <ToneFeedback report={heard.tones} audio={heard.audio} />}
      <div className="lesson-actions">
        <button type="button" className="lesson-secondary" onClick={() => say(`${word.word}。${word.example}`)}>
          Nghe lại
        </button>
        <MicButton voicePhase={voicePhase} micReady={micReady} onClick={() => void readAloud(word.word)} label="Đọc từ" />
        <MicButton voicePhase={voicePhase} micReady={micReady} onClick={() => void readAloud(word.example)} label="Đọc câu" />
        <button type="button" className="lesson-primary" onClick={next}>
          Từ tiếp theo
        </button>
      </div>
    </div>
  );
}

// 3. Sentence patterns: the learner makes their own sentence and gets it checked.
function PatternSection(props: SharedProps & { provider: string; model: string }) {
  const { content, session, say, ask, voicePhase, micReady, busy, setBusy, updateSession, onLearningUpdate, provider, model } = props;
  const pattern = content.patterns[session.item];
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{ corrections: Correction[]; missing: string[] } | null>(null);

  useEffect(() => {
    setDraft('');
    setFeedback(null);
  }, [session.item]);

  if (!pattern) {
    return (
      <div className="lesson-card">
        <p>Xong phần mẫu câu. Bạn đã đặt {session.stats.sentences} câu.</p>
      </div>
    );
  }

  const fixedParts = pattern.pattern.match(/\p{Script=Han}+/gu) ?? [];

  const check = async (sentence: string) => {
    const text = sentence.trim();
    if (!text) return;
    setBusy(true);
    try {
      const corrections = await fetchCorrections({ provider, model, text });
      const missing = fixedParts.filter((part) => !bareChinese(text).includes(part));
      setFeedback({ corrections, missing });
      if (corrections.length) onLearningUpdate((p) => recordLearningCorrections(p, text, corrections));
      updateSession((s) => ({
        ...s,
        stats: { ...s.stats, sentences: s.stats.sentences + 1, corrections: s.stats.corrections + corrections.length },
        notes: [
          ...(s.notes || []),
          ...corrections.map(({ original, corrected, explanation }) => ({ original, corrected, explanation })),
        ].slice(-20),
      }));
    } catch {
      setFeedback({ corrections: [], missing: [] });
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    const text = await ask();
    if (text) {
      setDraft(text);
      void check(text);
    }
  };

  return (
    <div className="lesson-card">
      <p className="lesson-count">
        Mẫu câu {session.item + 1}/{content.patterns.length}
      </p>
      <p className="lesson-word">{pattern.pattern}</p>
      <p className="lesson-meaning">{pattern.explanation}</p>
      <p className="lesson-example">
        <Han text={pattern.example} pinyinText={pattern.examplePinyin} />
        <button type="button" className="lesson-link" onClick={() => say(pattern.example)}>
          Nghe
        </button>
      </p>
      <p className="lesson-hint">{pattern.exampleVi}</p>
      <p className="lesson-prompt">Đặt một câu của riêng bạn với mẫu này:</p>
      <div className="lesson-inputrow">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void check(draft);
          }}
          placeholder="Gõ hoặc bấm Nói"
        />
        <MicButton voicePhase={voicePhase} micReady={micReady} onClick={() => void speak()} />
        <button type="button" className="lesson-secondary" disabled={busy || !draft.trim()} onClick={() => void check(draft)}>
          {busy ? 'Đang chấm…' : 'Kiểm tra'}
        </button>
      </div>
      {feedback && (
        <div className="lesson-feedback">
          {feedback.missing.length > 0 && <p className="lesson-bad">Câu chưa dùng mẫu: thiếu "{feedback.missing.join('", "')}".</p>}
          {feedback.corrections.length === 0 && feedback.missing.length === 0 && <p className="lesson-ok">Câu đúng và dùng đúng mẫu!</p>}
          {feedback.corrections.map((c, i) => (
            <p key={i} className="lesson-bad">
              <s>{c.original}</s> → <strong>{c.corrected}</strong>
              {c.explanation ? ` · ${c.explanation}` : ''}
            </p>
          ))}
        </div>
      )}
      <div className="lesson-actions">
        <button type="button" className="lesson-primary" onClick={() => updateSession((s) => ({ ...s, item: s.item + 1 }))}>
          Mẫu tiếp theo
        </button>
      </div>
    </div>
  );
}

// 4 and 5. Role-play and free talk with the avatar.
function scenarioText(content: LessonContent, mode: 'roleplay' | 'freetalk') {
  if (mode === 'freetalk') {
    return `【课堂：自由表达】你和学生就这个问题聊天：「${content.freeTalk.question}」。鼓励学生多说，每次只追问一个细节，回答简短自然，不要讲解语法。`;
  }
  const rp = content.roleplay;
  return `【课堂：角色扮演】情境（越南语说明）：${rp.setting}。你扮演：${rp.avatarRole}。学生扮演：${rp.learnerRole}。学生的任务：${rp.goals.join('；')}。请一直留在角色里，用适合学生水平的口语对话，每次只说 1–3 句并以一个问题结尾，不要跳出角色，不要讲解语法。`;
}

function DialogSection(props: SharedProps & { mode: 'roleplay' | 'freetalk'; provider: string; model: string; level: Level }) {
  const {
    content,
    session,
    say,
    ask,
    voicePhase,
    micReady,
    busy,
    setBusy,
    updateSession,
    onLearningUpdate,
    setNotice,
    mode,
    provider,
    model,
    level,
  } = props;
  const dialog = session.dialog ?? [];
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
      setBusy(false);
    };
  }, []);
  const opening = mode === 'roleplay' ? content.roleplay.opening : content.freeTalk.question;
  const openingVi = mode === 'roleplay' ? content.roleplay.openingVi : content.freeTalk.questionVi;

  useEffect(() => {
    if (dialog.length === 0) {
      updateSession((s) => ({ ...s, dialog: [{ role: 'assistant', text: opening, translation: openingVi }] }));
      say(opening);
    }
    // only when the section starts with an empty conversation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const reply = async (input: string) => {
    const text = input.trim();
    if (!text || busy) return;
    setDraft('');
    const userLine: DialogLine = { role: 'user', text };
    const history = [...dialog, userLine];
    updateSession((s) => ({ ...s, dialog: history, stats: { ...s.stats, turns: s.stats.turns + 1 } }));
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStreaming('');

    // check the learner's sentence in the background
    void fetchCorrections({ provider, model, text })
      .then((corrections) => {
        if (!active.current || !corrections.length) return;
        onLearningUpdate((p) => recordLearningCorrections(p, text, corrections));
        updateSession((s) => ({
          ...s,
          dialog: (s.dialog || []).map((line) =>
            line === userLine || (line.role === 'user' && line.text === text && !line.corrections) ? { ...line, corrections } : line,
          ),
          notes: [
            ...(s.notes || []),
            ...corrections.map(({ original, corrected, explanation }) => ({ original, corrected, explanation })),
          ].slice(-20),
          stats: { ...s.stats, corrections: s.stats.corrections + corrections.length },
        }));
      })
      .catch(() => {});

    try {
      let replyText = '';
      await streamChat(
        {
          provider,
          model,
          level,
          scenario: scenarioText(content, mode),
          messages: history.slice(-12).map((line) => ({ role: line.role, content: line.text })),
        },
        {
          onReplyDelta: (chunk) => {
            if (!active.current) return;
            replyText += chunk;
            setStreaming(replyText);
          },
          onTurn: (event) => {
            if (!active.current) return;
            const answer = event.turn.reply || replyText;
            updateSession((s) => ({
              ...s,
              dialog: [...(s.dialog || []), { role: 'assistant', text: answer, translation: event.turn.translation }],
            }));
            say(answer);
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (active.current && !controller.signal.aborted)
        setNotice(error instanceof Error ? error.message : 'Misu chưa trả lời được. Thử lại nhé.');
    } finally {
      if (active.current) {
        setStreaming('');
        setBusy(false);
      }
    }
  };

  const speak = async () => {
    const text = await ask();
    if (text) void reply(text);
  };

  return (
    <div className="lesson-card lesson-dialog">
      {mode === 'roleplay' ? (
        <div className="lesson-scenario">
          <p>
            <strong>Tình huống:</strong> {content.roleplay.setting}
          </p>
          <p>
            <strong>Misu:</strong> {content.roleplay.avatarRole} · <strong>Bạn:</strong> {content.roleplay.learnerRole}
          </p>
          <ul>
            {content.roleplay.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="lesson-prompt">Nói ít nhất 3–4 câu về câu hỏi này. Misu sẽ hỏi thêm.</p>
      )}
      <div className="lesson-chat">
        {dialog.map((line, i) => (
          <div key={i} className={`lesson-line is-${line.role}`}>
            <p>{line.text}</p>
            {line.translation && <small>{line.translation}</small>}
            {line.corrections?.map((c, j) => (
              <small key={j} className="lesson-bad">
                <s>{c.original}</s> → {c.corrected}
                {c.explanation ? ` · ${c.explanation}` : ''}
              </small>
            ))}
          </div>
        ))}
        {streaming && (
          <div className="lesson-line is-assistant">
            <p>{streaming}</p>
          </div>
        )}
      </div>
      <div className="lesson-inputrow">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void reply(draft);
          }}
          placeholder="Trả lời bằng tiếng Trung (gõ hoặc bấm Nói)"
          disabled={busy}
        />
        <MicButton voicePhase={voicePhase} micReady={micReady && !busy} onClick={() => void speak()} />
        <button type="button" className="lesson-secondary" disabled={busy || !draft.trim()} onClick={() => void reply(draft)}>
          {busy ? 'Đang xử lý…' : 'Gửi'}
        </button>
      </div>
    </div>
  );
}

// 6. Summary.
function SummarySection({ session, content, onFinish }: { session: SessionState; content: LessonContent; onFinish: () => void }) {
  const s = session.stats;
  return (
    <div className="lesson-card">
      <h3>Tổng kết buổi học</h3>
      <ul className="lesson-stats">
        <li>
          Ôn tập: {s.reviewed} mục, nhớ {s.remembered}
        </li>
        <li>
          Từ của bài: {s.newWords}/{content.vocab.length} đã thêm vào ôn tập
        </li>
        <li>
          Câu tự đặt: {s.sentences} · lượt hội thoại: {s.turns}
        </li>
        <li>Lỗi được sửa: {s.corrections}</li>
      </ul>
      {session.notes && session.notes.length > 0 && (
        <>
          <p className="lesson-prompt">Cần nhớ:</p>
          {session.notes.slice(-6).map((n, i) => (
            <p key={i} className="lesson-bad">
              <s>{n.original}</s> → <strong>{n.corrected}</strong>
              {n.explanation ? ` · ${n.explanation}` : ''}
            </p>
          ))}
        </>
      )}
      <div className="lesson-actions">
        <button type="button" className="lesson-primary" onClick={onFinish}>
          Hoàn thành buổi học
        </button>
      </div>
    </div>
  );
}

export function lessonButtonLabel(progress: LessonProgress | null) {
  return progress && progress.streak > 0 ? `Bài hôm nay · ${progress.streak} ngày` : 'Bài hôm nay';
}
