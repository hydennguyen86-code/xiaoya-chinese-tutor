import type { ToneReport } from '../lib/voiceInput';

const TONE_HINT: Record<number, string> = {
  1: 'Thanh 1: giữ giọng cao và bằng, như ngân một nốt dài.',
  2: 'Thanh 2: đi lên từ giữa lên cao, giống khi hỏi lại "hả?".',
  3: 'Thanh 3: hạ giọng xuống thật thấp trước, rồi mới lên nhẹ (hoặc không lên).',
  4: 'Thanh 4: bắt đầu cao rồi rơi dứt khoát xuống, như khi ra lệnh.',
};

/** Per-syllable tone verdicts for a word, or the pitch curve for a sentence. */
export function ToneFeedback({ report }: { report: ToneReport }) {
  if (report.mode === 'sentence') {
    return (
      <div className="tone-feedback">
        {report.curve && report.curve.some((v) => v !== null) ? (
          <>
            <PitchCurve learner={report.curve} model={report.modelCurve ?? []} />
            <p className="lesson-hint">
              Chấm tự động mới được thử trên giọng máy. Đường cao độ của bạn (cam) và của giọng mẫu (xanh). Hai đường được kéo về cùng độ dài, chưa căn theo từng chữ; khác nhịp đọc cũng làm đường lệch. Chỉ tham khảo dáng chung.
            </p>
          </>
        ) : (
          report.note && <p className="lesson-hint">{report.note}</p>
        )}
      </div>
    );
  }

  const wrong = report.syllables.filter((s) => s.ok === false);
  return (
    <div className="tone-feedback">
      <p className="lesson-hint">Chấm tự động mới được thử trên giọng máy; hãy xem kết quả là gợi ý.</p>
      <div className="tone-syllables">
        {report.syllables.map((s, i) => (
          <span
            key={`${s.char}-${i}`}
            className={`tone-syllable ${s.ok === true ? 'is-ok' : s.ok === false ? 'is-wrong' : 'is-unclear'}`}
            title={s.ok === null ? 'Chưa chấm được chữ này' : `Cần thanh ${s.expected}, mình nghe thanh ${s.heard}`}
          >
            <small>{s.pinyin}</small>
            <span>{s.char}</span>
            <em>{s.ok === true ? `thanh ${s.expected} ✓` : s.ok === false ? `nghe như thanh ${s.heard}` : '—'}</em>
          </span>
        ))}
      </div>
      {report.checked > 0 && !wrong.length && (
        report.checked === report.syllables.filter((s) => s.expected).length ? (
          <p className="lesson-ok">Lần này Misu nghe các thanh khớp với mẫu.</p>
        ) : (
          <p className="lesson-hint">Các chữ chấm được đều đúng thanh. Chữ có dấu — thì chưa chấm được: đọc rõ và kéo dài hơn một chút nhé.</p>
        )
      )}
      {report.checked === 0 && !report.note && report.syllables.length > 0 && (
        <p className="lesson-hint">Chưa chấm được thanh điệu lần này: đọc rõ, chậm và kéo dài từng chữ hơn một chút nhé.</p>
      )}
      {wrong.map((s, i) => (
        <p key={`${s.char}-hint-${i}`} className="lesson-hint">
          <strong>{s.char}</strong> — {TONE_HINT[s.expected]}
        </p>
      ))}
      {report.note && <p className="lesson-hint">{report.note}</p>}
    </div>
  );
}

const W = 300;
const H = 90;
const RANGE = 8; // semitones above and below the speaker's middle

function paths(values: (number | null)[]) {
  if (values.length < 2) return [];
  const out: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (current) out.push(current);
      current = '';
      return;
    }
    const x = (i / (values.length - 1)) * W;
    const y = H / 2 - (Math.max(-RANGE, Math.min(RANGE, v)) / RANGE) * (H / 2 - 4);
    current += `${current ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  if (current) out.push(current);
  return out;
}

function PitchCurve({ learner, model }: { learner: (number | null)[]; model: (number | null)[] }) {
  return (
    <svg className="tone-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Đường cao độ của bạn so với giọng mẫu">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="tone-curve-mid" />
      {paths(model).map((d, i) => (
        <path key={`m${i}`} d={d} className="tone-curve-model" />
      ))}
      {paths(learner).map((d, i) => (
        <path key={`l${i}`} d={d} className="tone-curve-learner" />
      ))}
    </svg>
  );
}
