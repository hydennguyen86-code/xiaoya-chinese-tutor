import { useEffect, useState } from 'react';
import { loadFluency, weeklyFluency } from '../lib/fluency';
export function FluencyHistory({ learnerId }: { learnerId: string }) {
  const [rows, setRows] = useState(() => weeklyFluency(loadFluency(learnerId)));
  useEffect(() => {
    const refresh = () => setRows(weeklyFluency(loadFluency(learnerId)));
    refresh();
    window.addEventListener('misu:fluency-update', refresh);
    return () => window.removeEventListener('misu:fluency-update', refresh);
  }, [learnerId]);
  const last = rows.at(-1),
    before = rows.at(-2);
  return (
    <section className="course-practice">
      <h3>Độ trôi chảy theo tuần · tham khảo</h3>
      <p>
        Dựa trên năng lượng và số chữ Whisper nghe được, không đo chính xác số âm tiết thực nói. Khoảng ngắt dài hơn 1 giây có thể là lấy
        hơi hoặc cố ý; nói nhanh hơn không đồng nghĩa nói tốt hơn. Không tính vào điểm thi.
      </p>
      {!rows.length ? (
        <p>Chưa có lượt nói cục bộ đủ dữ liệu. Cần Whisper sẵn sàng, nhận được lời nói và âm thanh đủ rõ.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tuần từ (giờ máy)</th>
              <th>Lượt</th>
              <th>Âm tiết/giây</th>
              <th>Ngắt &gt;1s/phút</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week}>
                <td>{r.week}</td>
                <td>{r.turns}</td>
                <td>{r.rate.toFixed(2)}</td>
                <td>{r.pausesPerMinute.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {last && before && (
        <p>
          So với tuần có dữ liệu trước: tốc độ {last.rate >= before.rate ? 'tăng' : 'giảm'} {Math.abs(last.rate - before.rate).toFixed(2)}{' '}
          âm tiết/giây; ngắt dài {last.pausesPerMinute >= before.pausesPerMinute ? 'tăng' : 'giảm'}{' '}
          {Math.abs(last.pausesPerMinute - before.pausesPerMinute).toFixed(1)} lần/phút.
        </p>
      )}
    </section>
  );
}
