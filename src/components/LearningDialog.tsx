import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AnalysisReport,
  LearningProfile,
  MistakeCategory,
  SkillKey,
} from '../types';
import {
  SKILL_LABELS,
  daysUntil,
  dueWords,
  hasAnalysisData,
  latestReport,
  learningPeriodDays,
  learningTotals,
  nextDueAt,
  reportAgeDays,
  skillBreakdown,
  topMistakes,
  weakWords,
} from '../lib/learning';
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  CloseIcon,
  FlameIcon,
  PlayIcon,
  SparkIcon,
  VolumeIcon,
} from './Icons';

type LearningTab = 'overview' | 'review' | 'mistakes' | 'analysis';

interface LearningDialogProps {
  open: boolean;
  learning: LearningProfile;
  levelLabel: string;
  canAnalyze: boolean;
  analyzing: boolean;
  analysisError: string | null;
  onClose: () => void;
  onReviewWord: (word: string, remembered: boolean) => void;
  onAnalyze: () => void;
  onSpeakChinese: (text: string) => void;
  onSpeakVietnamese: (text: string) => void;
  onClearLearning: () => void;
}

function formatDate(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortDate(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function untilLabel(timestamp: number) {
  if (!timestamp) return 'chưa có lịch';
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'bây giờ';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} phút nữa`;
  const hours = Math.ceil(diff / 3600000);
  if (hours < 24) return `${hours} giờ nữa`;
  return `${Math.ceil(diff / 86400000)} ngày nữa`;
}

function skillLabel(skill: SkillKey) {
  return SKILL_LABELS[skill] || SKILL_LABELS.other;
}

const NEXT_INTERVAL_DAYS = [1, 3, 7, 14, 30, 30];

function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="learning-empty">
      <span className="learning-empty-mark">
        <BookIcon size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

function WeaknessCard({ report }: { report: AnalysisReport }) {
  return (
    <div className="analysis-weaknesses">
      {report.weaknesses.map((weakness, index) => (
        <article className="analysis-weakness" key={`${weakness.title}-${index}`}>
          <div className="analysis-weakness-head">
            <span className="analysis-skill">{skillLabel(weakness.skill)}</span>
            <span className="analysis-index">{index + 1}</span>
          </div>
          <h4>{weakness.title}</h4>
          {weakness.evidence && <p className="analysis-evidence">{weakness.evidence}</p>}
          {weakness.advice && <p className="analysis-advice">{weakness.advice}</p>}
          {weakness.practice && (
            <p className="analysis-practice">
              <SparkIcon size={13} />
              {weakness.practice}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

export function LearningDialog({
  open,
  learning,
  levelLabel,
  canAnalyze,
  analyzing,
  analysisError,
  onClose,
  onReviewWord,
  onAnalyze,
  onSpeakChinese,
  onSpeakVietnamese,
  onClearLearning,
}: LearningDialogProps) {
  const [tab, setTab] = useState<LearningTab>('overview');
  const [session, setSession] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const totals = useMemo(() => learningTotals(learning), [learning]);
  const skills = useMemo(() => skillBreakdown(learning), [learning]);
  const mistakes = useMemo(() => topMistakes(learning, 30), [learning]);
  const words = useMemo(() => weakWords(learning, 12), [learning]);
  const due = useMemo(() => dueWords(learning), [learning]);
  const report = latestReport(learning);
  const nextReview = nextDueAt(learning);
  const periodDays = learningPeriodDays(learning);
  const readyForAnalysis = hasAnalysisData(learning);
  const currentWord =
    session.length > 0
      ? learning.words.find((word) => word.word === session[0]) || null
      : null;

  useEffect(() => {
    if (!open) return;
    setTab('overview');
    setSession([]);
    setReviewed(0);
    setRevealed(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const startReview = () => {
    setSession(dueWords(learning).map((word) => word.word));
    setReviewed(0);
    setRevealed(false);
    setTab('review');
  };

  const answer = (remembered: boolean) => {
    if (!currentWord) return;
    onReviewWord(currentWord.word, remembered);
    setSession((current) => current.slice(1));
    setReviewed((current) => current + 1);
    setRevealed(false);
  };

  const switchTab = (next: LearningTab) => {
    setTab(next);
    if (next === 'review' && !session.length && !reviewed && due.length) {
      setSession(dueWords(learning).map((word) => word.word));
      setRevealed(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="settings-dialog learning-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-title"
      >
        <header className="settings-head learning-head">
          <div className="settings-heading">
            <span className="settings-seal learning-seal" aria-hidden="true">
              学
            </span>
            <div>
              <h2 id="learning-title">Hồ sơ học tập</h2>
              <p>Lỗi hay gặp, từ cần ôn và phân tích sau mỗi chặng luyện.</p>
            </div>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Đóng hồ sơ học tập"
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="learning-tabs" role="tablist" aria-label="Các mục hồ sơ">
          {(
            [
              ['overview', 'Tổng quan'],
              ['review', totals.due ? `Ôn từ (${totals.due})` : 'Ôn từ'],
              ['mistakes', 'Lỗi cần nhớ'],
              ['analysis', 'Phân tích AI'],
            ] as Array<[LearningTab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              className={`learning-tab${tab === value ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => switchTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="settings-body learning-body">
          {tab === 'overview' && (
            <div className="learning-overview">
              <div className="learning-hero">
                <div className="learning-hero-copy">
                  <span className="learning-kicker">
                    <FlameIcon size={14} />
                    {levelLabel}
                  </span>
                  <h3>
                    {totals.words
                      ? `${totals.words} từ đã ghi, ${totals.due} từ đang chờ ôn`
                      : 'Bắt đầu ghi lại hành trình của bạn'}
                  </h3>
                  <p>
                    Misu tự lưu lỗi và từ mới sau mỗi lượt nói. Dữ liệu nằm trong
                    trình duyệt này và chỉ gửi đến model local khi bạn yêu cầu phân tích.
                  </p>
                </div>
                <div className="learning-hero-seal" aria-hidden="true">
                  <span>{totals.activeDays}</span>
                  <small>ngày học</small>
                </div>
              </div>

              <div className="learning-stats">
                <div>
                  <strong>{totals.due}</strong>
                  <span>từ đến hạn</span>
                </div>
                <div>
                  <strong>{totals.mistakes}</strong>
                  <span>kiểu lỗi</span>
                </div>
                <div>
                  <strong>{totals.reviews}</strong>
                  <span>lượt ôn</span>
                </div>
                <div>
                  <strong>{totals.turns}</strong>
                  <span>lượt nói</span>
                </div>
              </div>

              <section className="learning-section">
                <div className="learning-section-head">
                  <div>
                    <h3>Kỹ năng cần chú ý</h3>
                    <p>Dựa trên các lỗi đã được Misu ghi lại.</p>
                  </div>
                  <span className="learning-count">{totals.corrections} lỗi</span>
                </div>
                {skills.length ? (
                  <div className="skill-list">
                    {skills.map((skill) => {
                      const max = skills[0]?.count || 1;
                      return (
                        <div className="skill-row" key={skill.skill}>
                          <div className="skill-row-copy">
                            <span>{skill.label}</span>
                            <strong>{skill.count} lần</strong>
                          </div>
                          <div className="skill-track">
                            <span
                              style={{ width: `${Math.max(8, (skill.count / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="learning-muted">
                    Chưa có lỗi nào được ghi. Cứ nói tự nhiên, Misu sẽ để ý giúp bạn.
                  </p>
                )}
              </section>

              <div className="learning-two-col">
                <section className="learning-section">
                  <div className="learning-section-head">
                    <div>
                      <h3>Lỗi lặp lại nhiều</h3>
                      <p>Ưu tiên sửa những mẫu này trước.</p>
                    </div>
                  </div>
                  {mistakes.length ? (
                    <div className="mini-mistake-list">
                      {mistakes.slice(0, 4).map((mistake) => (
                        <div className="mini-mistake" key={mistake.id}>
                          <div className="mini-mistake-line">
                            <span className="correction-wrong">{mistake.original}</span>
                            <ArrowRightIcon size={12} />
                            <span className="correction-right">{mistake.corrected}</span>
                            <span className="mini-mistake-count">×{mistake.count}</span>
                          </div>
                          <p>{mistake.explanation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="learning-muted">Chưa có lỗi lặp lại.</p>
                  )}
                </section>

                <section className="learning-section">
                  <div className="learning-section-head">
                    <div>
                      <h3>Từ cần ôn</h3>
                      <p>Những từ sắp đến hạn hoặc hay bị quên.</p>
                    </div>
                  </div>
                  {words.length ? (
                    <div className="mini-word-list">
                      {words.slice(0, 4).map((word) => (
                        <button
                          className="mini-word"
                          type="button"
                          key={word.word}
                          onClick={() => {
                            setTab('review');
                            setSession([word.word]);
                            setReviewed(0);
                            setRevealed(false);
                          }}
                        >
                          <span className="mini-word-main">
                            <strong>{word.word}</strong>
                            <small>{word.pinyin}</small>
                          </span>
                          <span className="mini-word-meaning">{word.meaning}</span>
                          <span className="mini-word-due">
                            {word.dueAt <= Date.now()
                              ? 'Đến hạn'
                              : untilLabel(word.dueAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="learning-muted">Chưa có từ nào. Hãy trò chuyện thêm nhé.</p>
                  )}
                </section>
              </div>

              <div className="learning-actions">
                <button
                  className="learning-primary"
                  type="button"
                  onClick={startReview}
                >
                  <PlayIcon size={15} />
                  {totals.due ? `Ôn ngay ${totals.due} từ` : 'Xem kho từ'}
                </button>
                <button
                  className="learning-secondary"
                  type="button"
                  onClick={() => switchTab('analysis')}
                >
                  <SparkIcon size={15} />
                  {report ? 'Xem phân tích gần nhất' : 'Phân tích điểm yếu'}
                </button>
              </div>
            </div>
          )}

          {tab === 'review' && (
            <div className="review-panel">
              {currentWord ? (
                <>
                  <div className="review-progress">
                    <span>
                      Từ {reviewed + 1} / {reviewed + session.length}
                    </span>
                    <div className="review-track">
                      <span
                        style={{
                          width: `${Math.round(
                            (reviewed / Math.max(1, reviewed + session.length)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="review-card">
                    <span className="review-kicker">Ôn lại từ này</span>
                    <h3 className="review-word">{currentWord.word}</h3>
                    <button
                      className="review-audio"
                      type="button"
                      onClick={() => onSpeakChinese(currentWord.word)}
                    >
                      <VolumeIcon size={15} />
                      Nghe phát âm
                    </button>

                    {revealed ? (
                      <div className="review-answer">
                        <p className="review-pinyin">{currentWord.pinyin}</p>
                        <p className="review-meaning">{currentWord.meaning}</p>
                        <div className="review-meta">
                          <span>Đã gặp {currentWord.count} lần</span>
                          <span>Quên {currentWord.lapses} lần</span>
                          <span>Mức nhớ {currentWord.box}/5</span>
                        </div>
                        <button
                          className="review-audio review-audio-vi"
                          type="button"
                          onClick={() => onSpeakVietnamese(currentWord.meaning)}
                        >
                          <VolumeIcon size={14} />
                          Nghe nghĩa tiếng Việt
                        </button>
                      </div>
                    ) : (
                      <button
                        className="review-reveal"
                        type="button"
                        onClick={() => setRevealed(true)}
                      >
                        Xem nghĩa
                      </button>
                    )}
                  </div>

                  {revealed && (
                    <div className="review-actions">
                      <button
                        className="review-button is-again"
                        type="button"
                        onClick={() => answer(false)}
                      >
                        Chưa nhớ
                        <small>ôn lại sau 10 phút</small>
                      </button>
                      <button
                        className="review-button is-good"
                        type="button"
                        onClick={() => answer(true)}
                      >
                        <CheckIcon size={16} />
                        Đã nhớ
                        <small>
                          hẹn lại sau{' '}
                          {NEXT_INTERVAL_DAYS[Math.min(currentWord.box, 5)]} ngày
                        </small>
                      </button>
                    </div>
                  )}
                </>
              ) : reviewed > 0 ? (
                <div className="review-complete">
                  <span className="review-complete-mark">
                    <CheckIcon size={26} />
                  </span>
                  <h3>Ôn xong {reviewed} từ</h3>
                  <p>
                    {nextReview
                      ? `Từ tiếp theo đến hạn ${untilLabel(nextReview)}.`
                      : 'Hiện không còn từ nào đến hạn.'}
                  </p>
                  <div className="review-complete-actions">
                    {dueWords(learning).length > 0 && (
                      <button className="learning-primary" type="button" onClick={startReview}>
                        Ôn tiếp {dueWords(learning).length} từ
                      </button>
                    )}
                    <button
                      className="learning-secondary"
                      type="button"
                      onClick={() => setTab('overview')}
                    >
                      Về tổng quan
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title={
                    totals.words ? 'Hôm nay không có từ đến hạn' : 'Chưa có từ để ôn'
                  }
                  description={
                    totals.words
                      ? `Kho từ có ${totals.words} từ. Từ gần nhất sẽ đến hạn ${untilLabel(nextReview)}.`
                      : 'Hãy trò chuyện vài lượt, Misu sẽ ghi lại những từ đáng nhớ cho bạn.'
                  }
                >
                  {totals.words > 0 && (
                    <div className="upcoming-words">
                      {words.slice(0, 6).map((word) => (
                        <div key={word.word} className="upcoming-word">
                          <strong>{word.word}</strong>
                          <span>{word.pinyin}</span>
                          <small>
                            {word.dueAt <= Date.now()
                              ? 'đến hạn'
                              : `${daysUntil(word.dueAt)} ngày nữa`}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </EmptyState>
              )}
            </div>
          )}

          {tab === 'mistakes' && (
            <div className="mistakes-panel">
              {mistakes.length ? (
                <>
                  <div className="learning-section-head mistakes-head">
                    <div>
                      <h3>Những lỗi đáng nhớ</h3>
                      <p>Sắp theo số lần lặp lại. Bấm nghe câu đúng nếu cần.</p>
                    </div>
                    <span className="learning-count">{totals.corrections} lỗi</span>
                  </div>
                  <div className="mistake-list">
                    {mistakes.map((mistake) => (
                      <article className="mistake-card" key={mistake.id}>
                        <div className="mistake-top">
                          <span
                            className={`mistake-category category-${mistake.category as MistakeCategory}`}
                          >
                            {skillLabel(mistake.category)}
                          </span>
                          <span className="mistake-count">gặp {mistake.count} lần</span>
                        </div>
                        <div className="mistake-line">
                          <span className="correction-wrong">{mistake.original}</span>
                          <ArrowRightIcon size={14} />
                          <span className="correction-right">{mistake.corrected}</span>
                          <button
                            className="mistake-audio"
                            type="button"
                            onClick={() => onSpeakChinese(mistake.corrected)}
                            title="Nghe câu đúng"
                          >
                            <VolumeIcon size={14} />
                          </button>
                        </div>
                        <p className="mistake-explanation">{mistake.explanation}</p>
                        {mistake.contexts.length > 0 && (
                          <p className="mistake-context">
                            Câu của bạn: “{mistake.contexts[mistake.contexts.length - 1]}”
                          </p>
                        )}
                        <span className="mistake-date">
                          Gần nhất {formatShortDate(mistake.lastSeen)}
                        </span>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Chưa có lỗi nào"
                  description="Khi Misu phát hiện một lỗi rõ ràng, lỗi đó sẽ được ghi ở đây để bạn xem lại."
                />
              )}
            </div>
          )}

          {tab === 'analysis' && (
            <div className="analysis-panel">
              <div className="analysis-heading">
                <div>
                  <h3>Phân tích điểm yếu</h3>
                  <p>
                    Dựa trên {totals.turns} lượt nói, {totals.mistakes} kiểu lỗi và{' '}
                    {totals.words} từ trong {periodDays} ngày.
                  </p>
                </div>
                <button
                  className="learning-primary analysis-run"
                  type="button"
                  onClick={onAnalyze}
                  disabled={analyzing || !canAnalyze || !readyForAnalysis}
                >
                  <SparkIcon size={15} />
                  {analyzing
                    ? 'Đang phân tích…'
                    : report
                      ? 'Phân tích lại'
                      : 'Phân tích bằng AI'}
                </button>
              </div>

              {!readyForAnalysis && (
                <div className="learning-inline-note">
                  <AlertIcon size={15} />
                  Cần thêm vài lượt luyện hoặc vài từ/lỗi được ghi để phân tích có ý nghĩa.
                </div>
              )}
              {!canAnalyze && (
                <div className="learning-inline-note">
                  <AlertIcon size={15} />
                  Chưa kết nối được model local. Kiểm tra Ollama hoặc LM Studio trong Cài đặt.
                </div>
              )}
              {analysisError && (
                <div className="learning-inline-note is-error">
                  <AlertIcon size={15} />
                  {analysisError}
                </div>
              )}

              {report ? (
                <>
                  {reportAgeDays(report) >= 3 && (
                    <div className="analysis-stale">
                      Bản phân tích này đã {reportAgeDays(report)} ngày. Bấm “Phân tích lại”
                      để cập nhật theo dữ liệu mới.
                    </div>
                  )}
                  <div className="analysis-summary">
                    <div className="analysis-summary-top">
                      <span className="learning-kicker">
                        <SparkIcon size={13} />
                        Phân tích ngày {formatDate(report.createdAt)}
                      </span>
                      <span>{report.periodDays} ngày dữ liệu</span>
                    </div>
                    <p>{report.summary}</p>
                  </div>

                  {report.strengths.length > 0 && (
                    <section className="analysis-section">
                      <h3>Điểm đang làm tốt</h3>
                      <div className="analysis-strengths">
                        {report.strengths.map((strength, index) => (
                          <span key={`${strength}-${index}`}>
                            <CheckIcon size={13} />
                            {strength}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {report.weaknesses.length > 0 && (
                    <section className="analysis-section">
                      <h3>Điểm yếu cần ưu tiên</h3>
                      <WeaknessCard report={report} />
                    </section>
                  )}

                  {report.focusWords.length > 0 && (
                    <section className="analysis-section">
                      <h3>Từ nên ôn lại</h3>
                      <div className="analysis-words">
                        {report.focusWords.map((word) => (
                          <div className="analysis-word" key={word.word}>
                            <div className="analysis-word-head">
                              <strong>{word.word}</strong>
                              <span>{word.pinyin}</span>
                              <button
                                type="button"
                                onClick={() => onSpeakChinese(word.word)}
                                aria-label={`Nghe ${word.word}`}
                              >
                                <VolumeIcon size={13} />
                              </button>
                            </div>
                            <p>{word.meaning}</p>
                            {word.why && <small>{word.why}</small>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {report.plan.length > 0 && (
                    <section className="analysis-section">
                      <h3>Kế hoạch vài ngày tới</h3>
                      <ol className="analysis-plan">
                        {report.plan.map((step, index) => (
                          <li key={`${step}-${index}`}>
                            <span>{index + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </>
              ) : (
                !analyzing && (
                  <EmptyState
                    title="Chưa có bản phân tích"
                    description={
                      readyForAnalysis
                        ? 'Bấm “Phân tích bằng AI” để xem kỹ năng nào yếu, từ nào hay quên và nên luyện gì tiếp theo.'
                        : 'Hãy luyện thêm vài lượt để có đủ dữ liệu phân tích.'
                    }
                  >
                    <div className="analysis-how">
                      <span>Model local đọc dữ liệu</span>
                      <ArrowRightIcon size={14} />
                      <span>Trả về điểm yếu + bài luyện</span>
                    </div>
                  </EmptyState>
                )
              )}
            </div>
          )}
        </div>

        <footer className="learning-footer">
          <p>
            Hồ sơ chỉ lưu trên trình duyệt này. Bạn có thể xoá bất cứ lúc nào.
          </p>
          <div className="data-actions">
            <button className="text-button danger" type="button" onClick={onClearLearning}>
              Xoá hồ sơ học tập
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
