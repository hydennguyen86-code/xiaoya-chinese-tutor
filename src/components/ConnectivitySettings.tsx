import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { CloudTask, RemoteHealth, Settings } from '../types';
import { CLOUD_TASK_OPTIONS, VIETAPI_PRESET } from '../lib/modelRouting';
interface RemoteInfo {
  configured: boolean;
  url: string;
  model: string;
  hasKey: boolean;
  consent: boolean;
  health?: RemoteHealth | null;
}
const HEALTH_LABEL: Record<RemoteHealth['state'], string> = {
  ok: 'Cloud đang chạy',
  warn: 'Kết nối được · cần xem lại',
  error: 'Cloud đang lỗi',
  unknown: 'Chưa xác nhận',
};
interface LanInfo {
  enabled: boolean;
  urls: string[];
  pin?: string;
  fingerprint?: string;
}
export function ConnectivitySettings({
  settings,
  onChange,
  onRefresh,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onRefresh: () => void;
}) {
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [lan, setLan] = useState<LanInfo | null>(null);
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<RemoteHealth | null>(null);
  const [pinging, setPinging] = useState(false);
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
        setHealth(info.health ?? null);
        if (info.configured) void ping();
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
      setHealth(remove ? null : (info.health ?? null));
      setConsent(info.consent);
      // the local model stays the main brain; ticked jobs go to the cloud through routing
      if (remove && settings.providerId === 'compatible') onChange({ providerId: '', model: '' });
      onRefresh();
      setMessage(
        remove
          ? 'Đã xoá cấu hình và key trên máy chủ.'
          : 'Đã lưu trên máy chủ (key không gửi lại trình duyệt). Trạng thái ở đầu mục này; bấm “Thử trả lời 1 câu” để chắc chắn model chạy.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  }
  async function ping() {
    setPinging(true);
    try {
      const res = await fetch('/api/provider-ping', { method: 'POST' });
      if (res.ok) {
        setHealth(await res.json());
        onRefresh();
      }
    } catch {
      /* the status line keeps its last value */
    } finally {
      setPinging(false);
    }
  }
  // re-check every minute while settings are open (GET /models, no tokens)
  useEffect(() => {
    if (!remote?.configured) return;
    const timer = window.setInterval(() => void ping(), 60_000);
    return () => window.clearInterval(timer);
  }, [remote?.configured]);
  async function test() {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch('/api/provider-test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data.health) setHealth(data.health);
      if (!res.ok) throw new Error(data.error || 'Chưa kết nối được API.');
      setMessage(`Kết nối tốt · ${data.model} trả lời sau ${(Number(data.elapsedMs) / 1000).toFixed(1)} giây.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa kết nối được API.');
    } finally {
      setTesting(false);
    }
  }
  function toggleTask(task: CloudTask, on: boolean) {
    const rest = settings.cloudTasks.filter((item) => item !== task);
    onChange({ cloudTasks: on ? [...rest, task] : rest });
  }
  return (
    <section className="settings-section connectivity-settings">
      <h3>Model cloud qua API</h3>
      <p>
        Model 7B trên máy chỉ nên làm việc vặt. Việc cần suy luận — trò chuyện, bắt lỗi, phân tích điểm yếu — giao cho model cloud như
        gemini-4-argon qua VietAPI. Tính phí theo token; key chỉ lưu trên máy chủ này, không gửi về trình duyệt.
      </p>
      {remote?.configured && (
        <div className={`cloud-health is-${health?.state ?? 'unknown'}`} role="status">
          <span className={`status-dot${health?.state === 'ok' ? ' is-online' : ''}`} />
          <span className="cloud-health-text">
            <strong>{HEALTH_LABEL[health?.state ?? 'unknown']}</strong>
            {health ? ` · ${health.ms} ms · lúc ${new Date(health.at).toLocaleTimeString('vi-VN')}` : ' · đang ping…'}
            {health?.message && <small>{health.message}</small>}
          </span>
          <button type="button" className="lesson-secondary" disabled={pinging} onClick={() => void ping()}>
            {pinging ? 'Đang ping…' : 'Ping'}
          </button>
        </div>
      )}
      {remote && (
        <>
          <div className="lesson-actions cloud-preset">
            <button
              type="button"
              className="lesson-secondary"
              onClick={() => {
                setUrl(VIETAPI_PRESET.url);
                setModel(VIETAPI_PRESET.model);
                setConsent(false);
              }}
            >
              Điền sẵn VietAPI · gemini-4-argon
            </button>
            <a className="lesson-secondary" href={VIETAPI_PRESET.topupUrl} target="_blank" rel="noopener noreferrer">
              Lấy key / nạp credit
            </a>
            <a className="lesson-secondary" href={VIETAPI_PRESET.modelsUrl} target="_blank" rel="noopener noreferrer">
              Xem mã model
            </a>
          </div>
          <label>
            URL API
            <input
              type="url"
              value={url}
              placeholder={VIETAPI_PRESET.url}
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
            <input
              value={model}
              maxLength={160}
              placeholder={VIETAPI_PRESET.model}
              onChange={(event) => setModel(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            API key {remote.hasKey ? '(đã lưu; để trống để giữ khi URL không đổi)' : ''}
            <input
              type="password"
              value={key}
              placeholder="sk-..."
              onChange={(event) => setKey(event.target.value)}
              autoComplete="new-password"
            />
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
            <button type="button" className="lesson-secondary" disabled={busy || testing || !remote.configured} onClick={() => void test()}>
              {testing ? 'Đang thử…' : 'Thử trả lời 1 câu'}
            </button>
            <button type="button" className="lesson-secondary" disabled={busy || !remote.configured} onClick={() => void save(true)}>
              Xoá API/key
            </button>
          </div>
          {remote.configured && (
            <fieldset className="cloud-tasks">
              <legend>Việc giao cho model cloud ({remote.model})</legend>
              {CLOUD_TASK_OPTIONS.map((option) => (
                <label key={option.id} className="cloud-task">
                  <input
                    type="checkbox"
                    checked={settings.cloudTasks.includes(option.id)}
                    onChange={(event) => toggleTask(option.id, event.target.checked)}
                  />
                  <span>
                    {option.label}
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
              <p className="cloud-tasks-note">
                Việc không đánh dấu chạy trên model máy
                {settings.providerId && settings.providerId !== 'compatible' && settings.model ? ` (${settings.model})` : ''}. Nếu máy không có
                model nào đang chạy, mọi việc tự chuyển sang cloud.
              </p>
            </fieldset>
          )}
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
