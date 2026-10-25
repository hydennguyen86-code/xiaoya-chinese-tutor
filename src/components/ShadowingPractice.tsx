import { useEffect, useRef, useState } from 'react';
import bank from '../../lessons/listening/shadowing.json';
import { listen, type VoiceHandle, type VoiceResult } from '../lib/voiceInput';
import { useListeningPrefs } from './ListeningControls';
import { useLessonAudio } from '../lib/useLessonAudio';
import { ToneFeedback } from './ToneFeedback';
export function ShadowingPractice({
  learnerId,
  level,
  voice,
  onBusy,
}: {
  learnerId: string;
  level: string;
  voice: string;
  onBusy: (busy: boolean) => void;
}) {
  const items = bank.items.filter((i) => i.level === level && !('uncertain' in i && i.uncertain));
  return (
    <details className="course-practice">
      <summary>Nói đuổi · nghe mẫu rồi nói ngay</summary>
      <p>{bank.source}. Cao độ và ngắt câu chỉ tham khảo; không quy đổi điểm thi.</p>
      <ShadowRound key={`${learnerId}:${level}`} {...{ items, learnerId, voice, onBusy }} />
    </details>
  );
}
function ShadowRound({
  items,
  learnerId,
  voice,
  onBusy,
}: {
  items: typeof bank.items;
  learnerId: string;
  voice: string;
  onBusy: (busy: boolean) => void;
}) {
  const [index, setIndex] = useState(0),
    [phase, setPhase] = useState(''),
    [error, setError] = useState(''),
    [heard, setHeard] = useState<VoiceResult | null>(null);
  const handle = useRef<VoiceHandle | null>(null),
    epoch = useRef(0),
    audio = useLessonAudio(voice, onBusy),
    prefs = useListeningPrefs();
  useEffect(
    () => () => {
      epoch.current++;
      handle.current?.cancel();
    },
    [],
  );
  const item = items[index];
  if (!item) return <p>Chưa có đoạn cho bậc này.</p>;
  async function start() {
    const turn = ++epoch.current;
    setError('');
    setHeard(null);
    setPhase('Nghe mẫu…');
    const ok = await new Promise<boolean>((resolve) => void audio.play(item.text, undefined, resolve));
    if (!ok || turn !== epoch.current) {
      setPhase('');
      return;
    }
    try {
      onBusy(true);
      setPhase('Nói theo ngay bây giờ');
      const h = listen({
        local: true,
        learnerId,
        pronounce: item.text,
        modelRate: prefs.rate,
        maxMs: 90000,
        silenceMs: 2200,
        onPhase: (p) => setPhase(p === 'listening' ? 'Đang thu · bấm dừng khi xong' : 'Đang phân tích…'),
      });
      handle.current = h;
      const result = await h.details;
      if (turn === epoch.current) setHeard(result);
    } catch (e) {
      if (turn === epoch.current) setError(e instanceof Error ? e.message : 'Không thu được.');
    } finally {
      if (turn === epoch.current) {
        setPhase('');
        handle.current = null;
        onBusy(false);
      }
    }
  }
  return (
    <div>
      <p>{item.text}</p>
      <p>{item.pinyin}</p>
      <p>{item.meaningVi}</p>
      <p>Cụm hơi: {item.chunks.map((c) => c.hanzi).join(' / ')}</p>
      <button type="button" disabled={Boolean(phase)} onClick={() => void start()}>
        Nghe rồi bắt đầu thu tự động · {prefs.rate}×
      </button>
      {phase && (
        <>
          <p role="status">{phase}</p>
          <button
            type="button"
            onClick={() => {
              if (handle.current) handle.current.stop();
              else {
                epoch.current++;
                audio.stop();
                setPhase('');
              }
            }}
          >
            Dừng
          </button>
        </>
      )}
      {heard?.tones && (
        <>
          <ToneFeedback report={heard.tones} audio={heard.audio} />
          <p>
            Độ dài bạn: {heard.tones.duration?.toFixed(2) ?? '—'}s · mẫu: {heard.tones.model?.duration?.toFixed(2) ?? '—'}s. Ngắt hơn 1
            giây: {heard.tones.timing?.pauses.length ?? 'chưa đo'} / mẫu {heard.tones.model?.timing?.pauses.length ?? 'chưa đo'}. Mốc ngắt
            tính theo năng lượng, không phải forced alignment.
          </p>
        </>
      )}
      <button
        type="button"
        disabled={Boolean(phase)}
        onClick={() => {
          setIndex((index + 1) % items.length);
          setHeard(null);
        }}
      >
        Đoạn tiếp
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
