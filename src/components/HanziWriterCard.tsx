import { useEffect, useRef, useState } from 'react';
import type HanziWriterType from 'hanzi-writer';

// Stroke-order animation and tracing quiz for the characters of a word, drawn
// with hanzi-writer. Stroke data comes from the local server (/api/hanzi/:char),
// so it works offline. The quiz only says "đúng nét/thử lại"; it is practice,
// not a score that is saved anywhere.

type Mode = 'idle' | 'animate' | 'quiz';

export function HanziWriterCard({ word, size = 150 }: { word: string; size?: number }) {
  const chars = [...word].filter((c) => /\p{Script=Han}/u.test(c));
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriterType | null>(null);
  const char = chars[Math.min(index, chars.length - 1)] || '';

  useEffect(() => setIndex(0), [word]);

  useEffect(() => {
    if (!open || !box.current || !char) return;
    let cancelled = false;
    const host = box.current;
    host.replaceChildren();
    setStatus('');
    setMode('idle');
    import('hanzi-writer')
      .then(({ default: HanziWriter }) => {
        if (cancelled) return;
        const instance = HanziWriter.create(host, char, {
          width: size,
          height: size,
          padding: 10,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 220,
          strokeColor: '#4f6049',
          radicalColor: '#c47a5a',
          outlineColor: '#d9d4c7',
          drawingColor: '#2f3a2c',
          drawingWidth: 14,
          showHintAfterMisses: 2,
          highlightOnComplete: true,
          charDataLoader: (c, onLoad, onError) => {
            fetch(`/api/hanzi/${encodeURIComponent(c)}`)
              .then((res) => (res.ok ? res.json() : Promise.reject(new Error('no data'))))
              .then((data) => onLoad(data))
              .catch((error: Error) => onError(error));
          },
          onLoadCharDataError: () => setStatus('Chưa có dữ liệu nét cho chữ này.'),
        });
        writer.current = instance;
      })
      .catch(() => setStatus('Không tải được công cụ viết chữ.'));
    return () => {
      cancelled = true;
      writer.current?.cancelQuiz?.();
      writer.current = null;
      host.replaceChildren();
    };
  }, [open, char, size]);

  if (!chars.length) return null;

  const animate = () => {
    const w = writer.current;
    if (!w) return;
    w.cancelQuiz();
    setMode('animate');
    setStatus('Nhìn thứ tự nét.');
    w.animateCharacter({ onComplete: () => setMode('idle') });
  };
  const quiz = () => {
    const w = writer.current;
    if (!w) return;
    setMode('quiz');
    setStatus('Dùng ngón tay hoặc chuột viết theo nét.');
    w.quiz({
      showHintAfterMisses: 2,
      onMistake: (data: { totalMistakes: number }) =>
        setStatus(data.totalMistakes > 2 ? 'Nhìn gợi ý nét sáng rồi viết theo nhé.' : 'Thử lại nét này.'),
      onCorrectStroke: (data: { strokeNum: number; strokesRemaining: number }) =>
        setStatus(data.strokesRemaining ? `Đúng nét ${data.strokeNum + 1}! Còn ${data.strokesRemaining} nét.` : ''),
      onComplete: (data: { totalMistakes: number }) => {
        setMode('idle');
        setStatus(
          data.totalMistakes === 0
            ? `Viết đúng chữ ${char} không sai nét nào! ⭐`
            : `Xong chữ ${char}. Sai ${data.totalMistakes} lần, lần sau sẽ tốt hơn.`,
        );
      },
    });
  };

  if (!open) {
    return (
      <div className="hanzi-writer">
        <div className="hanzi-writer-controls">
          <button type="button" onClick={() => setOpen(true)}>
            ✍️ Tập viết {word}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="hanzi-writer">
      <div ref={box} className="hanzi-writer-box" aria-label={`Ô viết chữ ${char}`} />
      <div className="hanzi-writer-controls">
        {chars.length > 1 && (
          <div className="hanzi-writer-chars" role="tablist" aria-label="Chọn chữ">
            {chars.map((c, i) => (
              <button
                key={`${c}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={mode === 'animate' ? 'is-active' : ''} onClick={animate}>
          ▶ Xem nét
        </button>
        <button type="button" className={mode === 'quiz' ? 'is-active' : ''} onClick={quiz}>
          ✍️ Tự viết
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Đóng
        </button>
        {status && <p className="hanzi-writer-status">{status}</p>}
      </div>
    </div>
  );
}
