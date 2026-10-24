import { useEffect, useRef, useState } from 'react';
import type { AvatarApi } from '../lib/avatarApi';
import type { AvatarMode, Phase } from '../types';
import { AlertIcon, RefreshIcon } from './Icons';

interface AvatarStageProps {
  avatarUrl?: string;
  lamAvatarUrl?: string;
  customAvatarUrl?: string;
  deferred?: boolean;
  mode: AvatarMode;
  phase: Phase;
  onReady: (controller: AvatarApi) => void;
  onAudioState: (playing: boolean) => void;
  onUnavailable: (message: string) => void;
}

const PHASE_COPY: Record<Phase, { label: string; hint: string }> = {
  loading: {
    label: 'Đang chuẩn bị',
    hint: 'Đang tải không gian trò chuyện…',
  },
  ready: {
    label: 'Sẵn sàng',
    hint: 'Nói hoặc viết bằng tiếng Trung — Misu sẽ trả lời ngay.',
  },
  listening: {
    label: 'Đang lắng nghe',
    hint: 'Nói tự nhiên bằng tiếng Trung. Ngừng nói một chút để mình gửi câu.',
  },
  thinking: {
    label: 'Đang suy nghĩ',
    hint: 'Misu đang chọn cách trả lời tự nhiên nhất…',
  },
  replying: {
    label: 'Đang trả lời',
    hint: 'Câu trả lời đang hiện dần trong khung chat.',
  },
  speaking: {
    label: 'Đang nói',
    hint: 'Bạn có thể gửi tin nhắn mới để ngắt lời.',
  },
};

export function AvatarStage({
  avatarUrl,
  lamAvatarUrl,
  customAvatarUrl,
  deferred = false,
  mode,
  phase,
  onReady,
  onAudioState,
  onUnavailable,
}: AvatarStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onReady, onAudioState, onUnavailable });
  callbacksRef.current = { onReady, onAudioState, onUnavailable };

  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    if (deferred) return;
    const useLam = mode === 'lam' && Boolean(customAvatarUrl || lamAvatarUrl);
    const sourceUrl = customAvatarUrl ?? (useLam ? lamAvatarUrl : avatarUrl);
    if (!sourceUrl || !hostRef.current) return;

    let cancelled = false;
    setLoadState('loading');
    setProgress(0);
    setAvatarError('');

    const callbacks = {
      onAudioState: (playing: boolean) => callbacksRef.current.onAudioState(playing),
      onError: (message: string) => callbacksRef.current.onUnavailable(message),
    };
    let controller: AvatarApi | null = null;
    void (async () => {
      const Controller = useLam
        ? (await import('../lib/lamAvatar')).LamAvatarController
        : (await import('../lib/avatar')).AvatarController;
      if (cancelled || !hostRef.current) return;
      controller = new Controller(hostRef.current, callbacks);
      await controller.load(sourceUrl, (ratio) => { if (!cancelled) setProgress(ratio); });
      if (cancelled) return;
      setLoadState('ready');
      callbacksRef.current.onReady(controller);
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error('[avatar] load failed', error);
      const message = 'Không tải được avatar. Kiểm tra file hoặc đổi avatar trong Cài đặt.';
      setAvatarError(message);
      setLoadState('error');
      callbacksRef.current.onUnavailable(message);
    });

    return () => {
      cancelled = true;
      controller?.destroy();
    };
  }, [avatarUrl, lamAvatarUrl, customAvatarUrl, deferred, mode, attempt]);

  const copy = PHASE_COPY[phase];
  const percent = Math.round(progress * 100);
  const showLoading = loadState === 'loading';

  return (
    <div className={`avatar-stage phase-${phase}`}>
      <div className="stage-halo" aria-hidden="true" />
      <div className="stage-ring stage-ring-one" aria-hidden="true" />
      <div className="stage-ring stage-ring-two" aria-hidden="true" />
      <span className="stage-glyph glyph-one" aria-hidden="true">说</span>
      <span className="stage-glyph glyph-two" aria-hidden="true">听</span>
      <span className="stage-glyph glyph-three" aria-hidden="true">学</span>
      <div className="stage-grain" aria-hidden="true" />
      <div className="stage-vignette" aria-hidden="true" />

      <div className="avatar-host" ref={hostRef} />

      <div className="stage-topline">
        <div className="nameplate">
          <div className="nameplate-seal">苏</div>
          <div>
            <p className="nameplate-cn">米苏</p>
            <p className="nameplate-meta">Mǐsū · Gia sư luyện nói</p>
          </div>
        </div>
        <div className={`phase-pill phase-pill-${phase}`} aria-live="polite">
          <span className="phase-dot" />
          <span>{copy.label}</span>
        </div>
      </div>

      <div className="stage-dock">
        <p className="stage-hint">{copy.hint}</p>
        <div className="stage-dock-line" aria-hidden="true" />
        <p className="stage-note">每天说一点，就会越来越自然</p>
      </div>

      {showLoading && (
        <div className="stage-overlay stage-loading">
          <div className="loader-orbit" aria-hidden="true">
            <span />
          </div>
          <p className="overlay-title">Đang mời Misu…</p>
          <p className="overlay-sub">
            {avatarUrl ? 'Chuẩn bị gương mặt và nụ cười cho buổi luyện hôm nay' : 'Đang kết nối với server local'}
          </p>
          <div className="load-track" aria-hidden="true">
            <span style={{ width: avatarUrl ? `${Math.max(6, percent)}%` : '36%' }} />
          </div>
          {avatarUrl && <p className="load-percent">{percent}%</p>}
        </div>
      )}

      {loadState === 'error' && (
        <div className="stage-overlay stage-failure">
          <div className="failure-icon">
            <AlertIcon size={22} />
          </div>
          <p className="overlay-title">Avatar chưa sẵn sàng</p>
          <p className="overlay-sub">{avatarError}</p>
          <button className="soft-button" type="button" onClick={() => setAttempt((n) => n + 1)}>
            <RefreshIcon size={16} />
            Thử tải lại
          </button>
        </div>
      )}
    </div>
  );
}
