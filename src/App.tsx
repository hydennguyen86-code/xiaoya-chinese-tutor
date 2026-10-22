import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarStage } from './components/AvatarStage';
import { ChatPanel } from './components/ChatPanel';
import { SettingsDialog } from './components/SettingsDialog';
import {
  ChevronDownIcon,
  FlameIcon,
  MuteIcon,
  SettingsIcon,
  VolumeIcon,
} from './components/Icons';
import type { AvatarController } from './lib/avatar';
import { fetchStatus, streamChat } from './lib/api';
import { ChineseMic, isSpeechSupported, micPermissionState } from './lib/speech';
import {
  DAILY_GOAL,
  clearMessages,
  lastSevenDays,
  loadMessages,
  loadProgress,
  loadSettings,
  recordPractice,
  resetProgress,
  saveMessages,
  saveSettings,
} from './lib/storage';
import { extractSpeechSegments, makeGreeting, shortModelName, uid } from './lib/text';
import type {
  ChatHistoryMessage,
  ChatMessage,
  Emotion,
  Gesture,
  Phase,
  Progress,
  Settings,
  StatusResponse,
} from './types';

const LEVEL_LABEL: Record<Settings['level'], string> = {
  'HSK1-2': 'HSK 1–2',
  'HSK3-4': 'HSK 3–4',
  'HSK5-6': 'HSK 5–6',
  free: 'Tự do',
};

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return 'Không kết nối được server local. Hãy chạy npm run dev hoặc npm start rồi thử lại.';
  }
  return message || 'Có lỗi xảy ra khi kết nối với Tiểu Nhã.';
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadMessages();
    return saved.length ? saved : [makeGreeting()];
  });
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [phase, setPhase] = useState<Phase>('loading');
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const avatarRef = useRef<AvatarController | null>(null);
  const avatarReadyRef = useRef(false);
  const micRef = useRef<ChineseMic | null>(null);
  const micBaseRef = useRef('');
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const statusRequestRef = useRef(0);

  const settingsRef = useRef(settings);
  const messagesRef = useRef(messages);
  const progressRef = useRef(progress);
  const phaseRef = useRef(phase);
  const statusRef = useRef(status);
  const draftRef = useRef(draft);
  settingsRef.current = settings;
  messagesRef.current = messages;
  progressRef.current = progress;
  phaseRef.current = phase;
  statusRef.current = status;
  draftRef.current = draft;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4400);
  }, []);

  const refreshStatus = useCallback(async () => {
    const requestId = statusRequestRef.current + 1;
    statusRequestRef.current = requestId;
    setRefreshing(true);

    try {
      const data = await fetchStatus();
      if (requestId !== statusRequestRef.current) return;
      setStatus(data);
      setStatusError(null);
      setSettings((previous) => {
        const chosenProvider =
          data.providers.find(
            (provider) => provider.id === previous.providerId && provider.online,
          ) ||
          data.providers.find((provider) => provider.online) ||
          data.providers[0];
        const model = chosenProvider
          ? chosenProvider.models.includes(previous.model)
            ? previous.model
            : chosenProvider.recommendedModel || chosenProvider.models[0] || ''
          : '';
        const voice = data.voices.some((item) => item.id === previous.voice)
          ? previous.voice
          : data.defaultVoice || previous.voice;
        return {
          ...previous,
          providerId: chosenProvider?.id || '',
          model,
          voice,
        };
      });
    } catch (requestError) {
      if (requestId !== statusRequestRef.current) return;
      console.error('[status]', requestError);
      setStatusError(friendlyError(requestError));
    } finally {
      if (requestId === statusRequestRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveMessages(messages);
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const mic = new ChineseMic({
      onTranscript: (transcript) => {
        setDraft(`${micBaseRef.current}${transcript}`.trimStart());
      },
      onDone: (transcript) => {
        setListening(false);
        const spoken = transcript.trim();
        const combined = `${micBaseRef.current}${spoken}`.trim();
        setDraft(combined);
        if (spoken) {
          sendRef.current(combined);
        } else if (phaseRef.current === 'listening') {
          setPhase(avatarReadyRef.current ? 'ready' : 'loading');
        }
      },
      onError: (message) => {
        setError(message);
      },
      onState: (active) => {
        setListening(active);
      },
    });
    micRef.current = mic;

    return () => {
      mic.abort();
      micRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const activeProvider = useMemo(
    () => status?.providers.find((provider) => provider.id === settings.providerId) || null,
    [status, settings.providerId],
  );
  const providerOnline = Boolean(activeProvider?.online);
  const canChat = Boolean(status && activeProvider?.online && settings.model);
  const busy = phase === 'thinking' || phase === 'replying';
  const visibleError = error || statusError;
  const week = useMemo(() => lastSevenDays(progress), [progress]);
  const goalPercent = Math.min(
    100,
    Math.round((progress.todayTurns / DAILY_GOAL) * 100),
  );
  const goalReached = progress.todayTurns >= DAILY_GOAL;

  const handleDraftChange = (value: string) => {
    setDraft(value);
  };

  const handleAvatarReady = useCallback((controller: AvatarController) => {
    avatarRef.current = controller;
    avatarReadyRef.current = true;
    setPhase((current) => (current === 'loading' ? 'ready' : current));
    controller.applyReaction('happy', 'handup');
  }, []);

  const handleAudioState = useCallback((playing: boolean) => {
    if (playing) {
      setPhase('speaking');
      return;
    }
    if (busyRef.current) return;
    setPhase((current) =>
      current === 'speaking' ? (avatarReadyRef.current ? 'ready' : 'loading') : current,
    );
  }, []);

  const handleAvatarIssue = useCallback((message: string) => {
    avatarReadyRef.current = true;
    setError(message);
    setPhase((current) => (current === 'loading' || current === 'speaking' ? 'ready' : current));
  }, []);

  const send = useCallback(
    (rawText?: string) => {
      const text = (rawText ?? draftRef.current).trim();
      if (!text || busyRef.current) return;

      const currentStatus = statusRef.current;
      const active = currentStatus?.providers.find(
        (provider) => provider.id === settingsRef.current.providerId,
      );
      if (!currentStatus) {
        setError('Đang kết nối server local. Đợi một chút rồi thử lại nhé.');
        return;
      }
      if (!active?.online || !settingsRef.current.model) {
        setError(
          'Chưa có model local sẵn sàng. Mở Ollama hoặc LM Studio, sau đó kiểm tra trong Cài đặt.',
        );
        return;
      }

      setError(null);
      micRef.current?.abort();
      setListening(false);
      avatarRef.current?.stopSpeech();
      avatarRef.current?.beginTurn();
      avatarRef.current?.setThinking();
      busyRef.current = true;
      setPhase('thinking');

      const userMessage: ChatMessage = {
        id: uid(),
        role: 'user',
        text,
        createdAt: Date.now(),
      };
      const assistantId = uid();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        streaming: true,
        emotion: 'happy',
        gesture: 'none',
        createdAt: Date.now(),
      };
      const baseMessages = [...messagesRef.current, userMessage];
      setMessages([...baseMessages, assistantMessage]);
      setDraft('');

      const autoSpeak = settingsRef.current.autoSpeak;
      const voice = settingsRef.current.voice;
      let streamedText = '';
      let emotion: Emotion = 'happy';
      let gesture: Gesture = 'none';
      let speechCursor = 0;
      let spoke = false;
      let completed = false;

      const patchAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message,
          ),
        );
      };

      const feedSpeech = (fullText: string, flush: boolean) => {
        if (!autoSpeak) return;
        const result = extractSpeechSegments(fullText, speechCursor, flush);
        speechCursor = result.cursor;
        if (!result.segments.length) return;
        for (const segment of result.segments) {
          avatarRef.current?.queueSpeech(segment, voice);
        }
        spoke = true;
        setPhase('speaking');
      };

      const history: ChatHistoryMessage[] = baseMessages
        .filter(
          (message) =>
            !message.error &&
            !message.streaming &&
            message.kind !== 'greeting' &&
            message.text.trim(),
        )
        .map((message) => ({ role: message.role, content: message.text }));

      const abort = new AbortController();
      abortRef.current = abort;

      void streamChat(
        {
          provider: settingsRef.current.providerId,
          model: settingsRef.current.model,
          level: settingsRef.current.level,
          messages: history,
        },
        {
          onAttitude: (event) => {
            if (event.emotion) emotion = event.emotion;
            if (event.gesture) gesture = event.gesture;
            patchAssistant({ emotion, gesture });
            avatarRef.current?.applyReaction(event.emotion, event.gesture);
          },
          onReplyDelta: (chunk) => {
            streamedText += chunk;
            patchAssistant({ text: streamedText, emotion, gesture });
            if (phaseRef.current === 'thinking') setPhase('replying');
            feedSpeech(streamedText, false);
          },
          onReplyDone: () => {
            feedSpeech(streamedText, true);
            patchAssistant({ streaming: false });
          },
          onTurn: (event) => {
            completed = true;
            const turn = event.turn;
            if (turn.reply) streamedText = turn.reply;
            emotion = turn.emotion || emotion;
            gesture = turn.gesture || gesture;

            patchAssistant({
              text: streamedText,
              translation: turn.translation,
              emotion,
              gesture,
              corrections: turn.corrections,
              vocab: turn.vocab,
              suggestion: turn.suggestion,
              suggestionTranslation: turn.suggestionTranslation,
              streaming: false,
            });
            avatarRef.current?.applyReaction(turn.emotion, turn.gesture);

            if (autoSpeak && !spoke && streamedText) {
              const started = avatarRef.current?.speakAll(
                streamedText,
                voice,
                turn.emotion,
                turn.gesture,
              );
              if (started) setPhase('speaking');
            } else if (!autoSpeak) {
              setPhase('ready');
            }

            if (event.warning) {
              showToast('Câu trả lời đã được chuẩn hoá để hiển thị đầy đủ.');
            }

            const nextProgress = recordPractice(progressRef.current);
            progressRef.current = nextProgress;
            setProgress(nextProgress);
            if (nextProgress.todayTurns === DAILY_GOAL) {
              showToast('Đã đạt mục tiêu hôm nay. Tiếp tục giữ nhịp thật đều nhé!');
            }
          },
        },
        abort.signal,
      )
        .catch((streamError: unknown) => {
          if (abort.signal.aborted) return;
          console.error('[chat]', streamError);
          if (!completed) {
            setError(friendlyError(streamError));
            setMessages((current) => {
              const target = current.find((message) => message.id === assistantId);
              if (target && !target.text.trim()) {
                return current.filter((message) => message.id !== assistantId);
              }
              return current.map((message) =>
                message.id === assistantId ? { ...message, streaming: false } : message,
              );
            });
            avatarRef.current?.stopSpeech();
            setPhase('ready');
          }
        })
        .finally(() => {
          if (abortRef.current === abort) abortRef.current = null;
          busyRef.current = false;
          setPhase((current) => {
            if (current === 'thinking' || current === 'replying') return 'ready';
            if (current === 'speaking' && !avatarRef.current?.isSpeaking) return 'ready';
            return current;
          });
        });
    },
    [showToast],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  const handleMicToggle = async () => {
    if (listening) {
      micRef.current?.stop();
      return;
    }
    if (busyRef.current) return;
    if (!isSpeechSupported()) {
      setError(
        'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge, hoặc gõ tin nhắn bằng tiếng Trung.',
      );
      return;
    }
    if (!canChat) {
      setError(
        'Chưa có model local sẵn sàng. Kiểm tra Ollama hoặc LM Studio trong Cài đặt trước khi nói nhé.',
      );
      return;
    }

    setError(null);
    const permission = await micPermissionState();
    if (permission === 'denied') {
      setError(
        'Quyền micro đang bị chặn. Hãy mở trang bằng Chrome hoặc Edge, bật quyền micro cho trình duyệt trong System Settings → Privacy & Security → Microphone, rồi tải lại trang.',
      );
      return;
    }

    avatarRef.current?.stopSpeech();
    micBaseRef.current = draftRef.current.trim() ? `${draftRef.current.trim()} ` : '';
    setPhase('listening');
    const started = micRef.current?.start();
    if (!started) {
      setPhase(avatarReadyRef.current ? 'ready' : 'loading');
      setError('Không khởi động được micro. Kiểm tra quyền truy cập micro của trình duyệt.');
    }
  };

  const handleReplay = (message: ChatMessage) => {
    if (busyRef.current || !message.text.trim()) return;
    const controller = avatarRef.current;
    if (!controller?.isLoaded) {
      setError('Avatar chưa sẵn sàng để đọc câu trả lời.');
      return;
    }
    const started = controller.speakAll(
      message.text,
      settingsRef.current.voice,
      message.emotion || 'happy',
      message.gesture || 'none',
    );
    if (started) {
      setPhase('speaking');
      setError(null);
    }
  };

  const handleSettingsChange = (patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      if (patch.providerId && patch.providerId !== previous.providerId) {
        const provider = statusRef.current?.providers.find(
          (item) => item.id === patch.providerId,
        );
        next.model = provider?.recommendedModel || provider?.models[0] || '';
      }
      return next;
    });
  };

  const openSettings = useCallback(() => {
    micRef.current?.abort();
    setListening(false);
    if (phaseRef.current === 'listening') {
      setPhase(avatarReadyRef.current ? 'ready' : 'loading');
    }
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleToggleSound = () => {
    const muting = settingsRef.current.autoSpeak;
    setSettings((previous) => ({ ...previous, autoSpeak: !previous.autoSpeak }));
    if (muting) {
      avatarRef.current?.stopSpeech();
      setPhase((current) => (current === 'speaking' ? 'ready' : current));
      showToast('Đã tắt giọng đọc. Tiểu Nhã vẫn trả lời bằng chữ.');
    } else {
      showToast('Đã bật giọng đọc cho câu trả lời tiếp theo.');
    }
  };

  const handleTogglePinyin = () => {
    setSettings((previous) => ({ ...previous, showPinyin: !previous.showPinyin }));
  };

  const handleNewChat = () => {
    if (
      !window.confirm(
        'Bắt đầu cuộc trò chuyện mới? Nội dung hội thoại hôm nay sẽ được xoá khỏi trình duyệt.',
      )
    ) {
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    micRef.current?.abort();
    setListening(false);
    avatarRef.current?.stopSpeech();
    clearMessages();
    setMessages([makeGreeting()]);
    setError(null);
    setPhase(avatarReadyRef.current ? 'ready' : 'loading');
    showToast('Đã mở cuộc trò chuyện mới.');
  };

  const handleResetProgress = () => {
    if (
      !window.confirm(
        'Đặt lại toàn bộ chuỗi ngày, XP và số lượt đã luyện? Hội thoại hôm nay vẫn được giữ lại.',
      )
    ) {
      return;
    }
    const fresh = resetProgress();
    progressRef.current = fresh;
    setProgress(fresh);
    showToast('Đã đặt lại tiến độ luyện tập.');
  };

  const handlePreviewVoice = () => {
    const controller = avatarRef.current;
    if (!controller?.isLoaded) {
      setError('Avatar chưa sẵn sàng để nghe thử giọng.');
      return;
    }
    const started = controller.speakAll(
      '你好呀，我是小雅。很高兴和你一起练习中文。',
      settingsRef.current.voice,
      'happy',
      'handup',
    );
    if (started) setPhase('speaking');
  };

  const handleDismissError = () => {
    setError(null);
    setStatusError(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-seal" aria-hidden="true">
            雅
          </div>
          <div className="brand-copy">
            <p className="brand-title">小雅</p>
            <p className="brand-subtitle">Luyện nói tiếng Trung mỗi ngày</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="runtime-chip"
            type="button"
            onClick={openSettings}
            title="Xem hoặc đổi model local"
          >
            <span className={`status-dot${providerOnline ? ' is-online' : ''}`} />
            <span className="runtime-chip-copy">
              <strong>
                {activeProvider ? activeProvider.name : refreshing ? 'Đang kết nối' : 'Chưa kết nối'}
              </strong>
              <small>
                {settings.model
                  ? shortModelName(settings.model, 26)
                  : activeProvider
                    ? 'Chọn model'
                    : 'Ollama · LM Studio'}
              </small>
            </span>
            <ChevronDownIcon size={14} />
          </button>

          <button
            className="level-chip"
            type="button"
            onClick={openSettings}
            title="Đổi trình độ luyện tập"
          >
            {LEVEL_LABEL[settings.level]}
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={handleToggleSound}
            title={settings.autoSpeak ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
            aria-label={settings.autoSpeak ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
          >
            {settings.autoSpeak ? <VolumeIcon size={19} /> : <MuteIcon size={19} />}
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={openSettings}
            title="Cài đặt"
            aria-label="Mở cài đặt"
          >
            <SettingsIcon size={19} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="stage-column">
          <AvatarStage
            avatarUrl={status?.avatarUrl}
            phase={phase}
            onReady={handleAvatarReady}
            onAudioState={handleAudioState}
            onUnavailable={handleAvatarIssue}
          />

          <div className="progress-strip">
            <div className="streak-block">
              <span className="streak-icon">
                <FlameIcon size={18} />
              </span>
              <div>
                <strong>{progress.streak}</strong>
                <span>ngày liên tiếp</span>
              </div>
            </div>

            <div className="goal-block">
              <div className="goal-labels">
                <span>{goalReached ? 'Đã đạt mục tiêu hôm nay' : 'Mục tiêu hôm nay'}</span>
                <span className="goal-count">
                  {progress.todayTurns}/{DAILY_GOAL}
                </span>
              </div>
              <div className="goal-track">
                <span style={{ width: `${Math.max(3, goalPercent)}%` }} />
              </div>
            </div>

            <div className="week-mini" title="Bảy ngày gần nhất">
              {week.map((day) => (
                <span
                  key={day.key}
                  className={`week-mini-dot${day.active ? ' is-active' : ''}${day.today ? ' is-today' : ''}`}
                  title={day.key}
                />
              ))}
            </div>
          </div>
        </section>

        <ChatPanel
          messages={messages}
          phase={phase}
          draft={draft}
          listening={listening}
          micSupported={isSpeechSupported()}
          canSend={canChat && !busy}
          showPinyin={settings.showPinyin}
          todayTurns={progress.todayTurns}
          goal={DAILY_GOAL}
          error={visibleError}
          onDraftChange={handleDraftChange}
          onSend={() => send()}
          onMicToggle={handleMicToggle}
          onReplay={handleReplay}
          onTogglePinyin={handleTogglePinyin}
          onNewChat={handleNewChat}
          onDismissError={handleDismissError}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        status={status}
        settings={settings}
        progress={progress}
        refreshing={refreshing}
        onClose={closeSettings}
        onChange={handleSettingsChange}
        onRefresh={() => void refreshStatus()}
        onPreviewVoice={handlePreviewVoice}
        onClearChat={handleNewChat}
        onResetProgress={handleResetProgress}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
