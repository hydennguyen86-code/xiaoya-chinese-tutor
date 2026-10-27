import { useEffect, useRef, useState } from 'react';
import { CloseIcon, SparkIcon } from './Icons';
import { loadLearners, type Learner } from '../lib/learners';
import { loadLessonProgress } from '../lib/lessonStore';
import { loadProgress } from '../lib/storage';

export interface MotivationRow {
  id: string;
  name: string;
  todayTurns: number;
  totalTurns: number;
  streak: number;
  completed: number | null;
  xp: number;
}

/** Read each learner's existing counters without changing their data. */
export function motivationRows(learners: Learner[]): MotivationRow[] {
  return learners.map((learner) => {
    const progress = loadProgress(learner.id);
    const lesson = loadLessonProgress(learner.id);
    return {
      id: learner.id,
      name: learner.name,
      todayTurns: progress.todayTurns,
      totalTurns: progress.totalTurns,
      streak: progress.streak,
      completed: lesson && Number.isFinite(lesson.completed) ? Math.max(0, lesson.completed) : null,
      xp: progress.xp,
    };
  });
}

export function MotivationTable({ rows, activeId }: { rows: MotivationRow[]; activeId: string }) {
  if (!rows.length) return <p className="motivation-empty">Chưa có người học nào. Hãy tạo hồ sơ để bắt đầu hành trình nhé.</p>;
  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    const name = row.name.trim().toLocaleLowerCase('vi');
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return (
    <div className="motivation-table-scroll" tabIndex={0} aria-label="Bảng động lực">
      <table className="motivation-table">
        <caption>Bảng động lực của mọi người</caption>
        <thead>
          <tr>
            <th scope="col">Người học</th>
            <th scope="col">Hôm nay</th>
            <th scope="col">Tổng lượt</th>
            <th scope="col">Chuỗi ngày</th>
            <th scope="col">Buổi hoàn thành</th>
            <th scope="col">XP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={row.id === activeId ? 'motivation-current' : undefined}>
              <th scope="row">
                <span className="motivation-name">{row.name}</span>
                {(nameCounts.get(row.name.trim().toLocaleLowerCase('vi')) ?? 0) > 1 && (
                  <span className="motivation-profile">Hồ sơ {index + 1}</span>
                )}
                {row.id === activeId && <span className="motivation-you">Bạn</span>}
              </th>
              <td data-label="Hôm nay">{row.todayTurns}</td>
              <td data-label="Tổng lượt">{row.totalTurns}</td>
              <td data-label="Chuỗi ngày">{row.streak}</td>
              <td data-label="Buổi hoàn thành">{row.completed === null ? '—' : row.completed}</td>
              <td data-label="XP">
                <strong>{row.xp}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MotivationBoard({ activeId, onClose }: { activeId: string; onClose: () => void }) {
  const [rows, setRows] = useState<MotivationRow[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setRows(motivationRows(loadLearners()));
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="settings-dialog motivation-dialog" role="dialog" aria-modal="true" aria-labelledby="motivation-title">
        <header className="settings-head">
          <div className="settings-heading">
            <span className="settings-seal" aria-hidden="true">
              加
            </span>
            <div>
              <h2 id="motivation-title">Bảng động lực</h2>
              <p>Cùng nhau luyện một chút mỗi ngày.</p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Đóng bảng động lực" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="motivation-body">
          <div className="motivation-welcome">
            <span className="motivation-spark">
              <SparkIcon size={23} />
            </span>
            <div>
              <strong>Mỗi lượt luyện là một bước tiến ✨</strong>
              <p>Cùng khích lệ nhau giữ thói quen. Mỗi người có một hành trình riêng.</p>
            </div>
          </div>
          <MotivationTable rows={rows} activeId={activeId} />
          <p className="motivation-note">
            Hôm nay, tổng lượt và chuỗi ngày tính theo trò chuyện với giáo viên; mỗi lượt hoàn tất nhận 10 XP. Buổi hoàn thành có thể gồm cả
            buổi học lại; dấu — nghĩa là chưa có dữ liệu bài học. Bảng dành để động viên, không dùng để xếp hạng trình độ.
          </p>
        </div>
      </section>
    </div>
  );
}
