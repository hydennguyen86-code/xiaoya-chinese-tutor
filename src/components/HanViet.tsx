import { useState } from 'react';
import { hanVietParts, hanVietText, wordTraps, hanVietBank } from '../lib/hanviet';
export function HanViet({ word, showTips = true }: { word: string; showTips?: boolean }) {
  const parts = hanVietParts(word);
  if (!parts.length) return null;
  const traps = showTips ? wordTraps(word) : [];
  return (
    <div className="hanviet">
      <p
        className="hanviet-reading"
        title="Unihan 17.0.0 kVietnamese, tra từng chữ. kVietnamese ghi âm Quốc ngữ theo chữ, không phân giải theo ngữ cảnh. Đây không phải phiên âm tiếng Trung hay nghĩa từ."
      >
        Âm Hán Việt: {hanVietText(word)}
      </p>
      {parts.some((p) => p.via.length || p.readings.length > 1) && (
        <details>
          <summary>Nguồn âm / biến thể</summary>
          {parts
            .filter((p) => p.via.length || p.readings.length > 1)
            .map((p, i) => (
              <p key={i}>
                {p.char}: {p.readings.join(' / ')}
                {p.via.length ? ` · tra qua ${p.via.join(' / ')} (kTraditionalVariant)` : ''}. Nhiều âm không tự xác định theo ngữ cảnh.
              </p>
            ))}
        </details>
      )}
      {(['nghĩa', 'âm'] as const).map((group) => {
        const entries = traps.filter((t) => t.trap === group);
        return entries.length ? (
          <details key={group}>
            <summary>{group === 'nghĩa' ? 'Bẫy nghĩa' : 'Mẹo âm'} · AI soạn, chưa duyệt</summary>
            {entries.map((t) => (
              <div key={t.id}>
                <p>
                  <strong>{t.hanzi}</strong> · {t.pinyin} · nghĩa hiện đại: {t.meaningVi}
                </p>
                <p>{t.noteVi}</p>
                {'uncertain' in t && Boolean(t.uncertain) && (
                  <p>Chưa chắc: {'uncertainReason' in t ? String(t.uncertainReason) : 'cần người dạy kiểm tra'}</p>
                )}
              </div>
            ))}
          </details>
        ) : null;
      })}
    </div>
  );
}
export function HanVietGuide({ onSpeak }: { onSpeak: (text: string) => void }) {
  const [group, setGroup] = useState('nghĩa');
  return (
    <details className="hanviet-guide">
      <summary>Hán Việt: bẫy nghĩa / mẹo âm</summary>
      <p>{hanVietBank.source}. Âm tra Unihan theo chữ; ghi chú DeepSeek chỉ là gợi ý. Hán Việt không thay pinyin hay nghĩa hiện đại.</p>
      <label>
        Nhóm
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="nghĩa">Bẫy nghĩa</option>
          <option value="âm">Mẹo âm (gần đúng)</option>
        </select>
      </label>
      {hanVietBank.items
        .filter((t) => t.trap === group)
        .map((t) => (
          <div className="hanviet-entry" key={t.id}>
            <p>
              <strong>{t.hanzi}</strong> · {t.pinyin} · {t.level}
            </p>
            <HanViet word={t.hanzi} showTips={false} />
            <p>{t.meaningVi}</p>
            <p>{t.noteVi}</p>
            <button type="button" className="learning-secondary" onClick={() => onSpeak(t.hanzi)}>
              Nghe tiếng Trung
            </button>
          </div>
        ))}
    </details>
  );
}
