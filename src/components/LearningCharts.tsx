import { useMemo, useState } from 'react';
import type { LearningProfile } from '../types';
import { categoryBars, dailyRate, rateTrend, recurringSkills } from '../lib/learningCharts';
import type { RatePoint } from '../lib/learningCharts';
import { dayKey } from '../lib/storage';

const WIDTH = 560;

function shortDate(date: string) {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function oneDecimal(value: number) {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

/** a bar that is rounded at the data end and square on the baseline */
function barPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, width, height / 2);
  return `M${x},${y}h${width - r}a${r},${r} 0 0 1 ${r},${r}v${height - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(width - r)}z`;
}

function niceMax(value: number) {
  const steps = [2, 4, 6, 8, 10, 15, 20, 30, 50, 100];
  return steps.find((step) => step >= value) ?? Math.ceil(value / 10) * 10;
}

function CategoryChart({ learning }: { learning: LearningProfile }) {
  const bars = useMemo(() => categoryBars(learning), [learning]);
  if (!bars.length) return null;
  const max = Math.max(...bars.map((bar) => bar.count));
  const rowHeight = 28;
  const labelWidth = 96;
  const room = WIDTH - labelWidth - 48;
  return (
    <section className="lc-card">
      <h4>Lỗi hay gặp theo nhóm</h4>
      <p className="lc-sub">Tổng số lần app ghi nhận, từ nhiều đến ít.</p>
      <svg viewBox={`0 0 ${WIDTH} ${bars.length * rowHeight + 4}`} role="img" aria-label="Biểu đồ cột ngang số lỗi theo nhóm">
        {bars.map((bar, index) => {
          const y = index * rowHeight + 6;
          const width = Math.max(6, (bar.count / max) * room);
          return (
            <g key={bar.skill}>
              <text className="lc-label" x={0} y={y + 11}>
                {bar.label}
              </text>
              <path className="lc-bar" d={barPath(labelWidth, y, width, 16)}>
                <title>{`${bar.label}: ${bar.count} lần`}</title>
              </path>
              <text className="lc-value" x={labelWidth + width + 6} y={y + 12}>
                {bar.count}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="lc-table">
        <summary>Xem dạng bảng</summary>
        <table>
          <thead>
            <tr>
              <th>Nhóm</th>
              <th>Số lần</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.skill}>
                <td>{bar.label}</td>
                <td>{bar.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function RateChart({ learning }: { learning: LearningProfile }) {
  const points = useMemo(() => dailyRate(learning), [learning]);
  const trend = useMemo(() => rateTrend(points), [points]);
  const [active, setActive] = useState<number | null>(null);
  const withData = points.filter((point) => point.per10 !== null);
  if (!withData.length) {
    return (
      <section className="lc-card">
        <h4>Lỗi mỗi 10 lượt nói</h4>
        <p className="lc-sub">Chưa có lượt nói nào trong 14 ngày gần nhất. Luyện nói vài lần rồi quay lại xem xu hướng.</p>
      </section>
    );
  }
  const height = 170;
  const left = 30;
  const right = 46;
  const top = 12;
  const bottom = 24;
  const max = niceMax(Math.max(...withData.map((point) => point.per10 ?? 0)));
  const step = (WIDTH - left - right) / (points.length - 1);
  const x = (index: number) => left + index * step;
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  // consecutive days with data form one line; a day without turns breaks it
  const runs: number[][] = [];
  points.forEach((point, index) => {
    if (point.per10 === null) return;
    const last = runs.at(-1);
    if (last && last.at(-1) === index - 1) last.push(index);
    else runs.push([index]);
  });
  let lastIndex = -1;
  points.forEach((point, index) => {
    if (point.per10 !== null) lastIndex = index;
  });
  const focus: RatePoint | null = active === null ? null : points[active];
  const ticks = [0, max / 2, max];
  return (
    <section className="lc-card">
      <h4>Lỗi mỗi 10 lượt nói · 14 ngày</h4>
      <p className="lc-sub">
        {trend
          ? `7 ngày gần nhất: ${oneDecimal(trend.recent)} lỗi/10 lượt, tuần trước đó: ${oneDecimal(trend.before)} — ${
              trend.direction === 'down' ? 'đang giảm' : trend.direction === 'up' ? 'đang tăng' : 'gần như không đổi'
            }.`
          : 'Cần ít nhất 10 lượt nói mỗi tuần để so sánh hai tuần.'}{' '}
        Chỉ tính lỗi app bắt được lúc nói, nên đây là xu hướng chứ không phải điểm số.
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Biểu đồ đường số lỗi trên mỗi 10 lượt nói trong 14 ngày">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="lc-grid" x1={left} x2={WIDTH - right} y1={y(tick)} y2={y(tick)} />
            <text className="lc-axis" x={left - 6} y={y(tick) + 4} textAnchor="end">
              {oneDecimal(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          (points.length - 1 - index) % 2 === 0 ? (
            <text key={point.date} className="lc-axis" x={x(index)} y={height - 6} textAnchor="middle">
              {shortDate(point.date)}
            </text>
          ) : null,
        )}
        {active !== null && <line className="lc-cross" x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} />}
        {runs.map((run) =>
          run.length > 1 ? (
            <path
              key={run[0]}
              className="lc-line"
              d={run.map((index, i) => `${i ? 'L' : 'M'}${x(index)},${y(points[index].per10 ?? 0)}`).join('')}
            />
          ) : null,
        )}
        {points.map((point, index) =>
          point.per10 === null ? null : (
            <circle key={point.date} className="lc-dot" cx={x(index)} cy={y(point.per10)} r={index === lastIndex || index === active ? 5 : 4} />
          ),
        )}
        {lastIndex >= 0 && (
          <text className="lc-value" x={x(lastIndex) + 9} y={y(points[lastIndex].per10 ?? 0) + 4}>
            {oneDecimal(points[lastIndex].per10 ?? 0)}
          </text>
        )}
        {points.map((point, index) => (
          <rect
            key={`hit-${point.date}`}
            className="lc-hit"
            x={x(index) - step / 2}
            y={top}
            width={step}
            height={height - top - bottom}
            tabIndex={0}
            role="img"
            aria-label={
              point.per10 === null ? `${shortDate(point.date)}: không có lượt nói` : `${shortDate(point.date)}: ${point.corrections} lỗi trong ${point.turns} lượt`
            }
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          />
        ))}
      </svg>
      <p className="lc-readout" aria-live="polite">
        {focus
          ? focus.per10 === null
            ? `${shortDate(focus.date)} · không có lượt nói`
            : `${shortDate(focus.date)} · ${focus.corrections} lỗi trong ${focus.turns} lượt (${oneDecimal(focus.per10)}/10 lượt)`
          : 'Rê chuột hoặc chạm vào một ngày để xem chi tiết.'}
      </p>
      <details className="lc-table">
        <summary>Xem dạng bảng</summary>
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Lượt nói</th>
              <th>Lỗi</th>
              <th>Lỗi/10 lượt</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((point) => point.turns > 0 || point.corrections > 0)
              .map((point) => (
                <tr key={point.date}>
                  <td>{shortDate(point.date)}</td>
                  <td>{point.turns}</td>
                  <td>{point.corrections}</td>
                  <td>{point.per10 === null ? '–' : oneDecimal(point.per10)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function RecurringChart({ learning }: { learning: LearningProfile }) {
  const data = useMemo(() => recurringSkills(learning.reports), [learning.reports]);
  if (data.reports.length < 2 || !data.rows.length) {
    return (
      <section className="lc-card">
        <h4>Điểm yếu lặp lại qua các bản phân tích</h4>
        <p className="lc-sub">Cần ít nhất 2 bản phân tích để thấy điểm yếu nào vẫn còn và điểm nào đã hết. Bấm “Phân tích lại” sau vài buổi luyện.</p>
      </section>
    );
  }
  const labelWidth = 96;
  const right = 64;
  const rowHeight = 28;
  const top = 6;
  const bottom = 22;
  const step = (WIDTH - labelWidth - right) / Math.max(1, data.reports.length - 1);
  const cx = (index: number) => labelWidth + 8 + index * Math.min(step, 64);
  const height = top + data.rows.length * rowHeight + bottom;
  const dates = data.reports.map((report) => shortDate(dayKey(new Date(report.createdAt))));
  return (
    <section className="lc-card">
      <h4>Điểm yếu lặp lại qua các bản phân tích</h4>
      <p className="lc-sub">Chấm đặc = bản phân tích đó nêu điểm yếu này. Hàng nào đặc liền nhiều bản là chỗ cần luyện kỹ nhất.</p>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Điểm yếu nào xuất hiện trong từng bản phân tích">
        {data.rows.map((row, rowIndex) => {
          const cy = top + rowIndex * rowHeight + 12;
          return (
            <g key={row.skill}>
              <text className="lc-label" x={0} y={cy + 4}>
                {row.label}
              </text>
              {row.flags.map((flag, index) => (
                <circle key={data.reports[index].id} className={flag ? 'lc-dot' : 'lc-dot is-off'} cx={cx(index)} cy={cy} r={flag ? 6 : 5}>
                  <title>{`${row.label} · ${dates[index]}: ${flag ? 'có trong bản phân tích' : 'không nêu'}`}</title>
                </circle>
              ))}
              <text className="lc-value" x={cx(data.reports.length - 1) + 16} y={cy + 4}>
                {row.hits}/{data.reports.length}
              </text>
            </g>
          );
        })}
        {dates.map((label, index) => (
          <text key={data.reports[index].id} className="lc-axis" x={cx(index)} y={height - 6} textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
      <details className="lc-table">
        <summary>Xem dạng bảng</summary>
        <table>
          <thead>
            <tr>
              <th>Kỹ năng</th>
              {dates.map((label, index) => (
                <th key={data.reports[index].id}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.skill}>
                <td>{row.label}</td>
                {row.flags.map((flag, index) => (
                  <td key={data.reports[index].id}>{flag ? 'có' : '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function LearningCharts({ learning }: { learning: LearningProfile }) {
  return (
    <div className="learning-charts">
      <RateChart learning={learning} />
      <CategoryChart learning={learning} />
      <RecurringChart learning={learning} />
    </div>
  );
}
