import { useEffect, useRef, useState } from 'react';
import type { CoachFeedback, MistakeCategory } from '../types';
import type { Tier } from '../lib/tier';
import { listen } from '../lib/voiceInput';
import type { VoiceHandle } from '../lib/voiceInput';
import { readingOk } from '../lib/readingScore.mjs';
import { MicIcon, VolumeIcon } from './Icons';

export interface CoachCardProps {
  feedback: CoachFeedback;
  tier: Tier;
  /** đọc một câu tiếng Trung bằng giọng mẫu */
  onSay: (text: string) => void;
  /** dùng bộ nhận giọng trên máy để người học nói lại câu đúng; false thì ẩn nút */
  localStt: boolean;
  learnerId?: string;
  compact?: boolean; // dùng trong bài học: bớt khoảng trắng
}

const CATEGORY_LABEL: Record<MistakeCategory, string> = {
  grammar: 'Ngữ pháp',
  word_choice: 'Dùng từ',
  word_order: 'Trật tự từ',
  measure_word: 'Lượng từ',
  other: 'Khác',
};

/** Split `said` so every issue's `original` (found as a substring) is marked as wrong. */
function markedSaid(said: string, originals: string[]) {
  const ranges: Array<[number, number]> = [];
  for (const original of originals) {
    const text = original.trim();
    if (!text) continue;
    const start = said.indexOf(text);
    if (start < 0) continue;
    const end = start + text.length;
    if (ranges.some(([a, b]) => start < b && end > a)) continue;
    ranges.push([start, end]);
  }
  if (!ranges.length) return [{ text: said, bad: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: Array<{ text: string; bad: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: said.slice(cursor, start), bad: false });
    parts.push({ text: said.slice(start, end), bad: true });
    cursor = end;
  }
  if (cursor < said.length) parts.push({ text: said.slice(cursor), bad: false });
  return parts;
}

type Retry = { state: 'idle' } | { state: 'listening' } | { state: 'ok' } | { state: 'miss'; heard: string };

function SayButton({ text, label, onSay }: { text: string; label: string; onSay: (text: string) => void }) {
  return (
    <button className="coach-say" type="button" onClick={() => onSay(text)} aria-label={label} title={label}>
      <VolumeIcon size={15} />
    </button>
  );
}

export function CoachPending() {
  return (
    <p className="coach-pending" role="status">
      <span className="coach-pending-dot" aria-hidden="true" />
      Coach đang xem câu của bạn…
    </p>
  );
}

export function CoachCard({ feedback, tier, onSay, localStt, learnerId, compact = false }: CoachCardProps) {
  const [retry, setRetry] = useState<Retry>({ state: 'idle' });
  const handleRef = useRef<VoiceHandle | null>(null);
  useEffect(() => () => handleRef.current?.cancel(), []);

  const { verdict, said, corrected, correctedPinyin, issues, natural, naturalVi, pattern, patternVi, praise } = feedback;
  const foundation = tier === 'foundation';
  const cls = `coach-card is-${verdict}${foundation ? ' is-foundation' : ''}${compact ? ' is-compact' : ''}`;

  if (verdict === 'ok') {
    return (
      <section className={cls} aria-label="Nhận xét của Coach">
        <p className="coach-ok-line">
          <span className="coach-ok-mark" aria-hidden="true">✓</span>
          <strong>Câu đúng</strong>
          {praise && <span className="coach-praise"> — {praise}</span>}
        </p>
        {pattern && (
          <p className="coach-pattern-line">
            <span className="coach-label-inline">Khuôn câu:</span> <span className="coach-pattern-zh">{pattern}</span>
            {patternVi && <span className="coach-muted"> — {patternVi}</span>}
          </p>
        )}
      </section>
    );
  }

  const showNatural = Boolean(natural) && natural !== corrected;
  const target = !foundation && showNatural ? natural : corrected || natural;
  const parts = markedSaid(said, issues.map((issue) => issue.original));

  const speakAgain = async () => {
    if (retry.state === 'listening') {
      handleRef.current?.stop();
      return;
    }
    if (!target) return;
    setRetry({ state: 'listening' });
    try {
      const handle = listen({ local: localStt, learnerId, pronounce: target, silenceMs: 1600, maxMs: 30000 });
      handleRef.current = handle;
      const result = await handle.details;
      const heard = result.text.trim();
      if (!heard) setRetry({ state: 'idle' });
      else setRetry(readingOk(target, heard) ? { state: 'ok' } : { state: 'miss', heard });
    } catch {
      setRetry({ state: 'idle' });
    } finally {
      handleRef.current = null;
    }
  };

  return (
    <section className={cls} aria-label="Nhận xét của Coach">
      <h4 className="coach-title">
        <span className="coach-mark" aria-hidden="true">{verdict === 'polish' ? '润' : '修'}</span>
        {verdict === 'polish' ? 'Câu đúng, nói tự nhiên hơn thế này' : 'Coach sửa câu của bạn'}
      </h4>

      {said && (
        <div className="coach-block">
          <p className="coach-label">Bạn nói</p>
          <p className="coach-said">
            {parts.map((part, index) =>
              part.bad ? (
                <mark className="coach-bad" key={index}>{part.text}</mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="coach-block">
          <p className="coach-label">Vì sao</p>
          <ul className="coach-issues">
            {issues.map((issue, index) => (
              <li key={`${issue.original}-${index}`}>
                <p className="coach-issue-line">
                  <span className="coach-issue-from">{issue.original}</span>
                  <span className="coach-arrow" aria-hidden="true">→</span>
                  <span className="coach-issue-to">{issue.corrected}</span>
                  <span className="coach-cat">{CATEGORY_LABEL[issue.category] ?? CATEGORY_LABEL.other}</span>
                </p>
                {issue.why && <p className="coach-why">{issue.why}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {corrected && (
        <div className="coach-block">
          <p className="coach-label">Nói đúng</p>
          <div className="coach-sentence">
            <div className="coach-sentence-text">
              <p className="coach-zh">{corrected}</p>
              {correctedPinyin && <p className="coach-pinyin">{correctedPinyin}</p>}
            </div>
            <SayButton text={corrected} label="Nghe câu đúng" onSay={onSay} />
          </div>
        </div>
      )}

      {showNatural && (
        <div className="coach-block">
          <p className="coach-label">Người Trung hay nói</p>
          <div className="coach-sentence">
            <div className="coach-sentence-text">
              <p className="coach-zh coach-zh-natural">{natural}</p>
              {naturalVi && <p className="coach-why">{naturalVi}</p>}
            </div>
            <SayButton text={natural} label="Nghe cách nói tự nhiên" onSay={onSay} />
          </div>
        </div>
      )}

      {pattern && (
        <div className="coach-block coach-pattern">
          <p className="coach-label">Khuôn câu</p>
          <p className="coach-pattern-line">
            <span className="coach-pattern-zh">{pattern}</span>
            {patternVi && <span className="coach-muted"> — {patternVi}</span>}
          </p>
        </div>
      )}

      {localStt && target && (
        <div className="coach-retry">
          <button
            className={`coach-retry-btn${retry.state === 'listening' ? ' is-live' : ''}`}
            type="button"
            onClick={() => void speakAgain()}
            aria-pressed={retry.state === 'listening'}
            aria-label={retry.state === 'listening' ? 'Dừng ghi âm' : 'Nói lại câu đúng'}
          >
            <MicIcon size={15} />
            {retry.state === 'listening' ? 'Đang nghe… bấm để xong' : 'Nói lại câu đúng'}
          </button>
          {retry.state === 'ok' && <span className="coach-retry-ok" role="status">✓ Đúng rồi</span>}
          {retry.state === 'miss' && (
            <span className="coach-retry-miss" role="status">
              Máy nghe ra: {retry.heard}, thử lại
            </span>
          )}
        </div>
      )}
    </section>
  );
}
