import { useState } from 'react';
import type { Learner } from '../lib/learners';
import { loadProgress } from '../lib/storage';
import type { Level } from '../types';

const LEVEL_OPTIONS: { id: Level; label: string; hint: string }[] = [
  { id: 'HSK1-2', label: 'HSK 1–2', hint: 'Câu rất ngắn, nói chậm, từ cơ bản' },
  { id: 'HSK3-4', label: 'HSK 3–4', hint: 'Câu đơn giản, chủ đề đời thường' },
  { id: 'HSK5-6', label: 'HSK 5–6', hint: 'Hội thoại dài, tự nhiên' },
  { id: 'free', label: 'Tự do', hint: 'Nói chuyện như bạn bè' },
];

interface LearnerPickerProps {
  learners: Learner[];
  onPick: (id: string) => void;
  onCreate: (name: string, level: Level) => void;
}

export function LearnerPicker({ learners, onPick, onCreate }: LearnerPickerProps) {
  const [adding, setAdding] = useState(learners.length === 0);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('HSK5-6');
  const trimmed = name.trim();

  return (
    <div className="learner-screen">
      <div className="learner-card">
        <p className="learner-eyebrow">米苏 · Misu</p>
        <h1 className="learner-title">Ai đang học hôm nay?</h1>
        <p className="learner-lead">
          Mỗi người có lịch sử hội thoại, trình độ và bài ôn riêng. Chọn đúng tên trước khi bắt đầu.
        </p>

        {learners.length > 0 && (
          <div className="learner-list">
            {learners.map((item) => {
              const progress = loadProgress(item.id);
              const levelLabel = LEVEL_OPTIONS.find((option) => option.id === item.level)?.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="learner-option"
                  onClick={() => onPick(item.id)}
                >
                  <span className="learner-initial" aria-hidden="true">
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="learner-option-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {levelLabel} · {progress.totalTurns} lượt luyện · chuỗi {progress.streak} ngày
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!adding && (
          <button className="learner-add-toggle" type="button" onClick={() => setAdding(true)}>
            + Thêm người học
          </button>
        )}

        {adding && (
          <form
            className="learner-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!trimmed) return;
              onCreate(trimmed, level);
            }}
          >
            <label className="field">
              <span className="field-label">Tên</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={30}
                placeholder="Ví dụ: Lan"
                autoFocus
              />
            </label>

            <div className="learner-levels" role="radiogroup" aria-label="Trình độ">
              {LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={level === option.id}
                  className={`learner-level${level === option.id ? ' is-active' : ''}`}
                  onClick={() => setLevel(option.id)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>

            <button className="learner-submit" type="submit" disabled={!trimmed}>
              Bắt đầu luyện
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
