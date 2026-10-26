import { ToneSampleCounts } from './ToneLabelFeedback';
import { ConnectivitySettings } from './ConnectivitySettings';
import { useEffect, useRef } from 'react';
import type { AvatarMode, Level, Progress, Settings, StatusResponse } from '../types';
import { DAILY_GOAL, lastSevenDays } from '../lib/storage';
import { AlertIcon, CheckIcon, ChevronDownIcon, CloseIcon, FlameIcon, RefreshIcon, SparkIcon, VolumeIcon } from './Icons';

interface SettingsDialogProps {
  open: boolean;
  status: StatusResponse | null;
  settings: Settings;
  progress: Progress;
  refreshing: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onRefresh: () => void;
  onSetup: () => void;
  onPreviewVoice: () => void;
  onPreviewTranslation: () => void;
  onClearChat: () => void;
  onResetProgress: () => void;
  onResetPitchProfile: () => void;
  customAvatar: { name: string; kind: AvatarMode } | null;
  onPickAvatar: (file: File) => void;
  onClearAvatar: () => void;
}

const LEVEL_OPTIONS: Array<{ value: Level; label: string; hint: string }> = [
  { value: 'HSK1-2', label: 'Mới bắt đầu', hint: 'HSK 1–2 · câu ngắn, từ cơ bản' },
  { value: 'HSK3-4', label: 'Trung cấp', hint: 'HSK 3–4 · hội thoại đời thường' },
  { value: 'HSK5-6', label: 'Khá', hint: 'HSK 5–6 · diễn đạt tự nhiên hơn' },
  { value: 'free', label: 'Tự do', hint: 'Không giới hạn độ khó' },
];

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <div>
        <p className="toggle-label">{label}</p>
        <p className="toggle-description">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function SettingsDialog({
  open,
  status,
  settings,
  progress,
  refreshing,
  onClose,
  onChange,
  onRefresh,
  onSetup,
  onPreviewVoice,
  onPreviewTranslation,
  onClearChat,
  onResetProgress,
  onResetPitchProfile,
  customAvatar,
  onPickAvatar,
  onClearAvatar,
}: SettingsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const providers = status?.providers ?? [];
  const provider = providers.find((item) => item.id === settings.providerId);
  const onlineProviders = providers.filter((item) => item.online);
  const voices = status?.voices ?? [];
  const viVoices = status?.viVoices ?? [];
  const week = lastSevenDays(progress);
  const levelOption = LEVEL_OPTIONS.find((item) => item.value === settings.level);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-head">
          <div className="settings-heading">
            <span className="settings-seal" aria-hidden="true">
              设
            </span>
            <div>
              <h2 id="settings-title">Cài đặt góc luyện tập</h2>
              <p>Điều chỉnh gia sư, giọng nói và nhịp học của bạn.</p>
            </div>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Đóng cài đặt">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="settings-body">
          <ToneSampleCounts />
          <section className="settings-section">
            <div className="section-heading">
              <div>
                <h3>Bộ não của Misu</h3>
                <p>Chọn Ollama/LM Studio trên máy, hoặc tự cấu hình API bên ngoài ở phía dưới.</p>
              </div>
              <button className="refresh-button" type="button" onClick={onRefresh} disabled={refreshing}>
                <RefreshIcon size={15} className={refreshing ? 'is-spinning' : ''} />
                {refreshing ? 'Đang quét' : 'Làm mới'}
              </button>
            </div>

            {!status && (
              <div className="settings-inline-note">
                <AlertIcon size={15} />
                Chưa lấy được danh sách model. Kiểm tra server local rồi bấm Làm mới.
              </div>
            )}

            <button type="button" className="lesson-secondary" onClick={onSetup}>
              Kiểm tra hệ thống và micro
            </button>
            <div className="field-grid">
              <label className="field">
                <span className="field-label">Nhà cung cấp</span>
                <span className="select-wrap">
                  <select
                    value={settings.providerId}
                    onChange={(event) => onChange({ providerId: event.target.value })}
                    disabled={!providers.length}
                  >
                    {!providers.length && <option value="">Chưa có runtime</option>}
                    {providers.map((item) => (
                      <option key={item.id} value={item.id} disabled={!item.online}>
                        {item.name}
                        {item.online ? '' : ' — offline'}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon size={15} />
                </span>
              </label>

              <label className="field">
                <span className="field-label">Model</span>
                <span className="select-wrap">
                  <select
                    value={settings.model}
                    onChange={(event) => onChange({ model: event.target.value })}
                    disabled={!provider?.models.length}
                  >
                    {!provider?.models.length && <option value="">Chưa có model</option>}
                    {provider?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                        {model === provider.recommendedModel ? (provider.remote ? ' · đã cấu hình, chưa đo' : ' · đề xuất') : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon size={15} />
                </span>
              </label>
            </div>

            <div className="runtime-status">
              <span className={`status-dot${provider?.online ? ' is-online' : ''}`} />
              <span className="runtime-label">
                {provider
                  ? `${provider.name} ${provider.remote ? 'đã cấu hình; chưa xác minh kết nối' : provider.online ? 'đang chạy' : 'chưa bật'}`
                  : 'Chưa phát hiện runtime'}
              </span>
              {provider && <code>{provider.url}</code>}
            </div>

            {status && !onlineProviders.length && (
              <div className="settings-inline-note">
                <AlertIcon size={15} />
                Mở Ollama hoặc LM Studio trên máy, sau đó bấm Làm mới để bắt đầu trò chuyện.
              </div>
            )}
            {provider && !provider.online && (
              <div className="settings-inline-note">
                <AlertIcon size={15} />
                {provider.name} hiện không phản hồi. Chọn runtime khác hoặc bật lại ứng dụng.
              </div>
            )}
          </section>

          <section className="settings-section">
            <div className="section-heading">
              <div>
                <h3>Giọng của Misu</h3>
                <p>Giọng nữ tiếng Phổ thông, có nhịp môi khớp với từng câu.</p>
              </div>
            </div>

            <div className="voice-row">
              <label className="field voice-field">
                <span className="field-label">Giọng đọc tiếng Trung</span>
                <span className="select-wrap">
                  <select value={settings.voice} onChange={(event) => onChange({ voice: event.target.value })} disabled={!voices.length}>
                    {!voices.length && <option value={settings.voice}>Xiaoxiao</option>}
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon size={15} />
                </span>
              </label>
              <button className="preview-button" type="button" onClick={onPreviewVoice}>
                <VolumeIcon size={17} />
                Nghe thử
              </button>
            </div>
            <p className="field-hint">
              Giọng Edge cần internet. Khi lỗi: thử giọng macOS, rồi giọng zh-CN của trình duyệt nếu máy đã cài; nguồn giọng sẽ hiện trên
              màn hình.
            </p>

            <div className="voice-row vi-voice-row">
              <label className="field voice-field">
                <span className="field-label">Giọng đọc bản dịch tiếng Việt</span>
                <span className="select-wrap">
                  <select
                    value={settings.viVoice}
                    onChange={(event) => onChange({ viVoice: event.target.value })}
                    disabled={!viVoices.length}
                  >
                    {!viVoices.length && <option value={settings.viVoice}>HoaiMy</option>}
                    {viVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon size={15} />
                </span>
              </label>
              <button className="preview-button" type="button" onClick={onPreviewTranslation}>
                <VolumeIcon size={17} />
                Nghe thử
              </button>
            </div>
            <p className="field-hint">
              Dùng cho nút “Nghe tiếng Việt” dưới mỗi bản dịch. Khi lỗi có thể dùng Linh trên macOS hoặc giọng vi-VN của trình duyệt nếu đã
              cài.
            </p>
          </section>

          <section className="settings-section">
            <div className="section-heading">
              <div>
                <h3>Khuôn mặt của Misu</h3>
                <p>File avatar chỉ lưu trong trình duyệt này, không gửi lên server.</p>
              </div>
            </div>

            <div className="avatar-row">
              <div className="avatar-file">
                <strong>{customAvatar ? customAvatar.name : 'Avatar mặc định'}</strong>
                <span>
                  {customAvatar
                    ? customAvatar.kind === 'lam'
                      ? 'Ảnh thật · LAM (.zip)'
                      : 'Mô hình 3D (.glb)'
                    : 'Ảnh dựng sẵn của ứng dụng'}
                </span>
              </div>
              <div className="avatar-actions">
                <label className="preview-button avatar-pick">
                  <input
                    type="file"
                    accept=".zip,.glb"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) onPickAvatar(file);
                    }}
                  />
                  Chọn file…
                </label>
                {customAvatar && (
                  <button className="text-button" type="button" onClick={onClearAvatar}>
                    Dùng mặc định
                  </button>
                )}
              </div>
            </div>

            <p className="field-hint">
              .zip là bản dựng LAM từ ảnh/video thật (cần máy GPU để tạo). .glb là avatar 3D kiểu Ready Player Me. Chọn xong, Misu đổi gương
              mặt ngay.
            </p>

            <Toggle
              checked={settings.avatarGender === 'male'}
              onChange={(checked) => onChange({ avatarGender: checked ? 'male' : 'female' })}
              label="Khuôn mặt này là nam"
              description="Misu đổi giọng nói theo giới tính khuôn mặt: nữ dùng Xiaoxiao/Xiaoyi, nam dùng Yunjian/Yunxi."
            />
          </section>

          <section className="settings-section">
            <div className="section-heading">
              <div>
                <h3>Cách Misu trò chuyện</h3>
                <p>Chọn độ khó và những hỗ trợ bạn muốn thấy sau mỗi lượt.</p>
              </div>
            </div>

            <div className="level-grid">
              {LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`level-option${settings.level === option.value ? ' is-selected' : ''}`}
                  onClick={() => onChange({ level: option.value })}
                  aria-pressed={settings.level === option.value}
                >
                  <span className="level-check">{settings.level === option.value && <CheckIcon size={13} />}</span>
                  <span className="level-name">{option.label}</span>
                  <span className="level-hint">{option.hint}</span>
                </button>
              ))}
            </div>
            {levelOption && (
              <p className="field-hint">
                Misu sẽ dùng từ vựng và độ dài câu phù hợp với trình độ {settings.level === 'free' ? 'tự do' : settings.level}.
              </p>
            )}

            <div className="toggle-list">
              <Toggle
                checked={settings.autoSpeak}
                onChange={(checked) => onChange({ autoSpeak: checked })}
                label="Tự động đọc câu trả lời"
                description="Nghe giọng nói và xem khẩu hình khi Misu trả lời."
              />
              <Toggle
                checked={settings.autoReadTranslation}
                onChange={(checked) => onChange({ autoReadTranslation: checked })}
                label="Tự đọc bản dịch tiếng Việt"
                description="Sau câu tiếng Trung, đọc luôn nghĩa tiếng Việt bằng giọng Việt."
                disabled={!settings.autoSpeak}
              />
              <Toggle
                checked={settings.avatarMode === 'lam'}
                onChange={(checked) => onChange({ avatarMode: checked ? 'lam' : 'classic' })}
                label="Avatar ảnh thật (LAM)"
                description={
                  customAvatar
                    ? 'Đang dùng file avatar tuỳ chỉnh. Bấm “Dùng mặc định” ở trên để chọn lại kiểu avatar.'
                    : 'Avatar dựng từ ảnh thật, chạy cục bộ; miệng và nét mặt chuyển động theo giọng nói. Tắt để dùng avatar 3D hoạt hình.'
                }
                disabled={Boolean(customAvatar)}
              />
              <Toggle
                checked={settings.showPinyin}
                onChange={(checked) => onChange({ showPinyin: checked })}
                label="Hiện phiên âm"
                description="Hiển thị pinyin ngay dưới chữ Hán trong cuộc trò chuyện."
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="section-heading">
              <div>
                <h3>Tiến độ của bạn</h3>
                <p>Mỗi lượt trả lời được tính khi Misu đã phản hồi xong.</p>
              </div>
              <div className="mini-streak">
                <FlameIcon size={16} />
                <span>{progress.streak} ngày</span>
              </div>
            </div>

            <div className="week-row">
              {week.map((day) => (
                <div key={day.key} className={`week-day${day.active ? ' is-active' : ''}${day.today ? ' is-today' : ''}`}>
                  <span className="week-dot">{day.active ? <CheckIcon size={12} /> : null}</span>
                  <span className="week-label">{day.label}</span>
                </div>
              ))}
            </div>

            <div className="stats-grid">
              <div>
                <strong>
                  {progress.todayTurns}/{DAILY_GOAL}
                </strong>
                <span>lượt hôm nay</span>
              </div>
              <div>
                <strong>{progress.totalTurns}</strong>
                <span>tổng số lượt</span>
              </div>
              <div>
                <strong>{progress.xp}</strong>
                <span>điểm XP</span>
              </div>
              <div>
                <strong>{progress.streak}</strong>
                <span>chuỗi ngày</span>
              </div>
            </div>
          </section>

          <ConnectivitySettings onChange={onChange} onRefresh={onRefresh} />
          <section className="settings-section settings-footer">
            <p className="privacy-note">
              <SparkIcon size={14} />
              Hội thoại và tiến độ được lưu trong trình duyệt và đồng bộ vào thư mục dữ liệu trên máy. Whisper chạy cục bộ; model dùng API
              tuỳ chọn sẽ nhận nội dung hội thoại. Giọng Edge và nhận dạng trình duyệt có thể dùng dịch vụ mạng.
            </p>
            <div className="data-actions">
              <button className="text-button" type="button" onClick={onClearChat}>
                Xoá hội thoại hôm nay
              </button>
              <button className="text-button danger" type="button" onClick={onResetProgress}>
                Đặt lại tiến độ
              </button>
              <button className="text-button danger" type="button" onClick={onResetPitchProfile}>
                Đặt lại hồ sơ giọng
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
