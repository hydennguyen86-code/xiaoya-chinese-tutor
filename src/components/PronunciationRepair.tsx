import { ToneLabelFeedback } from './ToneLabelFeedback';
import { useEffect, useRef, useState } from 'react';
import { listen, type VoiceHandle, type VoiceResult } from '../lib/voiceInput';
import { repairOutcome, repairStep } from '../lib/pronunciationRepair';
import { useLessonAudio } from '../lib/useLessonAudio';
import toneBank from '../../lessons/listening/tone-pairs.json';
import dictation from '../../lessons/listening/dictation.json';
import { SlowListen } from './ListeningControls';
const noop = () => {};
export interface RepairContext {
  learnerId: string;
  word: string;
  sentence: string;
  voice: string;
  local: boolean;
}
export function PronunciationRepair({ context, char, onClose }: { context: RepairContext; char: string; onClose: () => void }) {
  const targets = [char, context.word || char, context.sentence || context.word || char];
  const [state, setState] = useState({ stage: 0, streak: 0, complete: false }),
    [heard, setHeard] = useState<VoiceResult | null>(null),
    [phase, setPhase] = useState(''),
    [notice, setNotice] = useState('');
  const handle = useRef<VoiceHandle | null>(null),
    alive = useRef(true),
    audio = useLessonAudio(context.voice, noop);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      handle.current?.cancel();
    };
  }, []);
  const target = targets[state.stage];
  async function record() {
    audio.stop();
    setNotice('');
    try {
      const h = listen({ local: context.local, learnerId: context.learnerId, pronounce: target, onPhase: setPhase });
      handle.current = h;
      const result = await h.details;
      if (!alive.current) return;
      setHeard(result);
      const normalized = target.replace(/[^\p{Script=Han}]/gu, '');
      const authored = [
        ...toneBank.items.map((i) => ({ hanzi: i.hanzi, acceptTones: 'acceptTones' in i ? i.acceptTones : undefined })),
        ...dictation.items,
      ].find((i) => i.hanzi.replace(/[^\p{Script=Han}]/gu, '') === normalized);
      const outcome = repairOutcome(result, target, authored?.acceptTones);
      setState((s) => repairStep(s, outcome));
      setNotice(
        outcome === null
          ? 'Chưa đủ dữ liệu chấm; không tính lượt. Câu dài hiện chỉ có đường cao độ, chưa tự xác nhận qua vòng.'
          : outcome
            ? 'Một lần khớp.'
            : 'Chưa khớp; bắt đầu lại chuỗi hai lần.',
      );
      window.dispatchEvent(new CustomEvent('misu:repair-answer', { detail: { learnerId: context.learnerId, target, outcome } }));
    } catch (e) {
      if (alive.current) setNotice(e instanceof Error ? e.message : 'Không thu được.');
    } finally {
      if (alive.current) {
        setPhase('');
        handle.current = null;
      }
    }
  }
  return (
    <section className="course-practice">
      <h4>Sửa phát âm · {['Chữ riêng', 'Cả từ', 'Cả câu'][state.stage]}</h4>
      <p>{target}</p>
      <p>{state.complete ? 'Đã khớp hai lần ở mỗi bước.' : `Lần khớp liên tiếp: ${state.streak}/2`}. Kết quả tự động chỉ tham khảo.</p>
      <button type="button" disabled={Boolean(phase)} onClick={() => void audio.play(target)}>
        Nghe mẫu
      </button>
      <SlowListen disabled={Boolean(phase)} onPlay={() => audio.play(target)} />
      {phase ? (
        <button type="button" onClick={() => handle.current?.stop()}>
          Dừng thu
        </button>
      ) : (
        <button type="button" disabled={!context.local || state.complete || audio.playing} onClick={() => void record()}>
          Nói theo
        </button>
      )}
      {!context.local && <p>Cần nhận dạng cục bộ để giữ bản ghi và chấm; giọng trình duyệt không xác nhận qua vòng.</p>}
      {heard && (
        <p>
          Nghe được: {heard.text || '—'}.{' '}
          {heard.tones?.syllables.map((s) => `${s.char}: ${s.ok === null ? 'chưa rõ' : s.heard}`).join(' · ')}
        </p>
      )}
      {heard?.tones && <ToneLabelFeedback report={heard.tones} audio={heard.audio} learnerId={context.learnerId} />}
      <p role="status">{notice}</p>
      <button type="button" onClick={onClose}>
        Đóng vòng luyện
      </button>
    </section>
  );
}
