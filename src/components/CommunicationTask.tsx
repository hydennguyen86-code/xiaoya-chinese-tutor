import { ListenFirstLine } from './ListeningControls';
import { useEffect, useRef, useState } from 'react';
import { assessmentRequest, streamChat } from '../lib/api';
import type { CanDo, TaskSpec } from '../lib/assessment';
import { taskLabel } from '../lib/assessment';
import type { Level } from '../types';
import { MicButton } from './LessonWidgets';
import type { VoicePhase } from '../lib/voiceInput';

interface Props {
  task: TaskSpec;
  provider: string;
  model: string;
  level: Level;
  ask: () => Promise<string>;
  say: (text: string) => void;
  micReady: boolean;
  voicePhase: VoicePhase | null;
  onComplete: (result: CanDo[]) => void;
}
export function CommunicationTask({ task, provider, model, level, ask, say, micReady, voicePhase, onComplete }: Props) {
  const [dialog, setDialog] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: task.opening },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [helped, setHelped] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CanDo[] | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  const turns = dialog.filter((d) => d.role === 'user');
  const scenario = `Kiểm tra giao tiếp: ${task.setting}. Bạn đóng vai ${task.avatarRole}, người học là ${task.learnerRole}. Mục tiêu: ${task.goals.join('; ')}. Đối thoại tiếng Trung ngắn đúng trình độ, hỏi một câu. Không đưa mẫu trả lời hoặc giải thích. Không tự hoàn thành mục tiêu thay người học.`;
  async function send(input: string, hintOnly = false) {
    if (locked.current || (!input.trim() && !hintOnly) || (!hintOnly && turns.length >= 4)) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    const next = hintOnly ? dialog : [...dialog, { role: 'user' as const, content: input.trim() }];
    try {
      let answer = '';
      await streamChat(
        {
          provider,
          model,
          level,
          scenario: hintOnly
            ? `${scenario} Người học đã xin gợi ý: suggestion phải là một câu trả lời ngắn phù hợp lượt hiện tại.`
            : scenario,
          messages: next,
        },
        {
          onTurn: ({ turn }) => {
            answer = hintOnly ? turn.suggestion : turn.reply;
          },
        },
        controller.signal,
      );
      if (!mounted.current) return;
      if (!answer) throw new Error('Chưa nhận được câu trả lời. Thử lại nhé.');
      if (hintOnly) {
        setHint(answer);
        setHelped(true);
      } else {
        setDialog([...next, { role: 'assistant', content: answer }]);
        setDraft('');
        say(answer);
      }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa kết nối được.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function grade() {
    if (locked.current || !turns.length) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const raw = await assessmentRequest<{ goals: Array<Omit<CanDo, 'helped'>> }>(
        'assess-task',
        { provider, model, goals: task.goals, learnerTurns: turns.map((t) => t.content) },
        controller.signal,
      );
      if (!mounted.current) return;
      const scored = raw.goals.map((g) => ({ ...g, helped }));
      setResult(scored);
      onComplete(scored);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa chấm được.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="lesson-card">
      <h3>Nhiệm vụ giao tiếp</h3>
      <p>
        {task.setting} · Bạn: {task.learnerRole} · Misu: {task.avatarRole}
      </p>
      <ul>
        {task.goals.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <p className="lesson-hint">Tối đa 4 lượt. Thử tự nói trước khi xin gợi ý. Đánh giá do AI ước lượng.</p>
      <div className="lesson-chat">
        {dialog.map((d, i) => (
          <div key={i} className={`lesson-line is-${d.role}`}>
            {d.role === 'assistant' ? <ListenFirstLine text={d.content} onPlay={() => say(d.content)} /> : <p>{d.content}</p>}
          </div>
        ))}
      </div>
      {hint && <p className="lesson-hint">Gợi ý: {hint} (đã ghi nhận dùng gợi ý)</p>}
      {error && (
        <p role="alert" className="lesson-bad">
          {error}
        </p>
      )}
      {!result && (
        <>
          <div className="lesson-inputrow">
            <input
              maxLength={2000}
              aria-label="Trả lời nhiệm vụ"
              value={draft}
              disabled={busy || turns.length >= 4}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send(draft);
              }}
              placeholder="Trả lời bằng tiếng Trung"
            />
            <MicButton
              micReady={micReady && !busy && turns.length < 4}
              voicePhase={voicePhase}
              onClick={() =>
                void ask().then((t) => {
                  if (mounted.current && t) void send(t);
                })
              }
            />
            <button type="button" disabled={busy || !draft.trim() || turns.length >= 4} onClick={() => void send(draft)}>
              Gửi
            </button>
          </div>
          <div className="lesson-actions">
            <button type="button" disabled={busy || turns.length >= 4} onClick={() => void send('', true)}>
              Gợi ý
            </button>
            <button type="button" className="lesson-primary" disabled={busy || !turns.length} onClick={() => void grade()}>
              {busy ? 'Đang xử lý…' : 'Chấm nhiệm vụ'}
            </button>
          </div>
        </>
      )}
      {result && (
        <ul>
          {result.map((r, i) => (
            <li key={i}>
              <strong>{taskLabel(r)}</strong>: {r.goal}
              {r.evidence && <small> · “{r.evidence}”</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
