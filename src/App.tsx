import { recordPronunciation } from './lib/learning';
import { VoiceSourceNotice } from './components/VoiceSourceNotice';
import { Assessment } from './components/Assessment';
import { SetupCheck } from './components/SetupCheck';
import { isDue, loadAssessment } from './lib/assessment';
import { loadLessonProgress } from './lib/lessonStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarStage } from './components/AvatarStage';
import { ChatPanel } from './components/ChatPanel';
import { LearnerPicker } from './components/LearnerPicker';
import { LearningDialog } from './components/LearningDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { BookIcon, ChevronDownIcon, FlameIcon, MuteIcon, SettingsIcon, VolumeIcon } from './components/Icons';
import type { AvatarApi } from './lib/avatarApi';
import { analyzeLearning, fetchCorrections, fetchStatus, streamChat } from './lib/api';
import { clearCustomAvatar, loadCustomAvatar, saveCustomAvatar } from './lib/avatarStore';
import { ChineseMic, configureSpeech, isSpeechSupported, micPermissionState } from './lib/speech';
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
import {
  addReport,
  buildAnalysisInput,
  buildLearningDigest,
  clearLearning,
  dueWords,
  emptyLearning,
  learningPeriodDays,
  loadLearning,
  recordLearningCorrections,
  recordLearningTurn,
  reviewWord,
  saveLearning,
  seedLearningFromMessages,
} from './lib/learning';
import { createLearner, loadActiveLearnerId, loadLearners, setActiveLearner, updateLearnerLevel } from './lib/learners';
import type { Learner } from './lib/learners';
import { DailyLesson } from './components/DailyLesson';
import { extractSpeechSegments, makeGreeting, shortModelName, uid } from './lib/text';
import type {
  AvatarMode,
  ChatHistoryMessage,
  ChatMessage,
  Emotion,
  Gesture,
  Level,
  LearningProfile,
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
  return message || 'Có lỗi xảy ra khi kết nối với Misu.';
}

interface TutorProps {
  learner: Learner;
  onSwitchLearner: () => void;
}

function Tutor({ learner, onSwitchLearner }: TutorProps) {
  const scope = learner.id;
  const [settings, setSettings] = useState<Settings>(() => ({
    ...loadSettings(),
    level: learner.level,
  }));
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadMessages(scope);
    return saved.length ? saved : [makeGreeting(learner.name)];
  });
  const [progress, setProgress] = useState<Progress>(() => loadProgress(scope));
  const [learning, setLearning] = useState<LearningProfile>(() => {
    const saved = loadLearning(scope);
    if (saved.updatedAt) return saved;
    return seedLearningFromMessages(messages);
  });
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [phase, setPhase] = useState<Phase>('loading');
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learningOpen, setLearningOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(() => localStorage.getItem('xiaoya.setup.v1') !== 'done');
  const assessmentData = loadAssessment(learner.id);
  const lessonProgress = loadLessonProgress(learner.id);
  const firstStudyAt = Math.min(
    ...[
      ...learning.words.map((w) => w.firstSeen),
      ...learning.mistakes.map((m) => m.firstSeen),
      ...assessmentData.samples.map((s) => s.date),
      ...learning.days.filter((d) => d.turns > 0).map((d) => new Date(d.date + 'T00:00:00').getTime()),
    ].filter((n) => n > 0),
    Date.now(),
  );
  const assessmentDue =
    isDue('week', assessmentData.history, lessonProgress?.completed ?? 0, firstStudyAt) ||
    isDue('month', assessmentData.history, lessonProgress?.completed ?? 0, firstStudyAt);
  function closeSetup() {
    localStorage.setItem('xiaoya.setup.v1', 'done');
    setSetupOpen(false);
  }

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [customAvatar, setCustomAvatar] = useState<{
    url: string;
    name: string;
    kind: AvatarMode;
  } | null>(null);
  const [avatarChecked, setAvatarChecked] = useState(false);

  const customAvatarUrlRef = useRef<string | null>(null);

  const avatarRef = useRef<AvatarApi | null>(null);
  const avatarReadyRef = useRef(false);
  const micRef = useRef<ChineseMic | null>(null);
  const micBaseRef = useRef('');
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const statusRequestRef = useRef(0);
  const learningEpochRef = useRef(0);

  const settingsRef = useRef(settings);
  const messagesRef = useRef(messages);
  const progressRef = useRef(progress);
  const learningRef = useRef(learning);
  const phaseRef = useRef(phase);
  const statusRef = useRef(status);
  const draftRef = useRef(draft);
  settingsRef.current = settings;
  messagesRef.current = messages;
  progressRef.current = progress;
  learningRef.current = learning;
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
      configureSpeech({ local: Boolean(data.localStt) });
      setStatus(data);
      setStatusError(null);
      setSettings((previous) => {
        const chosenProvider =
          data.providers.find((provider) => provider.id === previous.providerId && provider.online) ||
          data.providers.find((provider) => provider.online) ||
          data.providers[0];
        const model = chosenProvider
          ? chosenProvider.models.includes(previous.model)
            ? previous.model
            : chosenProvider.recommendedModel || chosenProvider.models[0] || ''
          : '';
        const voice = data.voices.some((item) => item.id === previous.voice) ? previous.voice : data.defaultVoice || previous.voice;
        const viVoice = data.viVoices?.some((item) => item.id === previous.viVoice)
          ? previous.viVoice
          : data.defaultViVoice || previous.viVoice;
        return {
          ...previous,
          providerId: chosenProvider?.id || '',
          model,
          voice,
          viVoice,
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
    let cancelled = false;
    loadCustomAvatar()
      .then((stored) => {
        if (cancelled || !stored) return;
        setCustomAvatar({
          url: URL.createObjectURL(stored.blob),
          name: stored.name,
          kind: stored.kind,
        });
      })
      .catch((avatarError) => console.error('[avatar] stored file', avatarError))
      .finally(() => {
        if (!cancelled) setAvatarChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previous = customAvatarUrlRef.current;
    const current = customAvatar?.url ?? null;
    if (previous && previous !== current) URL.revokeObjectURL(previous);
    customAvatarUrlRef.current = current;
  }, [customAvatar]);

  useEffect(() => {
    return () => {
      if (customAvatarUrlRef.current) URL.revokeObjectURL(customAvatarUrlRef.current);
    };
  }, []);

  useEffect(() => {
    updateLearnerLevel(learner.id, settings.level);
  }, [learner.id, settings.level]);

  useEffect(() => {
    configureSpeech({ learnerId: learner.id });
  }, [learner.id]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    saveLearning(learning, scope);
  }, [learning, scope]);

  useEffect(() => {
    saveMessages(messages, scope);
    messagesRef.current = messages;
  }, [messages, scope]);

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
  const avatarMode: AvatarMode = customAvatar?.kind ?? settings.avatarMode;
  const busy = phase === 'thinking' || phase === 'replying';
  const visibleError = error || statusError;
  const week = useMemo(() => lastSevenDays(progress), [progress]);
  const learningDue = useMemo(() => dueWords(learning).length, [learning]);

  const getAvatar = useCallback(() => avatarRef.current, []);
  const updateLearning = useCallback((update: (previous: LearningProfile) => LearningProfile) => {
    const next = update(learningRef.current);
    learningRef.current = next;
    setLearning(next);
  }, []);
  useEffect(()=>{
    const error=(event:Event)=>{const e=(event as CustomEvent).detail;if(e?.learnerId!==scope)return;updateLearning(p=>recordPronunciation(p,e));};
    const sound=(event:Event)=>{const e=(event as CustomEvent).detail;if(e?.learnerId!==scope||e.correct)return;updateLearning(p=>recordPronunciation(p,{kind:'sound',target:e.text,contrast:e.pairId,heard:e.heard}));};
    window.addEventListener('misu:pronunciation-error',error);window.addEventListener('misu:sound-answer',sound);
    return()=>{window.removeEventListener('misu:pronunciation-error',error);window.removeEventListener('misu:sound-answer',sound);};
  },[scope,updateLearning]);
  const goalPercent = Math.min(100, Math.round((progress.todayTurns / DAILY_GOAL) * 100));
  const goalReached = progress.todayTurns >= DAILY_GOAL;

  const handleDraftChange = (value: string) => {
    setDraft(value);
  };

  const handleAvatarReady = useCallback((controller: AvatarApi) => {
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
    setPhase((current) => (current === 'speaking' ? (avatarReadyRef.current ? 'ready' : 'loading') : current));
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
      const active = currentStatus?.providers.find((provider) => provider.id === settingsRef.current.providerId);
      if (!currentStatus) {
        setError('Đang kết nối server local. Đợi một chút rồi thử lại nhé.');
        return;
      }
      if (!active?.online || !settingsRef.current.model) {
        setError('Chưa có model sẵn sàng. Mở Ollama hoặc LM Studio, sau đó kiểm tra trong Cài đặt.');
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
      let translationQueued = false;
      let completed = false;

      const patchAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, ...patch } : message)));
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
        .filter((message) => !message.error && !message.streaming && message.kind !== 'greeting' && message.text.trim())
        .map((message) => ({ role: message.role, content: message.text }));

      const abort = new AbortController();
      abortRef.current = abort;

      void streamChat(
        {
          provider: settingsRef.current.providerId,
          model: settingsRef.current.model,
          level: settingsRef.current.level,
          messages: history,
          learning: [`Tên học viên: ${learner.name}`, buildLearningDigest(learningRef.current)].filter(Boolean).join('\n\n') || undefined,
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
          onTranslation: (text) => {
            patchAssistant({ translation: text });
            if (autoSpeak && settingsRef.current.autoReadTranslation && text.trim()) {
              avatarRef.current?.queueSpeech(text, settingsRef.current.viVoice);
              translationQueued = true;
            }
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
              corrections: [],
              correctionsPending: true,
              vocab: turn.vocab,
              suggestion: turn.suggestion,
              suggestionTranslation: turn.suggestionTranslation,
              streaming: false,
            });
            avatarRef.current?.applyReaction(turn.emotion, turn.gesture);

            if (autoSpeak && !spoke && streamedText) {
              const started = avatarRef.current?.speakAll(streamedText, voice, turn.emotion, turn.gesture);
              if (started) setPhase('speaking');
            } else if (!autoSpeak) {
              setPhase('ready');
            }

            if (autoSpeak && !translationQueued && settingsRef.current.autoReadTranslation && turn.translation.trim()) {
              avatarRef.current?.queueSpeech(turn.translation, settingsRef.current.viVoice);
            }

            const nextLearning = recordLearningTurn(learningRef.current, text, turn);
            learningRef.current = nextLearning;
            setLearning(nextLearning);

            if (event.warning) {
              showToast('Câu trả lời đã được chuẩn hoá để hiển thị đầy đủ.');
            }

            const nextProgress = recordPractice(progressRef.current, scope);
            progressRef.current = nextProgress;
            setProgress(nextProgress);
            if (nextProgress.todayTurns === DAILY_GOAL) {
              showToast('Đã đạt mục tiêu hôm nay. Tiếp tục giữ nhịp thật đều nhé!');
            }

            const learningEpoch = learningEpochRef.current;
            const { providerId, model: modelId } = settingsRef.current;
            void fetchCorrections({ provider: providerId, model: modelId, text })
              .then((corrections) => {
                patchAssistant({ corrections, correctionsPending: false });
                if (
                  !corrections.length ||
                  learningEpoch !== learningEpochRef.current ||
                  !messagesRef.current.some((message) => message.id === assistantId)
                ) {
                  return;
                }
                const withCorrections = recordLearningCorrections(learningRef.current, text, corrections);
                learningRef.current = withCorrections;
                setLearning(withCorrections);
              })
              .catch(() => {
                patchAssistant({ correctionsPending: false });
              });
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
              return current.map((message) => (message.id === assistantId ? { ...message, streaming: false } : message));
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
      setError('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge, hoặc gõ tin nhắn bằng tiếng Trung.');
      return;
    }
    if (!canChat) {
      setError('Chưa có model sẵn sàng. Kiểm tra Ollama hoặc LM Studio trong Cài đặt trước khi nói nhé.');
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
    const started = controller.speakAll(message.text, settingsRef.current.voice, message.emotion || 'happy', message.gesture || 'none');
    if (started) {
      setPhase('speaking');
      setError(null);
    }
  };

  const speakText = useCallback((text: string, voice: string, emotion: Emotion) => {
    const clean = text.trim();
    if (!clean) return;
    const controller = avatarRef.current;
    if (!controller?.isLoaded) {
      setError('Avatar chưa sẵn sàng để đọc câu này.');
      return;
    }
    const started = controller.speakAll(clean, voice, emotion, 'none');
    if (started) {
      setPhase('speaking');
      setError(null);
    }
  }, []);

  const handleSpeakTranslation = (message: ChatMessage) => {
    if (busyRef.current || !message.translation?.trim()) return;
    speakText(message.translation, settingsRef.current.viVoice, 'warm');
  };

  const handleSpeakChinese = useCallback(
    (text: string) => {
      speakText(text, settingsRef.current.voice, 'happy');
    },
    [speakText],
  );

  const handleSpeakVietnamese = useCallback(
    (text: string) => {
      speakText(text, settingsRef.current.viVoice, 'warm');
    },
    [speakText],
  );

  const handlePreviewTranslation = () => {
    speakText('Xin chào, mình là Misu. Đây là giọng đọc tiếng Việt của mình.', settingsRef.current.viVoice, 'warm');
  };

  const openLearning = useCallback(() => {
    micRef.current?.abort();
    setListening(false);
    if (phaseRef.current === 'listening') {
      setPhase(avatarReadyRef.current ? 'ready' : 'loading');
    }
    setAnalysisError(null);
    setLearningOpen(true);
  }, []);

  const closeLearning = useCallback(() => {
    setLearningOpen(false);
  }, []);

  const handleReviewWord = useCallback(
    (word: string, remembered: boolean) => {
      const next = reviewWord(learningRef.current, word, remembered);
      learningRef.current = next;
      setLearning(next);
      showToast(remembered ? `Đã ghi nhận bạn nhớ “${word}”.` : `Sẽ gặp lại “${word}” sau 10 phút.`);
    },
    [showToast],
  );

  const handleAnalyzeLearning = useCallback(async () => {
    const active = statusRef.current?.providers.find((provider) => provider.id === settingsRef.current.providerId);
    if (!statusRef.current || !active?.online || !settingsRef.current.model) {
      setAnalysisError('Chưa có model sẵn sàng. Kiểm tra Ollama hoặc LM Studio trong Cài đặt.');
      return;
    }
    if (analyzing) return;

    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const levelLabel = LEVEL_LABEL[settingsRef.current.level];
      const profileText = `Trình độ hiện tại: ${levelLabel}\n\n${buildAnalysisInput(learningRef.current)}`;
      const report = await analyzeLearning({
        provider: settingsRef.current.providerId,
        model: settingsRef.current.model,
        profile: profileText,
        periodDays: learningPeriodDays(learningRef.current),
      });
      const next = addReport(learningRef.current, report);
      learningRef.current = next;
      setLearning(next);
      saveLearning(next, scope);
      showToast('Đã cập nhật phân tích điểm yếu.');
    } catch (analysisFailure) {
      console.error('[analysis]', analysisFailure);
      setAnalysisError(friendlyError(analysisFailure));
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, showToast]);

  const handleClearLearning = () => {
    if (
      !window.confirm('Xoá toàn bộ hồ sơ học tập gồm lỗi đã ghi, từ vựng, lịch ôn và các bản phân tích? Thao tác này không thể hoàn tác.')
    ) {
      return;
    }
    const fresh = emptyLearning(Date.now());
    learningEpochRef.current += 1;
    learningRef.current = fresh;
    setLearning(fresh);
    saveLearning(fresh, scope);
    setAnalysisError(null);
    setAnalyzing(false);
    showToast('Đã xoá hồ sơ học tập. Tiến độ chuỗi ngày vẫn được giữ.');
  };

  const handleSettingsChange = (patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      if (patch.providerId && patch.providerId !== previous.providerId) {
        const provider = statusRef.current?.providers.find((item) => item.id === patch.providerId);
        next.model = provider?.recommendedModel || provider?.models[0] || '';
      }
      return next;
    });
  };

  const handlePickAvatar = async (file: File) => {
    try {
      const stored = await saveCustomAvatar(file);
      avatarRef.current?.stopSpeech();
      avatarRef.current = null;
      avatarReadyRef.current = false;
      setCustomAvatar({
        url: URL.createObjectURL(stored.blob),
        name: stored.name,
        kind: stored.kind,
      });
      setError(null);
      setPhase('loading');
      showToast(`Đang dùng avatar “${stored.name}”.`);
    } catch (pickError) {
      showToast(pickError instanceof Error ? pickError.message : 'Không đổi được avatar.');
    }
  };

  const handleClearAvatar = async () => {
    try {
      await clearCustomAvatar();
      avatarRef.current?.stopSpeech();
      avatarRef.current = null;
      avatarReadyRef.current = false;
      setCustomAvatar(null);
      setError(null);
      setPhase('loading');
      showToast('Đã trở lại avatar mặc định.');
    } catch (clearError) {
      showToast(clearError instanceof Error ? clearError.message : 'Không xoá được avatar.');
    }
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
      showToast('Đã tắt giọng đọc. Misu vẫn trả lời bằng chữ.');
    } else {
      showToast('Đã bật giọng đọc cho câu trả lời tiếp theo.');
    }
  };

  const handleTogglePinyin = () => {
    setSettings((previous) => ({ ...previous, showPinyin: !previous.showPinyin }));
  };

  const handleNewChat = () => {
    if (!window.confirm('Bắt đầu cuộc trò chuyện mới? Nội dung hội thoại hôm nay sẽ được xoá khỏi trình duyệt.')) {
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    micRef.current?.abort();
    setListening(false);
    avatarRef.current?.stopSpeech();
    clearMessages(scope);
    setMessages([makeGreeting(learner.name)]);
    setError(null);
    setPhase(avatarReadyRef.current ? 'ready' : 'loading');
    showToast('Đã mở cuộc trò chuyện mới.');
  };

  const handleResetProgress = () => {
    if (!window.confirm('Đặt lại toàn bộ chuỗi ngày, XP và số lượt đã luyện? Hội thoại hôm nay vẫn được giữ lại.')) {
      return;
    }
    const fresh = resetProgress(scope);
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
    const started = controller.speakAll('你好呀，我是米苏。很高兴和你一起练习中文。', settingsRef.current.voice, 'happy', 'handup');
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
            苏
          </div>
          <div className="brand-copy">
            <p className="brand-title">米苏</p>
            <p className="brand-subtitle">Luyện nói tiếng Trung mỗi ngày</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="learner-chip" type="button" onClick={onSwitchLearner} title="Đổi người học">
            {learner.name}
          </button>

          <button
            className="lesson-launch"
            type="button"
            onClick={() => {
              micRef.current?.abort();
              avatarRef.current?.stopSpeech();
              setAssessmentOpen(false);
              setLessonOpen((open) => !open);
            }}
            title="Bài học theo lộ trình, có nghe hiểu và luyện nói"
          >
            {lessonOpen ? 'Về trò chuyện' : 'Bài hôm nay'}
          </button>

          <button
            type="button"
            className={`lesson-launch${assessmentDue ? ' is-due' : ''}`}
            onClick={() => {
              micRef.current?.abort();
              avatarRef.current?.stopSpeech();
              setLessonOpen(false);
              setAssessmentOpen((v) => !v);
            }}
          >
            Kiểm tra{assessmentDue ? ' · đến hạn' : ''}
          </button>
          <button className="runtime-chip" type="button" onClick={openSettings} title="Xem hoặc đổi model local">
            <span className={`status-dot${providerOnline ? ' is-online' : ''}`} />
            <span className="runtime-chip-copy">
              <strong>{activeProvider ? activeProvider.name : refreshing ? 'Đang kết nối' : 'Chưa kết nối'}</strong>
              <small>{settings.model ? shortModelName(settings.model, 26) : activeProvider ? 'Chọn model' : 'Ollama · LM Studio'}</small>
            </span>
            <ChevronDownIcon size={14} />
          </button>

          <button className="level-chip" type="button" onClick={openSettings} title="Đổi trình độ luyện tập">
            {LEVEL_LABEL[settings.level]}
          </button>

          <button
            className="icon-button learning-button"
            type="button"
            onClick={openLearning}
            title="Hồ sơ học tập và ôn bài"
            aria-label="Mở hồ sơ học tập và ôn bài"
          >
            <BookIcon size={19} />
            {learningDue > 0 && <span className="learning-badge">{learningDue > 9 ? '9+' : learningDue}</span>}
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

          <button className="icon-button" type="button" onClick={openSettings} title="Cài đặt" aria-label="Mở cài đặt">
            <SettingsIcon size={19} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="stage-column">
          <AvatarStage
            avatarUrl={status?.avatarUrl}
            lamAvatarUrl={status?.lamAvatarUrl}
            customAvatarUrl={customAvatar?.url}
            deferred={!avatarChecked}
            mode={avatarMode}
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

        {assessmentOpen ? (
          <Assessment
            learnerId={learner.id}
            learning={learning}
            provider={settings.providerId}
            model={settings.model}
            level={settings.level}
            localStt={Boolean(status?.localStt)}
            say={(text) => getAvatar()?.speakAll(text, settings.voice, 'happy', 'none')}
            onLearningUpdate={updateLearning}
            onClose={() => setAssessmentOpen(false)}
          />
        ) : lessonOpen ? (
          <DailyLesson
            learner={learner}
            onLevelChange={(level) => handleSettingsChange({ level })}
            level={settings.level}
            provider={settings.providerId}
            model={settings.model}
            voice={settings.voice}
            localStt={Boolean(status?.localStt)}
            getAvatar={getAvatar}
            learning={learning}
            onLearningUpdate={updateLearning}
            onClose={() => setLessonOpen(false)}
          />
        ) : (
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
            onSpeakTranslation={handleSpeakTranslation}
            onTogglePinyin={handleTogglePinyin}
            onNewChat={handleNewChat}
            onDismissError={handleDismissError}
          />
        )}
      </main>

      {setupOpen && (
        <SetupCheck
          settings={settings}
          onChange={handleSettingsChange}
          onStatus={setStatus}
          onClose={closeSetup}
          onStart={() => {
            closeSetup();
            setAssessmentOpen(false);
            setLessonOpen(true);
          }}
        />
      )}
      {settings.providerId === 'compatible' && (
        <p className="remote-provider-notice" role="status">
          Đang dùng API bên ngoài: bản chép lời, hội thoại và dữ liệu học liên quan được gửi đến {activeProvider?.url}. Dịch vụ có thể tính
          phí.
        </p>
      )}
      <VoiceSourceNotice />
      <SettingsDialog
        open={settingsOpen}
        status={status}
        settings={settings}
        progress={progress}
        refreshing={refreshing}
        onClose={closeSettings}
        onChange={handleSettingsChange}
        onSetup={() => {
          setSettingsOpen(false);
          setSetupOpen(true);
        }}
        onRefresh={() => void refreshStatus()}
        onPreviewVoice={handlePreviewVoice}
        onPreviewTranslation={handlePreviewTranslation}
        onClearChat={handleNewChat}
        onResetProgress={handleResetProgress}
        customAvatar={customAvatar}
        onPickAvatar={handlePickAvatar}
        onClearAvatar={handleClearAvatar}
      />

      <LearningDialog
        learnerId={scope}
        open={learningOpen}
        learning={learning}
        levelLabel={LEVEL_LABEL[settings.level]}
        canAnalyze={canChat}
        analyzing={analyzing}
        analysisError={analysisError}
        onClose={closeLearning}
        onReviewWord={handleReviewWord}
        onAnalyze={() => void handleAnalyzeLearning()}
        onSpeakChinese={handleSpeakChinese}
        onSpeakVietnamese={handleSpeakVietnamese}
        onClearLearning={handleClearLearning}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [learners, setLearners] = useState<Learner[]>(loadLearners);
  const [activeId, setActiveId] = useState<string>(loadActiveLearnerId);
  const active = learners.find((item) => item.id === activeId) ?? null;

  const handlePick = (id: string) => {
    setActiveLearner(id);
    setActiveId(id);
  };

  const handleCreate = (name: string, level: Level) => {
    const created = createLearner(name, level);
    setLearners(loadLearners());
    setActiveId(created.id);
  };

  const handleSwitch = () => {
    setActiveLearner('');
    setActiveId('');
  };

  if (!active) {
    return <LearnerPicker learners={learners} onPick={handlePick} onCreate={handleCreate} />;
  }
  return <Tutor key={active.id} learner={active} onSwitchLearner={handleSwitch} />;
}
