import { ToneLabelFeedback } from './ToneLabelFeedback';
import { PronunciationRepair, type RepairContext } from './PronunciationRepair';
import { useTeacher } from '../lib/persona';
import { useEffect, useRef, useState } from 'react';
import type { ToneReport } from '../lib/voiceInput';

const TONE_HINT: Record<number, string> = {
  1: 'Thanh 1: giữ giọng cao và bằng, như ngân một nốt dài.',
  2: 'Thanh 2: đi lên từ giữa lên cao, giống khi hỏi lại "hả?".',
  3: 'Thanh 3: hạ giọng xuống thật thấp trước, rồi mới lên nhẹ (hoặc không lên).',
  4: 'Thanh 4: bắt đầu cao rồi rơi dứt khoát xuống, như khi ra lệnh.',
};

/** Per-syllable tone verdicts for a word, or the pitch curve for a sentence. */
export function ToneFeedback({
  report,
  audio,
  repair,
  learnerId,
  neutralTone = false,
}: {
  report: ToneReport;
  audio?: Blob;
  repair?: RepairContext;
  learnerId?: string;
  neutralTone?: boolean;
}) {
  const teacher = useTeacher();
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const sequence = useRef(0);
  const [playback, setPlayback] = useState('');
  const [repairChar, setRepairChar] = useState('');
  useEffect(() => setRepairChar(''), [report]);
  useEffect(
    () => () => {
      sequence.current += 1;
      source.current?.stop();
      void context.current?.close();
      context.current = null;
    },
    [report, audio],
  );
  async function replay(index: number) {
    const part = report.segments?.[index];
    if (!part || !audio) return;
    const turn = ++sequence.current;
    source.current?.stop();
    const ctx = context.current ?? new AudioContext();
    context.current = ctx;
    try {
      await ctx.resume();
      const play = async (buffer: ArrayBuffer, start: number, end: number) => {
        const decoded = await ctx.decodeAudioData(buffer);
        if (turn !== sequence.current) return;
        const node = ctx.createBufferSource();
        node.buffer = decoded;
        node.connect(ctx.destination);
        source.current = node;
        await new Promise<void>((resolve) => {
          node.onended = () => resolve();
          node.start(0, Math.max(0, start), Math.max(0.01, Math.min(end, decoded.duration) - start));
        });
      };
      setPlayback(`Đang phát ${part.char}: bản ghi của bạn`);
      await play(await audio.arrayBuffer(), part.start, part.end);
      const modelPart = report.model?.segments[index];
      if (turn === sequence.current && modelPart && report.model) {
        setPlayback(`Đang phát ${part.char}: giọng mẫu`);
        const binary = atob(report.model.audioBase64);
        await play(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)).buffer, modelPart.start, modelPart.end);
      }
      if (turn === sequence.current) setPlayback(modelPart ? '' : 'Chưa tải được giọng mẫu; đã phát bản ghi của bạn.');
    } catch {
      if (turn === sequence.current) setPlayback('Không phát được đoạn âm thanh.');
    }
  }
  const segments = report.segments ?? [];
  const comparison = (
    <>
      {report.fluencyReason && (
        <p className="lesson-hint">
          Chưa đo độ trôi chảy:{' '}
          {report.fluencyReason === 'stt-not-ready'
            ? 'nhận dạng cục bộ chưa sẵn sàng.'
            : report.fluencyReason === 'stt-failed'
              ? 'nhận dạng cục bộ gặp lỗi.'
              : report.fluencyReason === 'decode-failed'
                ? 'không giải mã được audio trên máy.'
                : report.fluencyReason === 'empty-transcript'
                  ? 'chưa nhận được lời nói.'
                  : 'âm thanh không đủ tiếng nói để đo.'}{' '}
          Không ghi điểm rỗng.
        </p>
      )}
      {report.curve?.some((v) => v !== null) && (
        <PitchCurve learner={report.curve} model={report.modelCurve ?? []} segments={segments} duration={report.duration ?? 0} />
      )}
      {segments.length > 0 && (
        <div className="tone-replay">
          {segments.map((part, index) => (
            <button
              type="button"
              key={index}
              disabled={!audio}
              onClick={() => void replay(index)}
              aria-label={`Nghe lại chữ ${part.char}: bạn rồi giọng mẫu`}
            >
              {part.char}
            </button>
          ))}
        </div>
      )}
      {segments.length > 0 && (
        <p className="lesson-hint">
          Mốc chữ ước lượng theo năng lượng, có thể cắt lệch khi đọc thiếu chữ hoặc khác nhịp. Bấm chữ để nghe bản ghi của bạn rồi đoạn
          tương ứng của giọng mẫu. Hai đường chưa căn chỉnh theo từng chữ.
        </p>
      )}
      {playback && <p role="status">{playback}</p>}
    </>
  );

  if (report.mode === 'sentence') {
    return (
      <div className="tone-feedback">
        {comparison}
        <ToneLabelFeedback
          key={report.syllables.map((s) => s.char).join('') + String(audio?.size)}
          report={report}
          audio={audio}
          learnerId={learnerId || repair?.learnerId}
        />
        {report.curve && report.curve.some((v) => v !== null) ? (
          <>
            <p className="lesson-hint">
              Chấm tự động mới được thử trên giọng máy. Đường cao độ của bạn (cam) và của giọng mẫu (xanh). Hai đường được kéo về cùng độ
              dài, chưa căn theo từng chữ; khác nhịp đọc cũng làm đường lệch. Chỉ tham khảo dáng chung.
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
      {comparison}
      <ToneLabelFeedback
        key={report.syllables.map((s) => s.char).join('') + String(audio?.size)}
        report={report}
        audio={audio}
        learnerId={learnerId || repair?.learnerId}
      />
      {repair &&
        wrong.map((s, i) => (
          <button type="button" key={i} onClick={() => setRepairChar(s.char)}>
            Luyện lại chữ {s.char}
          </button>
        ))}
      {repair && repairChar && (
        <PronunciationRepair key={repairChar} context={repair} char={repairChar} onClose={() => setRepairChar('')} />
      )}
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
      {report.checked > 0 &&
        !wrong.length &&
        (report.checked === report.syllables.filter((s) => s.expected).length ? (
          <p className="lesson-ok">Lần này {teacher.vi} nghe các thanh khớp với mẫu.</p>
        ) : (
          <p className="lesson-ok">Mọi chữ chấm được đều đúng thanh. Chữ có dấu — mình chưa đủ chắc để chấm, nên không tính là sai.</p>
        ))}
      {report.checked === 0 && neutralTone && report.syllables.length > 0 && (
        <p className="lesson-hint">Thanh nhẹ chưa được máy chấm cao độ. Nghe mẫu và đọc ngắn, nhẹ theo nhịp câu nhé.</p>
      )}
      {report.checked === 0 && !neutralTone && !report.note && report.syllables.length > 0 && (
        <p className="lesson-hint">Chưa chấm được thanh điệu lần này: đọc rõ, chậm và kéo dài từng chữ hơn một chút nhé.</p>
      )}
      {wrong.map((s, i) => (
        <p key={`${s.char}-hint-${i}`} className="lesson-hint">
          <strong>{s.char}</strong> — {TONE_HINT[s.expected]}
        </p>
      ))}
      {report.note && !(neutralTone && report.note.startsWith('Mình chưa quen giọng bạn:')) && <p className="lesson-hint">{report.note}</p>}
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

function PitchCurve({
  learner,
  model,
  segments,
  duration,
}: {
  learner: (number | null)[];
  model: (number | null)[];
  segments: NonNullable<ToneReport['segments']>;
  duration: number;
}) {
  return (
    <svg className="tone-curve" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Đường cao độ của bạn so với giọng mẫu">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="tone-curve-mid" />
      {duration > 0 &&
        segments.map((part, index) => (
          <g key={index}>
            <line x1={(part.start / duration) * W} x2={(part.start / duration) * W} y1={0} y2={H} stroke="currentColor" opacity="0.2" />
            <text x={((part.start + part.end) / 2 / duration) * W} y={H + 15} fontSize="11" textAnchor="middle" fill="currentColor">
              {part.char}
            </text>
          </g>
        ))}
      {paths(model).map((d, i) => (
        <path key={`m${i}`} d={d} className="tone-curve-model" />
      ))}
      {paths(learner).map((d, i) => (
        <path key={`l${i}`} d={d} className="tone-curve-learner" />
      ))}
    </svg>
  );
}
