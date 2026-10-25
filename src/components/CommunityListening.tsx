import { useEffect, useRef, useState } from 'react';
import { compareDictation, type CommunityClip } from '../lib/listeningCorpus';
import { useListeningPrefs } from './ListeningControls';
export function CommunityListening({ level = 'HSK1-2' }: { level?: string }) {
  const [clips, setClips] = useState<CommunityClip[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(level);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  const prefs = useListeningPrefs();
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/listening-corpus', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => setClips(data.entries || []))
      .catch(() => {
        if (!abort.signal.aborted) setError('Chưa tải được danh sách giọng cộng đồng.');
      });
    return () => abort.abort();
  }, []);
  const selected = clips.filter((c) => c.level === selectedLevel);
  const clip = selected[index];
  useEffect(() => {
    setAnswer('');
    setSubmitted(false);
    setError('');
    audio.current?.load();
  }, [clip?.id]);
  function play(rate: number) {
    if (!audio.current) return;
    audio.current.playbackRate = rate;
    audio.current.currentTime = 0;
    audio.current.play().catch(() => setError('Không phát được bản ghi. Kiểm tra đường dẫn Common Voice đã cấu hình.'));
  }
  return (
    <details className="course-practice">
      <summary>Nghe và nghe chép · giọng cộng đồng Common Voice</summary>
      <p>Giọng người đóng góp zh-CN; không bảo đảm mọi người nói cùng một giọng địa phương. Đây là luyện tập, không phải đề thi HSK.</p>
      <p>
        AI soạn, chưa duyệt. Chọn câu theo danh sách DeepSeek; bậc học là ước lượng biên tập, không phải xác nhận HSK chính thức. Chỉ phát
        trên máy đang chứa dữ liệu.
      </p>
      <label>
        Bậc câu nghe
        <select
          value={selectedLevel}
          onChange={(e) => {
            audio.current?.pause();
            setSelectedLevel(e.target.value);
            setIndex(0);
          }}
        >
          {['HSK1-2', 'HSK3-4', 'HSK5-6'].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      {!clip ? (
        <p>
          Chưa có danh sách câu phù hợp. Cấu hình XIAOYA_COMMON_VOICE_DIR rồi lập danh sách theo docs/COMMON-VOICE.md. Âm thanh được đọc
          trực tiếp từ thư mục của bạn.
        </p>
      ) : (
        <>
          <p>
            Câu {index + 1}/{selected.length} · {clip.version} · {clip.level}
          </p>
          <audio
            ref={audio}
            src={`/api/listening-corpus/${clip.id}/audio`}
            preload="none"
            onError={() => setError('Bản ghi bị thiếu hoặc không giải mã được.')}
          />
          <div className="lesson-actions">
            <button type="button" onClick={() => play(prefs.rate)}>
              Nghe câu {prefs.rate}×
            </button>
            <button type="button" onClick={() => play(0.7)}>
              Nghe chậm 0.7×
            </button>
          </div>
          <label>
            Gõ chữ Hán hoặc pinyin không dấu, cách từng âm tiết
            <input
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setSubmitted(false);
              }}
            />
          </label>
          <button type="button" disabled={!answer.trim()} onClick={() => setSubmitted(true)}>
            Đối chiếu và hiện câu
          </button>
          {submitted && (
            <div>
              <p>
                {compareDictation(clip.text, answer).map((part, i) => (
                  <span
                    key={i}
                    style={{ color: part.ok ? 'var(--text)' : '#ef754c' }}
                    title={part.ok ? 'Khớp' : `Bạn gõ: ${part.actual || '(thiếu)'}`}
                  >
                    {part.expected || ` [+${part.actual}]`}
                  </span>
                ))}
              </p>
              <p>{clip.text}</p>
              <p>{clip.meaningVi}</p>
              {clip.focus?.map((f, i) => (
                <p key={i}>{f}</p>
              ))}
              <p>Chỗ màu cam: khác bản chép; đưa chuột vào để xem phần bạn gõ. Dấu câu không tính.</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              audio.current?.pause();
              setAnswer('');
              setSubmitted(false);
              setIndex((index + 1) % selected.length);
            }}
          >
            Câu tiếp
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
