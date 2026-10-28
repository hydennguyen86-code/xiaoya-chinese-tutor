import { useEffect, useState } from 'react';
import { Han } from './LessonWidgets';
import { listeningPrefs, SPEEDS, updateListeningPrefs, withSpeechRate } from '../lib/listeningPrefs';
export function useListeningPrefs() {
  const [prefs, setPrefs] = useState(listeningPrefs);
  useEffect(() => {
    const refresh = () => setPrefs(listeningPrefs());
    window.addEventListener('misu:listening', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('misu:listening', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return prefs;
}
export function ListeningControls() {
  return (
    <div className="listening-controls">
      <ListeningRate />
      <ListenFirstToggle />
    </div>
  );
}
export function ListeningRate() {
  const prefs = useListeningPrefs();
  return (
    <label className="listening-rate">
      Tốc độ nghe{' '}
      <select aria-label="Tốc độ nghe" value={prefs.rate} onChange={(e) => updateListeningPrefs({ rate: Number(e.target.value) })}>
        {SPEEDS.map((rate) => (
          <option key={rate} value={rate}>
            {rate.toFixed(2).replace(/0$/, '')}×
          </option>
        ))}
      </select>
    </label>
  );
}
export function ListenFirstToggle() {
  const prefs = useListeningPrefs();
  return (
    <label className="listen-first-toggle">
      <input type="checkbox" checked={prefs.listenFirst} onChange={(e) => updateListeningPrefs({ listenFirst: e.target.checked })} />
      Nhập vai: nghe trước, bấm mới hiện chữ
    </label>
  );
}
export function SlowListen({ onPlay, disabled = false }: { onPlay: () => unknown; disabled?: boolean }) {
  return (
    <button type="button" className="lesson-secondary slow-listen" disabled={disabled} onClick={() => withSpeechRate(0.7, onPlay)}>
      Nghe chậm 0.7×
    </button>
  );
}
export function ListenFirstLine({
  text,
  translation,
  onPlay,
  hidden = true,
}: {
  text: string;
  translation?: string;
  onPlay: () => unknown;
  hidden?: boolean;
}) {
  const prefs = useListeningPrefs();
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [text]);
  const hide = hidden && prefs.listenFirst && !revealed;
  return (
    <div className="listen-first-line">
      <div className="lesson-actions">
        <button type="button" className="lesson-secondary" onClick={onPlay}>
          Nghe câu
        </button>
        <SlowListen onPlay={onPlay} />
        {hide && (
          <button type="button" className="lesson-secondary" onClick={() => setRevealed(true)}>
            Hiện chữ và nghĩa
          </button>
        )}
      </div>
      {hide ? (
        <p>Nghe trước rồi mở chữ để đối chiếu.</p>
      ) : (
        <>
          <p><Han text={text} /></p>
          {translation && <small>{translation}</small>}
        </>
      )}
    </div>
  );
}
