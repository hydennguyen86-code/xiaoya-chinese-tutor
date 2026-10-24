import { useEffect, useRef, useState } from 'react';

type Item = { id: string; text: string; kind: string; expected: number[] };
type Label = { source: 'self' | 'expert'; reviewedBy: string; tones: number[] };
type Recording = { id: string; label: Label | null };
export function ToneEvaluation({ learnerId, onClose }: { learnerId: string; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [source, setSource] = useState<'self' | 'expert'>('self');
  const [labels, setLabels] = useState<number[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const item = items[index];
  const current = recordings.find((r) => r.id === item?.id);
  const base = `/api/tone-evaluation/${encodeURIComponent(learnerId)}`;
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void fetch(base, { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Không đọc được bộ ghi âm.');
        const data = await res.json();
        setItems(data.items);
        setRecordings(data.recordings);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => {
      alive.current = false;
      abort.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [base]);
  useEffect(() => {
    setLabels(current?.label?.tones ?? item?.expected ?? []);
  }, [item, current]);
  async function capture() {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop();
      return;
    }
    setError('');
    setBusy(true);
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        audio.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = audio;
      const rec = new MediaRecorder(audio);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        audio.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        setRecording(false);
        void (async () => {
          try {
            const res = await fetch(`${base}/${item.id}`, {
              method: 'POST',
              headers: { 'content-type': rec.mimeType },
              body: new Blob(chunks, { type: rec.mimeType }),
            });
            if (!res.ok) throw new Error('Không lưu được bản ghi.');
            const saved = await res.json();
            if (alive.current) setRecordings((all) => [...all.filter((r) => r.id !== item.id), saved]);
          } catch (e) {
            if (alive.current) setError(e instanceof Error ? e.message : 'Lỗi ghi âm.');
          } finally {
            if (alive.current) setBusy(false);
          }
        })();
      };
      rec.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Micro chưa sẵn sàng.');
      setBusy(false);
    }
  }
  async function label(correct = false) {
    setError('');
    setBusy(true);
    try {
      const value = { source, reviewedBy: reviewer, tones: correct ? item.expected : labels };
      const res = await fetch(`${base}/${item.id}/label`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setRecordings((all) => all.map((r) => (r.id === item.id ? { ...r, label: value } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được nhãn.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lesson-card">
      <h3>Bộ đo giọng cá nhân · 40 chữ và 16 từ</h3>
      <p>
        Bản ghi chỉ lưu trên máy trong thư mục dữ liệu/eval-recordings của người học. Không tự gửi lên GitHub. Đọc tự nhiên, nghe lại rồi
        gắn nhãn; nhãn tự đánh giá cần được người giỏi kiểm tra trước khi kết luận độ chính xác.
      </p>
      <p>
        Đã ghi {recordings.length}/56 · có nhãn {recordings.filter((r) => r.label).length}/56.
      </p>
      <button disabled={busy} onClick={onClose}>
        Về kiểm tra
      </button>
      {error && <p role="alert">{error}</p>}
      {item && (
        <>
          <label>
            Mục đọc{' '}
            <select disabled={busy} value={index} onChange={(e) => setIndex(Number(e.target.value))}>
              {items.map((entry, i) => (
                <option key={entry.id} value={i}>
                  {i + 1}. {entry.text}
                </option>
              ))}
            </select>
          </label>
          <p className="lesson-prompt">{item.text}</p>
          <button disabled={busy && !recording} onClick={() => void capture()}>
            {recording ? 'Dừng và lưu bản ghi' : 'Ghi âm (tối đa 8 giây)'}
          </button>
          {current && !busy && (
            <audio
              key={`${item.id}-${recordings.indexOf(current)}`}
              controls
              src={`${base}/${item.id}/audio?v=${current.label?.reviewedBy ?? recordings.length}`}
            />
          )}
          <label>
            Người gắn nhãn <input maxLength={100} value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
          </label>
          <label>
            Nguồn nhãn{' '}
            <select value={source} onChange={(e) => setSource(e.target.value as 'self' | 'expert')}>
              <option value="self">Tự đánh giá</option>
              <option value="expert">Người giỏi tiếng Trung nghe và gắn nhãn</option>
            </select>
          </label>
          <p>Ghi thanh thực sự nghe được, không chép thanh mục tiêu nếu đã đọc sai. 0 = không rõ.</p>
          {[...item.text].map((char, i) => (
            <label key={i}>
              {char}
              <select
                value={labels[i] ?? 0}
                onChange={(e) => setLabels((all) => all.map((tone, j) => (j === i ? Number(e.target.value) : tone)))}
              >
                {[0, 1, 2, 3, 4].map((tone) => (
                  <option key={tone} value={tone}>
                    {tone || 'Không rõ'}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="lesson-actions">
            <button disabled={busy || !current || !reviewer.trim()} onClick={() => void label(true)}>
              Mình đọc đúng thanh — lưu nhãn mục tiêu
            </button>
            <button disabled={busy || !current || !reviewer.trim()} onClick={() => void label()}>
              Lưu từng thanh vừa nghe
            </button>
            <button disabled={busy || index === 55} onClick={() => setIndex(index + 1)}>
              Mục tiếp
            </button>
          </div>
          {current?.label && (
            <p role="status">
              Đã lưu nhãn ({current.label.source === 'self' ? 'tự đánh giá' : 'người nghe đánh giá'}): {current.label.tones.join(', ')}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
