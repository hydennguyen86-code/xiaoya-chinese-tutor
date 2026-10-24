import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Settings } from '../types';
interface RemoteInfo {
  configured: boolean;
  url: string;
  model: string;
  hasKey: boolean;
  consent: boolean;
}
interface LanInfo {
  enabled: boolean;
  urls: string[];
  pin?: string;
  fingerprint?: string;
}
export function ConnectivitySettings({ onChange, onRefresh }: { onChange: (patch: Partial<Settings>) => void; onRefresh: () => void }) {
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [lan, setLan] = useState<LanInfo | null>(null);
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState('');
  const [address, setAddress] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([fetch('/api/provider-config', { signal: abort.signal }), fetch('/api/lan/info', { signal: abort.signal })])
      .then(async ([provider, wifi]) => {
        if (!provider.ok || !wifi.ok) throw new Error('Chỉ cấu hình API và xem PIN trên trình duyệt của máy chủ (localhost).');
        const info: RemoteInfo = await provider.json();
        const network: LanInfo = await wifi.json();
        if (abort.signal.aborted) return;
        setRemote(info);
        setUrl(info.url);
        setModel(info.model);
        setConsent(info.consent);
        setLan(network);
        setAddress(network.urls[0] || '');
      })
      .catch((error) => {
        if (!abort.signal.aborted) setMessage(error.message);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    let active = true;
    setQr('');
    if (address)
      void QRCode.toDataURL(address, { width: 220, margin: 2 }).then((value) => {
        if (active) setQr(value);
      });
    return () => {
      active = false;
    };
  }, [address]);
  async function save(remove = false) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/provider-config', {
        method: remove ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(!remove ? { body: JSON.stringify({ url, model, apiKey: key, consent }) } : {}),
      });
      if (!res.ok) throw new Error('Chưa lưu được. Cần URL HTTPS, model hợp lệ và đồng ý gửi hội thoại; chỉ thực hiện trên máy chủ.');
      setKey('');
      const info = remove ? { configured: false, url: '', model: '', hasKey: false, consent: false } : await res.json();
      setRemote(info);
      setConsent(info.consent);
      onChange({ providerId: remove ? '' : 'compatible', model: remove ? '' : info.model });
      onRefresh();
      setMessage(
        remove
          ? 'Đã xoá cấu hình và key trên máy chủ.'
          : 'Đã lưu trên máy chủ. Key không được trả lại trình duyệt. Model này chưa có số đo sửa câu trong repo.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section connectivity-settings">
      <h3>Máy yếu · dùng API của bạn</h3>
      <p>
        Tuỳ chọn có thể mất phí. URL là cổng tương thích Chat Completions, gồm đường dẫn phiên bản (thường kết thúc bằng /v1). Chưa đo chất
        lượng cho dịch vụ/model bạn chọn.
      </p>
      {remote && (
        <>
          <label>
            URL API
            <input
              type="url"
              value={url}
              placeholder="https://dịch-vụ-của-bạn/v1"
              onChange={(event) => {
                setUrl(event.target.value);
                setConsent(false);
                setKey('');
              }}
              autoComplete="off"
            />
          </label>
          <label>
            Mã model
            <input value={model} maxLength={160} onChange={(event) => setModel(event.target.value)} autoComplete="off" />
          </label>
          <label>
            API key {remote.hasKey ? '(đã lưu; để trống để giữ khi URL không đổi)' : ''}
            <input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="new-password" />
          </label>
          <label className="consent-row">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            Tôi đồng ý gửi câu nói đã chép, hội thoại và nội dung học liên quan lên dịch vụ tại URL này; dịch vụ có thể tính phí. Audio gốc
            không gửi tới API model.
          </label>
          <div className="lesson-actions">
            <button type="button" className="lesson-primary" disabled={busy || !consent || !url || !model} onClick={() => void save()}>
              Lưu và dùng API này
            </button>
            <button type="button" className="lesson-secondary" disabled={busy || !remote.configured} onClick={() => void save(true)}>
              Xoá API/key
            </button>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <h3>Điện thoại cùng Wi-Fi</h3>
      {lan?.enabled ? (
        <>
          <p>Thiết bị có PIN sẽ truy cập dữ liệu học dùng chung. Chỉ chia sẻ cho thiết bị bạn tin cậy. Không mở cổng router ra Internet.</p>
          {lan.urls.length > 1 && (
            <label>
              Địa chỉ Wi-Fi
              <select value={address} onChange={(event) => setAddress(event.target.value)}>
                {lan.urls.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {qr ? (
            <img src={qr} width={220} height={220} alt="Mã QR địa chỉ Misu trên Wi-Fi, không chứa PIN" />
          ) : (
            <p>Chưa thấy địa chỉ IPv4 Wi-Fi riêng. Kiểm tra kết nối mạng.</p>
          )}
          <p>{address}</p>
          <p>
            PIN: <strong>{lan.pin}</strong> · hết phiên sau 12 giờ hoặc khi server khởi động lại.
          </p>
          <p>
            Chứng chỉ tự ký cần được thiết bị tin cậy đúng cách trước khi micro/PWA hoạt động. Xem hướng dẫn README. Dấu vân tay SHA256:{' '}
            <code>{lan.fingerprint}</code>
          </p>
          <a href="/api/lan/certificate" download="misu-lan-cert.pem">
            Tải chứng chỉ công khai từ máy chủ
          </a>
        </>
      ) : (
        <p>
          Đang chỉ mở trên máy này. Để bật, dừng server rồi chạy HOST=0.0.0.0; server dùng HTTPS tự ký và PIN. Xem README trước khi kết nối
          điện thoại.
        </p>
      )}
    </section>
  );
}
