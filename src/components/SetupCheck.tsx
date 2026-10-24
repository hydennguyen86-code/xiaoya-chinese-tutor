import { useEffect, useRef, useState } from 'react';
import { fetchStatus, fetchTts, streamChat } from '../lib/api';
import type { Settings, StatusResponse } from '../types';
interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onStart: () => void;
  onStatus: (s: StatusResponse) => void;
}
export function SetupCheck({ settings, onChange, onClose, onStart, onStatus }: Props) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0);
  const [mic, setMic] = useState('Chưa thử');
  const [audioUrl, setAudioUrl] = useState('');
  const [tts, setTts] = useState('Chưa thử');
  const [demo, setDemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordLock = useRef(false);
  const alive = useRef(true);
  const panel = useRef<HTMLDivElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const urls = useRef<string[]>([]);
  const playback = useRef<HTMLAudioElement | null>(null);
  const requests = useRef(new Set<AbortController>());
  const controller = () => {
    const c = new AbortController();
    requests.current.add(c);
    return c;
  };
  async function refresh() {
    const c = controller();
    try {
      const s = await fetchStatus(c.signal);
      if (alive.current) {
        setStatus(s);
        onStatus(s);
        setError('');
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Không kết nối được server.');
    } finally {
      requests.current.delete(c);
    }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      cleanup.current();
      playback.current?.pause();
      requests.current.forEach((c) => c.abort());
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  async function testMic() {
    if (recordLock.current) return;
    recordLock.current = true;
    setRecording(true);
    setMic('Đang xin quyền…');
    setError('');
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let timer: number | undefined;
    let frame: number | undefined;
    let recorder: MediaRecorder | null = null;
    cleanup.current = () => {
      if (timer) clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      if (recorder?.state === 'recording') recorder.stop();
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        cleanup.current();
        return;
      }
      ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyser.fftSize = 256;
      const values = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(values);
        if (alive.current) setVolume(values.reduce((a, b) => a + b, 0) / values.length / 128);
        frame = requestAnimationFrame(draw);
      };
      draw();
      recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        if (!alive.current) return;
        const url = URL.createObjectURL(new Blob(chunks, { type: recorder?.mimeType }));
        urls.current.push(url);
        setAudioUrl(url);
        setMic('Đã ghi thử 3 giây. Nghe lại để kiểm tra.');
        setRecording(false);
        recordLock.current = false;
        setVolume(0);
      };
      recorder.start();
      setMic('Đang ghi thử 3 giây…');
      timer = window.setTimeout(() => cleanup.current(), 3000);
    } catch (e) {
      cleanup.current();
      if (alive.current) {
        setMic('Chưa đạt: cho phép micro trong trình duyệt và kiểm tra thiết bị đầu vào.');
        setRecording(false);
        recordLock.current = false;
        setError(e instanceof Error ? e.message : 'Không mở được micro.');
      }
    }
  }
  async function testTts() {
    const c = controller();
    setBusy(true);
    setError('');
    try {
      const r = await fetchTts('你好，欢迎和米苏一起练习中文。', settings.voice, c.signal);
      if (!alive.current) return;
      const bytes = Uint8Array.from(atob(r.audioBase64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
      urls.current.push(url);
      playback.current?.pause();
      const audio = new Audio(url);
      playback.current = audio;
      await audio.play();
      if (alive.current)
        setTts(r.fallbackReason ? `Đang dùng giọng dự phòng (${r.provider}): ${r.fallbackReason}` : `Đã phát giọng thử (${r.provider}).`);
    } catch (e) {
      if (alive.current) {
        setTts('Chưa đạt: kiểm tra kết nối mạng hoặc giọng macOS.');
        setError(e instanceof Error ? e.message : 'Không phát được.');
      }
    } finally {
      requests.current.delete(c);
      if (alive.current) setBusy(false);
    }
  }
  async function testDemo() {
    const c = controller();
    setBusy(true);
    setError('');
    setDemo('');
    try {
      await streamChat(
        {
          provider: settings.providerId,
          model: settings.model,
          level: settings.level,
          messages: [{ role: 'user', content: '你好，我想练习中文。' }],
        },
        {
          onTurn: ({ turn }) => {
            if (alive.current) setDemo(`${turn.reply}\n${turn.translation}`);
          },
        },
        c.signal,
      );
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Model chưa trả lời được.');
    } finally {
      requests.current.delete(c);
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const nodes = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select:not(:disabled),input:not(:disabled),audio[controls]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      before?.focus();
    };
  }, []);
  const provider = status?.providers.find((p) => p.id === settings.providerId);
  return (
    <div className="setup-overlay" role="dialog" aria-modal="true" aria-label="Kiểm tra hệ thống">
      <div className="setup-panel" ref={panel} tabIndex={-1}>
        <header className="lesson-header">
          <h2>Chuẩn bị buổi học đầu tiên</h2>
          <button type="button" onClick={onClose}>
            Để sau / đóng
          </button>
        </header>
        <section>
          <h3>1. Model cục bộ</h3>
          <p>Bài nghe và luyện nói cố định có thể học trước khi chọn model. Model dùng cho trò chuyện và góp ý tương tác.</p>
          <p>
            {provider?.online && provider.models.includes(settings.model)
              ? 'Đạt: model đã sẵn sàng.'
              : 'Chưa đạt: mở Ollama hoặc LM Studio, tải model rồi làm mới.'}
          </p>
          <button type="button" onClick={() => void refresh()}>
            Làm mới
          </button>
          <label>
            Nhà cung cấp{' '}
            <select
              value={settings.providerId}
              onChange={(e) => {
                const p = status?.providers.find((p) => p.id === e.target.value);
                onChange({ providerId: e.target.value, model: p?.recommendedModel ?? '' });
              }}
            >
              <option value="">Chọn nhà cung cấp</option>
              {status?.providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.online}>
                  {p.name}
                  {p.online ? '' : ' — chưa chạy'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model{' '}
            <select value={settings.model} onChange={(e) => onChange({ model: e.target.value })}>
              <option value="">Chọn model</option>
              {provider?.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </section>
        <section>
          <h3>2. Micro</h3>
          <p>{mic}</p>
          <meter min="0" max="1" value={Math.min(1, volume)} aria-label="Âm lượng micro" />
          <button type="button" disabled={recording} onClick={() => void testMic()}>
            Ghi thử 3 giây
          </button>
          {audioUrl && <audio controls src={audioUrl} />}
        </section>
        <section>
          <h3>3. Nhận dạng giọng nói</h3>
          <p>
            {status?.localStt
              ? 'Đạt: nhận dạng trên máy qua Whisper.'
              : 'Đang dùng nhận dạng trình duyệt nếu được hỗ trợ; âm thanh có thể được gửi tới nhà cung cấp. Để chạy trên máy: npm run setup:whisper, rồi khởi động lại app.'}
          </p>
        </section>
        <section>
          <h3>4. Nghe giọng mẫu</h3>
          <p>{tts}</p>
          <button type="button" disabled={busy} onClick={() => void testTts()}>
            Nghe thử một câu
          </button>
        </section>
        <section>
          <h3>5. Hội thoại đầu tiên</h3>
          <button type="button" disabled={busy || !provider?.online || !settings.model} onClick={() => void testDemo()}>
            Thử hội thoại mẫu
          </button>
          {demo && <p className="setup-demo">{demo}</p>}
        </section>
        {error && (
          <p role="alert" className="lesson-bad">
            {error}
          </p>
        )}
        <button type="button" className="lesson-primary" onClick={onStart} disabled={!status}>
          Bắt đầu bài đầu tiên
        </button>
      </div>
    </div>
  );
}
