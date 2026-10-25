import { useEffect, useRef, useState } from 'react';
import type { VoiceResult, ToneReport } from '../lib/voiceInput';
import { recordSpokenTones } from '../lib/listeningPractice';
import { ToneFeedback } from './ToneFeedback';
import { PronunciationRepair } from './PronunciationRepair';
export function SpokenPronunciation({ turn, learnerId, voice }: { turn: VoiceResult; learnerId: string; voice: string }) {
  const [report, setReport] = useState<ToneReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [repair, setRepair] = useState(false),
    [char, setChar] = useState([...turn.text.replace(/[^\p{Script=Han}]/gu, '')][0] || '');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [turn]);
  async function inspect() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const query = new URLSearchParams({ target: turn.text, learner: learnerId });
      const response = await fetch(`/api/pronounce?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': turn.audio?.type || 'audio/webm' },
        body: turn.audio,
        signal: abort.signal,
      });
      if (!response.ok) throw Error('Chưa phân tích được bản ghi.');
      const data = await response.json();
      if (!abort.signal.aborted) {
        setReport(data.tones);
        if (data.tones) recordSpokenTones(learnerId, data.tones);
      }
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Không phân tích được.');
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  if (!turn.audio) return null;
  const context = { learnerId, word: char, sentence: turn.text, voice, local: true };
  return (
    <div>
      <button type="button" disabled={busy || turn.text.length > 120} onClick={() => void inspect()}>
        {busy ? 'Đang xem phát âm…' : 'Xem phát âm câu này'}
      </button>
      <p>
        Bản ghi chỉ giữ trong phiên, tối đa 10 lượt; tải lại trang sẽ mất. Đối chiếu trên chữ Whisper nghe được, không bảo đảm đó là câu bạn
        định nói.
      </p>
      {turn.text.length > 120 && <p>Câu quá dài để chấm trong một lượt; hãy nói ngắn hơn.</p>}
      {report && (
        <>
          <p>Mục tiêu từ Whisper: {turn.text}</p>
          <ToneFeedback report={report} audio={turn.audio} repair={context} />
          {report.mode === 'sentence' && (
            <>
              <label>
                Chọn chữ muốn luyện riêng
                <select
                  value={char}
                  onChange={(e) => {
                    setChar(e.target.value);
                    setRepair(false);
                  }}
                >
                  {[...new Set([...turn.text.replace(/[^\p{Script=Han}]/gu, '')])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setRepair(true)}>
                Mở vòng luyện chữ đã chọn
              </button>
              <p>Câu dài chỉ có cao độ; chưa tự kết luận chữ nào sai thanh.</p>
            </>
          )}
        </>
      )}
      {repair && <PronunciationRepair key={char} context={context} char={char} onClose={() => setRepair(false)} />}{' '}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
