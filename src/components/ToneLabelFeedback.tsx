import { useEffect, useState } from 'react';
import { loadActiveLearnerId, loadLearners } from '../lib/learners';
import type { ToneReport } from '../lib/voiceInput';
export function ToneLabelFeedback({ report, audio, learnerId }: { report: ToneReport; audio?: Blob; learnerId?: string }) {
  const [open, setOpen] = useState(false),
    [reviewer, setReviewer] = useState(''),
    [source, setSource] = useState('self'),
    [tones, setTones] = useState<Record<number, string>>({}),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const chars = report.syllables;
  useEffect(() => {
    setOpen(false);
    setTones({});
    setNotice('');
  }, [report, audio]);
  async function save() {
    const id = learnerId || loadActiveLearnerId();
    if (!audio || !id || !reviewer.trim() || chars.some((_, i) => tones[i] === undefined)) {
      setNotice('Cần hồ sơ người học, bản thu, tên người gắn nhãn và nhãn từng chữ.');
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await audio.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const res = await fetch(`/api/tone-feedback/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chars.map((s) => s.char).join(''),
          mime: audio.type.split(';')[0],
          audioBase64: btoa(binary),
          machine: chars,
          label: { source, reviewedBy: reviewer.trim(), tones: chars.map((_, i) => Number(tones[i])) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được.');
      setNotice('Đã lưu nhãn người và bản thu vào dữ liệu riêng; chưa thay đổi bộ chấm.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tone-label-feedback">
      <button type="button" onClick={() => setOpen(!open)}>
        Misu chấm sai?
      </button>
      {open && (
        <fieldset>
          <legend>Nhãn người nghe · thanh thực sự nghe được</legend>
          <p>Nghe lại bản thu trước khi chọn. Không chép thanh mong đợi. 0 là không rõ, 5 là thanh nhẹ; bộ chấm hiện đo thanh 1–4.</p>
          <label>
            Ai gắn nhãn? <input value={reviewer} maxLength={100} onChange={(e) => setReviewer(e.target.value)} />
          </label>
          <label>
            Vai trò{' '}
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="self">Người học tự nghe</option>
              <option value="peer">Người học khác nghe hộ</option>
              <option value="expert">Giáo viên / người bản ngữ</option>
            </select>
          </label>
          {chars.map((s, i) => (
            <label key={i}>
              {s.char} ({i + 1}){' '}
              <select value={tones[i] ?? ''} onChange={(e) => setTones({ ...tones, [i]: e.target.value })}>
                <option value="" disabled>
                  Chọn thanh nghe được
                </option>
                {[1, 2, 3, 4, 5, 0].map((t) => (
                  <option key={t} value={t}>
                    {t === 5 ? 'Thanh nhẹ' : t || 'Không rõ'}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {!audio && <p>Bản thu này không còn trong bộ nhớ; hãy thu lại để lưu mẫu đối chiếu.</p>}
          <button type="button" disabled={busy || !audio || !chars.length} onClick={() => void save()}>
            Lưu nhãn và bản thu riêng
          </button>
          <p role="status">{notice}</p>
        </fieldset>
      )}
    </div>
  );
}
export function ToneSampleCounts() {
  const [rows, setRows] = useState<string[]>([]);
  async function refresh() {
    setRows(
      await Promise.all(
        loadLearners().map(async (learner) => {
          try {
            const res = await fetch(`/api/tone-feedback/${encodeURIComponent(learner.id)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            return `${learner.name}: ${data.labeled} mục bộ 56 đã gắn nhãn; ${data.feedback} mẫu phản hồi.`;
          } catch {
            return `${learner.name}: chưa đọc được số mẫu.`;
          }
        }),
      ),
    );
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <section className="settings-section">
      <h3>Bộ đo người thật</h3>
      <button type="button" onClick={() => void refresh()}>
        Xem số mẫu theo người học
      </button>
      {rows.map((row, i) => (
        <p key={i}>{row}</p>
      ))}
    </section>
  );
}
