import { FluencyHistory } from './FluencyHistory';
import { ToneEvaluation } from './ToneEvaluation';
import { useEffect, useRef, useState } from 'react';
import { assessmentRequest } from '../lib/api';
import {
  loadAssessment,
  saveAssessment,
  planWeekly,
  planMonthly,
  score,
  taskLabel,
  type AssessmentData,
  type AssessmentKind,
  type AssessmentPlan,
  type AssessmentRecord,
  type CanDo,
  type PartScore,
  type TaskSpec,
} from '../lib/assessment';
import { loadLessonProgress } from '../lib/lessonStore';
import { reviewWord } from '../lib/learning';
import { bareChinese, listen, voiceSupported, type VoiceHandle, type VoicePhase, type ToneReport } from '../lib/voiceInput';
import { dayKey } from '../lib/storage';
import type { LearningProfile, Level } from '../types';
import { CommunicationTask } from './CommunicationTask';
import { ToneFeedback } from './ToneFeedback';
import { MicButton } from './LessonWidgets';

interface Props {
  learnerId: string;
  learning: LearningProfile;
  provider: string;
  model: string;
  level: Level;
  localStt: boolean;
  say: (text: string) => void;
  onLearningUpdate: (fn: (p: LearningProfile) => LearningProfile) => void;
  onClose: () => void;
}
type Item =
  | { kind: 'word' | 'mistake' | 'tone'; prompt: string; target: string; word?: string; mistakeId?: string }
  | { kind: 'task'; source: TaskSpec }
  | { kind: 'open' };
export function Assessment(props: Props) {
  const [toneEvaluation, setToneEvaluation] = useState(false);
  const [data, setData] = useState<AssessmentData>(() => loadAssessment(props.learnerId));
  const [plan, setPlan] = useState<AssessmentPlan | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [parts, setParts] = useState<Record<string, PartScore>>({});
  const [canDo, setCanDo] = useState<CanDo[]>([]);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<Blob>();
  const [tones, setTones] = useState<ToneReport | null>(null);
  const [judged, setJudged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<VoicePhase | null>(null);
  const [task, setTask] = useState<TaskSpec | null>(null);
  const [retry, setRetry] = useState(0);
  const [finished, setFinished] = useState<AssessmentRecord | null>(null);
  const voice = useRef<VoiceHandle | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const item = items[index];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      voice.current?.cancel();
      request.current?.abort();
    };
  }, []);
  // Build each transfer task only when entered, and always change the studied setting.
  useEffect(() => {
    if (item?.kind !== 'task') return;
    const controller = new AbortController();
    request.current = controller;
    setTask(null);
    setBusy(true);
    setError('');
    void assessmentRequest<Omit<TaskSpec, 'goals'>>(
      'prepare-task',
      {
        provider: props.provider,
        model: props.model,
        level: props.level,
        goals: item.source.goals,
        source: item.source.setting,
        variant: `${plan?.kind}-${Date.now()}-${index}`,
      },
      controller.signal,
    )
      .then((raw) => {
        if (!controller.signal.aborted) setTask({ ...raw, goals: item.source.goals });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [item, props.provider, props.model, props.level, plan?.kind, index, retry]);
  function start(kind: AssessmentKind) {
    const next = kind === 'week' ? planWeekly(props.learning, data) : planMonthly(props.learning, data);
    setPlan(next);
    setItems([
      ...next.words.map((w) => ({ kind: 'word' as const, prompt: `Nói bằng tiếng Trung: ${w.meaning}`, target: w.word, word: w.word })),
      ...next.mistakes.map((m) => ({
        kind: 'mistake' as const,
        prompt: `Bạn từng nói “${m.original}”. Hãy nói lại cho đúng.`,
        target: m.corrected,
        mistakeId: m.id,
      })),
      ...next.tones.map((t) => ({ kind: 'tone' as const, prompt: `Đọc từ: ${t}`, target: t })),
      ...next.tasks.map((source) => ({ kind: 'task' as const, source })),
      ...(next.open ? [{ kind: 'open' as const }] : []),
    ]);
    setIndex(0);
    setParts({});
    setCanDo([]);
    setJudged(false);
    setFinished(null);
    setError('');
    lock.current = false;
  }
  function addPart(key: string, earned: number, total: number) {
    setParts((p) => ({ ...p, [key]: { earned: (p[key]?.earned ?? 0) + earned, total: (p[key]?.total ?? 0) + total } }));
  }
  async function ask(target?: string) {
    if (voice.current) {
      voice.current.stop();
      return '';
    }
    const handle = listen({ local: props.localStt, learnerId: props.learnerId, pronounce: target, onPhase: setPhase });
    voice.current = handle;
    try {
      const result = await handle.details;
      if (!mounted.current) return '';
      if (target) {
        setTones(result.tones);
        setRecordedAudio(result.audio);
        setAnswer(result.text);
      }
      return result.text;
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Không nghe được.');
      return '';
    } finally {
      voice.current = null;
      if (mounted.current) setPhase(null);
    }
  }
  function mark() {
    if (lock.current || judged || !item || item.kind === 'task' || item.kind === 'open') return;
    lock.current = true;
    const ok = bareChinese(answer) === bareChinese(item.target);
    if (item.kind === 'tone') {
      if (tones && tones.checked > 0) {
        addPart('Thanh điệu', tones.correct, tones.checked);
        setFeedback('Chấm thanh điệu là gợi ý tự động.');
      } else {
        addPart('Thanh điệu', 0, 0);
        setFeedback('Không có chấm thanh hợp lệ; mục này không tính điểm.');
      }
    } else {
      addPart(item.kind === 'word' ? 'Từ vựng' : 'Lỗi cũ', ok ? 1 : 0, 1);
      setFeedback(
        ok ? 'Khớp đáp án.' : `Đáp án tham khảo: ${item.target}. Hệ thống so khớp đáp án, có thể chưa nhận ra cách nói tương đương.`,
      );
      if (!ok && item.word) props.onLearningUpdate((p) => reviewWord(p, item.word!, false));
      if (!ok && item.mistakeId)
        props.onLearningUpdate((p) => ({
          ...p,
          updatedAt: Date.now(),
          mistakes: p.mistakes.map((m) => (m.id === item.mistakeId ? { ...m, count: m.count + 1, lastSeen: Date.now() } : m)),
        }));
    }
    setJudged(true);
  }
  async function gradeOpen() {
    if (lock.current || !answer.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const r = await assessmentRequest<{ fluency: number; accuracy: number; complexity: number; feedback: string }>(
        'assess-task',
        { provider: props.provider, model: props.model, goals: [], learnerTurns: [answer], open: true },
        controller.signal,
      );
      if (!mounted.current) return;
      addPart('Nói mở (ước lượng)', r.fluency + r.accuracy + r.complexity, 12);
      setFeedback(
        `Mạch lạc ${r.fluency}/4 · chính xác ${r.accuracy}/4 · độ phức tạp ${r.complexity}/4. ${r.feedback} Đây là ước lượng từ bản chép lời, không đo tốc độ hay phát âm.`,
      );
      setJudged(true);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa chấm được.');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function next() {
    lock.current = false;
    voice.current?.cancel();
    setAnswer('');
    setFeedback('');
    setTones(null);
    setRecordedAudio(undefined);
    setJudged(false);
    setError('');
    setTask(null);
    if (index + 1 < items.length) {
      setIndex(index + 1);
      return;
    }
    if (!plan) return;
    const record: AssessmentRecord = {
      kind: plan.kind,
      date: dayKey(),
      completedAt: Date.now(),
      sessionCount: loadLessonProgress(props.learnerId)?.completed ?? 0,
      parts,
      score: score(parts),
      canDo,
      estimated: plan.open,
    };
    const fresh = loadAssessment(props.learnerId);
    const updated = { ...fresh, history: [...fresh.history, record].slice(-120) };
    saveAssessment(props.learnerId, updated);
    setData(updated);
    setFinished(record);
    setPlan(null);
  }
  if (toneEvaluation) return <ToneEvaluation learnerId={props.learnerId} onClose={() => setToneEvaluation(false)} />;
  const history = [...data.history].reverse();
  return (
    <section className="lesson-panel assessment-panel">
      <header className="lesson-header">
        <h2>Kiểm tra tuần / tháng</h2>
        <button type="button" onClick={props.onClose}>
          Thoát
        </button>
      </header>
      <FluencyHistory learnerId={props.learnerId} />
      {!plan && (
        <>
          <p>
            Bài tuần khoảng 6 phút; bài tháng khoảng 15 phút. Lấy từ dữ liệu học của riêng bạn; thiếu dữ liệu sẽ có ít câu hơn. Có thể làm
            sớm.
          </p>
          <div className="lesson-actions">
            <button type="button" className="lesson-primary" onClick={() => start('week')}>
              Thi tuần
            </button>
            <button type="button" onClick={() => start('month')}>
              Thi tháng
            </button>
          </div>
          {!data.samples.length && !props.learning.words.length && (
            <p>Hãy học một buổi để có từ, lỗi và nhiệm vụ cá nhân. Bài tháng vẫn có câu hỏi mở.</p>
          )}
          {finished && (
            <div className="lesson-card">
              <h3>
                Kết quả: {finished.score ?? 'Chưa có điểm'}
                {finished.score !== null ? '/100' : ''}
              </h3>
              <p>Điểm chỉ tính trên phần chấm được; các lần có đề khác nhau không hoàn toàn tương đương.</p>
              {Object.entries(finished.parts).map(([k, v]) => (
                <p key={k}>
                  {k}: {v.total > 0 ? `${v.earned}/${v.total}` : 'Không tính điểm — chưa chấm được'}
                </p>
              ))}
              {finished.canDo.map((g, i) => (
                <p key={i}>
                  {g.goal}: {taskLabel(g)}
                </p>
              ))}
              {(() => {
                const prev = history.find((r) => r.kind === finished.kind && r.completedAt < finished.completedAt);
                return prev?.score != null && finished.score != null ? (
                  <p>
                    So lần trước: {finished.score - prev.score >= 0 ? '+' : ''}
                    {finished.score - prev.score} điểm.
                  </p>
                ) : null;
              })()}
            </div>
          )}
          <button type="button" onClick={() => setToneEvaluation(true)}>
            Ghi bộ đo giọng cá nhân
          </button>
          <h3>Lịch sử điểm</h3>
          <ol>
            {history.map((r, i) => (
              <li key={i}>
                {r.date} · {r.kind === 'week' ? 'Tuần' : 'Tháng'} · {r.score ?? 'Chưa có điểm'}
                {r.score !== null ? '/100' : ''}
                <details>
                  <summary>Từng phần và nhiệm vụ</summary>
                  {Object.entries(r.parts).map(([k, v]) => (
                    <p key={k}>
                      {k}: {v.total > 0 ? `${v.earned}/${v.total}` : 'Không tính điểm — chưa chấm được'}
                    </p>
                  ))}
                  {r.canDo.map((g, j) => (
                    <p key={j}>
                      {g.goal}: {taskLabel(g)}
                    </p>
                  ))}
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
      {plan && !items.length && (
        <div className="lesson-card">
          <p>Chưa có đủ nội dung đã học để tạo bài tuần. Học một buổi rồi quay lại nhé.</p>
          <button type="button" onClick={() => setPlan(null)}>
            Quay lại
          </button>
        </div>
      )}
      {plan && item && (
        <>
          <p>
            Câu {index + 1}/{items.length}
          </p>
          {error && (
            <p className="lesson-bad" role="alert">
              {error}
            </p>
          )}
          {item.kind === 'task' ? (
            <>
              {busy && <p>Đang soạn tình huống mới…</p>}
              {error && !task && (
                <button
                  type="button"
                  onClick={() => {
                    setRetry((r) => r + 1);
                  }}
                >
                  Thử lại tình huống
                </button>
              )}
              {task && (
                <CommunicationTask
                  key={index}
                  task={task}
                  provider={props.provider}
                  model={props.model}
                  level={props.level}
                  say={props.say}
                  ask={() => ask()}
                  micReady={voiceSupported(props.localStt)}
                  voicePhase={phase}
                  onComplete={(goals) => {
                    setCanDo((p) => [...p, ...goals]);
                    addPart(
                      'Giao tiếp',
                      goals.reduce((n, g) => n + (g.status === 'done' ? (g.helped ? 0.5 : 1) : g.status === 'partly' ? 0.25 : 0), 0),
                      goals.length,
                    );
                    const fresh = loadAssessment(props.learnerId);
                    saveAssessment(props.learnerId, {
                      ...fresh,
                      tasks: [...fresh.tasks, { date: Date.now(), task, result: goals }].slice(-90),
                    });
                    setJudged(true);
                  }}
                />
              )}
            </>
          ) : (
            <div className="lesson-card">
              <p className="lesson-prompt">
                {item.kind === 'open'
                  ? 'Kể một trải nghiệm gần đây bằng tiếng Trung: chuyện gì xảy ra, bạn xử lý thế nào và vì sao?'
                  : item.prompt}
              </p>
              {!judged && (
                <>
                  {item.kind !== 'tone' && (
                    <textarea
                      maxLength={2000}
                      aria-label="Câu trả lời kiểm tra"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={busy}
                    />
                  )}
                  {item.kind === 'tone' && !props.localStt && (
                    <p>Cần Whisper cục bộ để chấm thanh. Có thể bỏ qua phần này, không trừ điểm.</p>
                  )}
                  <div className="lesson-actions">
                    <MicButton
                      micReady={voiceSupported(props.localStt) && !busy && (item.kind !== 'tone' || props.localStt)}
                      voicePhase={phase}
                      onClick={() =>
                        void ask(item.kind === 'tone' ? item.target : undefined).then((t) => {
                          if (mounted.current) setAnswer(t);
                        })
                      }
                    />
                    <button
                      type="button"
                      disabled={busy || Boolean(phase)}
                      onClick={() => (item.kind === 'open' ? void gradeOpen() : mark())}
                    >
                      {busy ? 'Đang chấm…' : item.kind === 'tone' ? 'Xác nhận / bỏ qua' : 'Chấm câu'}
                    </button>
                  </div>
                </>
              )}
              {tones && (
                <ToneFeedback
                  report={tones}
                  audio={recordedAudio}
                  repair={{
                    learnerId: props.learnerId,
                    word: 'target' in item ? item.target : '',
                    sentence: 'target' in item ? item.target : '',
                    voice: 'zh-CN-XiaoxiaoNeural',
                    local: props.localStt,
                  }}
                />
              )}
              <p role="status">{feedback}</p>
            </div>
          )}
          {judged && (
            <button type="button" className="lesson-primary" onClick={next}>
              {index + 1 === items.length ? 'Lưu kết quả' : 'Câu tiếp theo'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
