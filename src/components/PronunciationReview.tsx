import { useEffect, useRef, useState } from 'react';
import type { LearningProfile } from '../types';
import { duePronunciation, reviewPronunciation } from '../lib/learning';
import { listen, type VoiceHandle } from '../lib/voiceInput';
import { repairOutcome } from '../lib/pronunciationRepair';
import { useLessonAudio } from '../lib/useLessonAudio';
import { SoundReview } from './SoundListening';
const noop = () => {};
export function PronunciationReview({
  learning,
  learnerId,
  voice,
  localStt,
  onUpdate,
}: {
  learning: LearningProfile;
  learnerId: string;
  voice: string;
  localStt: boolean;
  onUpdate: (fn: (p: LearningProfile) => LearningProfile) => void;
}) {
  const due = duePronunciation(learning),
    item = due[0],
    audio = useLessonAudio(voice, noop),
    handle = useRef<VoiceHandle | null>(null),
    alive = useRef(true);
  const [phase, setPhase] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      handle.current?.cancel();
    };
  }, []);
  async function review() {
    if (!item) return;
    audio.stop();
    try {
      const h = listen({ local: true, learnerId, pronounce: item.target, onPhase: setPhase });
      handle.current = h;
      const result = await h.details;
      if (!alive.current) return;
      const outcome = repairOutcome(result, item.target, [[Number(item.contrast)]]);
      onUpdate((p) => reviewPronunciation(p, item.id, outcome));
      setNotice(outcome === null ? 'Chưa chấm rõ; giữ nguyên lịch.' : outcome ? 'Đã khớp; hẹn ôn lại.' : 'Chưa khớp; ôn lại sau 5 phút.');
    } catch (e) {
      if (alive.current) setNotice(e instanceof Error ? e.message : 'Không chấm được.');
    } finally {
      if (alive.current) {
        handle.current = null;
        setPhase('');
      }
    }
  }
  return (
    <section className="course-practice">
      <h3>Ôn phát âm đến hạn · {due.length}</h3>
      {!item ? (
        <p>Chưa có lỗi phát âm đến hạn.</p>
      ) : item.kind === 'sound' ? (
        <SoundReview
          key={item.id}
          pairId={item.contrast}
          {...{ learnerId, voice }}
          onAnswer={(correct) => onUpdate((p) => reviewPronunciation(p, item.id, correct))}
        />
      ) : (
        <>
          <p>
            {item.target} · thanh cần luyện {item.contrast}
          </p>
          <button type="button" disabled={Boolean(phase)} onClick={() => void audio.play(item.target)}>
            Nghe mẫu
          </button>
          <button type="button" disabled={!localStt || Boolean(phase) || audio.playing} onClick={() => void review()}>
            Nói để ôn
          </button>
          {phase && (
            <button type="button" onClick={() => handle.current?.stop()}>
              Dừng thu
            </button>
          )}
        </>
      )}
      <p role="status">{notice}</p>
      <p>Lịch phát âm ngắn hơn lịch từ vựng; kết quả tự động chỉ tham khảo. Chưa rõ thì không đổi lịch.</p>
    </section>
  );
}
