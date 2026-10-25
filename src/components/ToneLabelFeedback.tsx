import { useEffect, useState } from 'react';
import { loadActiveLearnerId, loadLearners } from '../lib/learners';
import type { ToneReport } from '../lib/voiceInput';
export function ToneLabelFeedback({ report, audio, learnerId }: { report: ToneReport; audio?: Blob; learnerId?: string }) {
  const [open, setOpen] = useState(false),
    [reviewer, setReviewer] = useState(''),
    [source, setSource] = useState(''),
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
    if (!audio || !id || !reviewer.trim() || !source || chars.some((_, i) => tones[i] === undefined)) {
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
          itemId: `text:${chars.map((s) => s.char).join('')}`,
          mime: audio.type.split(';')[0],
          audioBase64: btoa(binary),
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
              <option value="" disabled>
                Chọn vai trò người nghe
              </option>
              <option value="self">Người học tự nghe</option>
              <option value="peer">Người học khác nghe hộ</option>
              <option value="expert">Giáo viên / người bản ngữ</option>
            </select>
          </label>
          <p>Vai trò do người gắn nhãn tự khai, chưa xác minh chuyên môn. Lưu lại cùng mục/người nghe sẽ cập nhật bản mới nhất.</p>
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
      <p>Audio và tên người nghe giữ tới khi bạn xoá. ZIP chứa dữ liệu riêng; chỉ xuất khi bạn muốn giữ hoặc tự chia sẻ.</p>
      {loadLearners().map((learner) => (
        <div key={learner.id}>
          <p>{learner.name}</p>
          <DatasetActions learnerId={learner.id} />
        </div>
      ))}
      {rows.map((row, i) => (
        <p key={i}>{row}</p>
      ))}
    </section>
  );
}

function DatasetActions({ learnerId }: { learnerId: string }) {
  const [notice, setNotice] = useState('');
  async function exportData() {
    try {
      const res = await fetch(`/api/tone-evaluation/${encodeURIComponent(learnerId)}/export`);
      if (!res.ok) throw new Error('Không xuất được bộ nhãn.');
      const url = URL.createObjectURL(await res.blob()),
        link = document.createElement('a');
      link.href = url;
      link.download = 'misu-tone-labels-private.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Không xuất được.');
    }
  }
  async function removeData() {
    if (!window.confirm('Xoá toàn bộ bản thu, nhãn và tên người nghe của hồ sơ này? Không thể khôi phục nếu chưa xuất ZIP.')) return;
    try {
      const res = await fetch(`/api/tone-evaluation/${encodeURIComponent(learnerId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: learnerId }),
      });
      if (!res.ok) throw new Error('Không xoá được.');
      setNotice('Đã xoá bộ thu và nhãn; bấm xem số mẫu để cập nhật.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Không xoá được.');
    }
  }
  return (
    <div>
      <button type="button" onClick={() => void exportData()}>
        Xuất ZIP nhãn và audio riêng
      </button>
      <button type="button" onClick={() => void removeData()}>
        Xoá bộ thu/nhãn của hồ sơ
      </button>
      <p role="status">{notice}</p>
    </div>
  );
}
