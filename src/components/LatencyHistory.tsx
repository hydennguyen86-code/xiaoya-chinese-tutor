import { useEffect, useState } from 'react';
import { loadLatency } from '../lib/latency';
export function LatencyHistory({ learnerId }: { learnerId: string }) {
  const [rows, setRows] = useState(() => loadLatency(learnerId));
  useEffect(() => {
    const refresh = () => setRows(loadLatency(learnerId));
    refresh();
    window.addEventListener('misu:latency-update', refresh);
    return () => window.removeEventListener('misu:latency-update', refresh);
  }, [learnerId]);
  const last = rows.at(-1);
  return (
    <section className="course-practice">
      <h3>Độ trễ trả lời bằng tiếng · tham khảo</h3>
      <p>
        Từ lần phát hiện tiếng cuối đến lúc lập lịch phát tiếng đầu. Có sai số dò im lặng, hàng đợi âm thanh và thiết bị; chưa phải đo âm
        thanh vật lý. Mục tiêu khoảng 2,5 giây trên máy này, chưa được xác nhận bằng người thật.
      </p>
      {last ? (
        <>
          <p>
            Lần cuối {(last.total / 1000).toFixed(2)}s · {rows.length} lượt đo được.
          </p>
          <p>
            Chờ im lặng {(last.silenceWait / 1000).toFixed(2)}s · nhận dạng {(last.uploadRecognition / 1000).toFixed(2)}s · model đến hết
            câu đầu {(last.model / 1000).toFixed(2)}s · giọng đọc {(last.tts / 1000).toFixed(2)}s · giải mã/phát{' '}
            {(last.decodePlayback / 1000).toFixed(2)}s.
          </p>
          <p>
            Trung vị {(rows.map((r) => r.total).sort((a, b) => a - b)[Math.floor(rows.length / 2)] / 1000).toFixed(2)}s. Không lưu
            transcript/audio trong số đo.
          </p>
        </>
      ) : (
        <p>Chưa có lượt nói cục bộ và tiếng trả lời đủ dữ liệu đo.</p>
      )}
    </section>
  );
}
