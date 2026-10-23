import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ChatMessage, Phase } from '../types';
import { pinyinLine } from '../lib/text';
import {
  AlertIcon,
  ArrowRightIcon,
  CloseIcon,
  MicIcon,
  RefreshIcon,
  SendIcon,
  SparkIcon,
  VolumeIcon,
} from './Icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  phase: Phase;
  draft: string;
  listening: boolean;
  micSupported: boolean;
  canSend: boolean;
  showPinyin: boolean;
  todayTurns: number;
  goal: number;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onMicToggle: () => void;
  onReplay: (message: ChatMessage) => void;
  onSpeakTranslation: (message: ChatMessage) => void;
  onTogglePinyin: () => void;
  onNewChat: () => void;
  onDismissError: () => void;
}

function formatToday() {
  return new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TypingDots() {
  return (
    <span className="typing-dots" aria-label="Tiểu Nhã đang viết">
      <i />
      <i />
      <i />
    </span>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  showPinyin: boolean;
  busy: boolean;
  onReplay: (message: ChatMessage) => void;
  onSpeakTranslation: (message: ChatMessage) => void;
  onUseSuggestion: (text: string) => void;
}

function MessageItem({
  message,
  showPinyin,
  busy,
  onReplay,
  onSpeakTranslation,
  onUseSuggestion,
}: MessageItemProps) {
  const assistant = message.role === 'assistant';
  const pinyin = useMemo(
    () => (assistant && showPinyin ? pinyinLine(message.text) : ''),
    [assistant, message.text, showPinyin],
  );
  const hasText = Boolean(message.text.trim());

  if (!assistant) {
    return (
      <article className="message message-user">
        <div className="bubble bubble-user">
          <p className="bubble-cn">{message.text}</p>
        </div>
        <p className="user-meta">{formatTime(message.createdAt)}</p>
      </article>
    );
  }

  const hasExtras = Boolean(
    message.corrections?.length || message.vocab?.length,
  );

  return (
    <article className={`message message-assistant${message.streaming ? ' is-streaming' : ''}`}>
      <div className="speaker-avatar" aria-hidden="true">
        雅
      </div>
      <div className="message-content">
        <div className="message-meta">
          <span className="speaker-name">小雅</span>
          {message.kind === 'greeting' && <span className="message-tag">Lời chào</span>}
          {message.streaming && hasText && <span className="message-tag">đang viết</span>}
          <time dateTime={new Date(message.createdAt).toISOString()}>
            {formatTime(message.createdAt)}
          </time>
          {!message.streaming && hasText && (
            <button
              className="replay-button"
              type="button"
              onClick={() => onReplay(message)}
              disabled={busy}
              title="Nghe lại câu này"
            >
              <VolumeIcon size={14} />
              <span>Nghe</span>
            </button>
          )}
        </div>

        <div className="bubble bubble-assistant">
          {hasText ? (
            <>
              <p className="bubble-cn">
                {message.text}
                {message.streaming && <span className="stream-caret" aria-hidden="true" />}
              </p>
              {pinyin && <p className="pinyin-line">{pinyin}</p>}
              {message.translation && (
                <div className="translation-row">
                  <p className="bubble-translation">{message.translation}</p>
                  <button
                    className="translation-play"
                    type="button"
                    onClick={() => onSpeakTranslation(message)}
                    disabled={busy}
                    title="Nghe bản dịch bằng giọng Việt"
                  >
                    <VolumeIcon size={13} />
                    <span>Nghe tiếng Việt</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <TypingDots />
          )}
        </div>

        {hasExtras && !message.streaming && (
          <div className="study-cards">
            {Boolean(message.corrections?.length) && (
              <section className="feedback-card">
                <h3 className="feedback-title">
                  <span className="feedback-mark">修</span>
                  Góp ý nhỏ
                </h3>
                <div className="correction-list">
                  {message.corrections?.map((item, index) => (
                    <div className="correction-item" key={`${item.corrected}-${index}`}>
                      <div className="correction-line">
                        <span className="correction-wrong">{item.original}</span>
                        <ArrowRightIcon size={14} />
                        <span className="correction-right">{item.corrected}</span>
                      </div>
                      <p className="correction-note">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {Boolean(message.vocab?.length) && (
              <section className="feedback-card vocab-card">
                <h3 className="feedback-title">
                  <span className="feedback-mark feedback-mark-sage">词</span>
                  Từ vựng nên nhớ
                </h3>
                <div className="vocab-list">
                  {message.vocab?.map((item) => (
                    <div className="vocab-item" key={item.word}>
                      <div className="vocab-head">
                        <span className="vocab-word">{item.word}</span>
                        <span className="vocab-pinyin">{item.pinyin}</span>
                      </div>
                      <p>{item.meaning}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {message.correctionsPending && !message.streaming && (
          <p className="corrections-pending">
            <span className="corrections-pending-dot" aria-hidden="true" />
            Đang kiểm tra ngữ pháp…
          </p>
        )}

        {message.suggestion && !message.streaming && (
          <button
            className="suggestion-card"
            type="button"
            onClick={() => onUseSuggestion(message.suggestion || '')}
            disabled={busy}
          >
            <span className="suggestion-kicker">
              <SparkIcon size={13} />
              Thử nói câu này
            </span>
            <span className="suggestion-cn">{message.suggestion}</span>
            {message.suggestionTranslation && (
              <span className="suggestion-vi">{message.suggestionTranslation}</span>
            )}
            <span className="suggestion-go" aria-hidden="true">
              <ArrowRightIcon size={16} />
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

export function ChatPanel({
  messages,
  phase,
  draft,
  listening,
  micSupported,
  canSend,
  showPinyin,
  todayTurns,
  goal,
  error,
  onDraftChange,
  onSend,
  onMicToggle,
  onReplay,
  onSpeakTranslation,
  onTogglePinyin,
  onNewChat,
  onDismissError,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const busy = phase === 'thinking' || phase === 'replying';
  const canSubmit = canSend && draft.trim().length > 0;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (stickToBottom.current) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [draft]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickToBottom.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 140;
  };

  const useSuggestion = (text: string) => {
    onDraftChange(text);
    stickToBottom.current = true;
    textareaRef.current?.focus();
  };

  const submit = () => {
    if (!canSubmit) return;
    onSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className="chat-panel" aria-label="Cuộc trò chuyện với Tiểu Nhã">
      <header className="chat-head">
        <div>
          <h2>Cuộc trò chuyện</h2>
          <p className="chat-subtitle">
            {formatToday()} · {todayTurns}/{goal} lượt hôm nay
          </p>
        </div>
        <div className="chat-head-actions">
          <button
            className={`pinyin-toggle${showPinyin ? ' is-on' : ''}`}
            type="button"
            aria-pressed={showPinyin}
            onClick={onTogglePinyin}
            title="Hiện hoặc ẩn phiên âm"
          >
            Pinyin
          </button>
          <button
            className="icon-button subtle"
            type="button"
            onClick={onNewChat}
            title="Bắt đầu cuộc trò chuyện mới"
            aria-label="Bắt đầu cuộc trò chuyện mới"
          >
            <RefreshIcon size={17} />
          </button>
        </div>
      </header>

      <div
        className="message-list"
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Tin nhắn"
      >
        <div className="day-divider">
          <span>Hôm nay</span>
        </div>
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            showPinyin={showPinyin}
            busy={busy}
            onReplay={onReplay}
            onSpeakTranslation={onSpeakTranslation}
            onUseSuggestion={useSuggestion}
          />
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="chat-error" role="alert">
          <AlertIcon size={16} />
          <p>{error}</p>
          <button
            className="error-close"
            type="button"
            onClick={onDismissError}
            aria-label="Đóng thông báo"
          >
            <CloseIcon size={15} />
          </button>
        </div>
      )}

      <footer className="composer-area">
        {listening && (
          <div className="listening-strip">
            <span className="listening-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              {draft.trim() || 'Đang nghe bạn nói tiếng Trung… ngừng 3 giây để gửi.'}
            </span>
            <button type="button" onClick={onMicToggle}>
              Xong
            </button>
          </div>
        )}
        <div className={`composer${listening ? ' is-listening' : ''}`}>
          <button
            className={`mic-button${listening ? ' is-live' : ''}${micSupported ? '' : ' is-unsupported'}`}
            type="button"
            onClick={onMicToggle}
            aria-pressed={listening}
            aria-label={listening ? 'Dừng nhận giọng nói' : 'Nói bằng micro'}
            title={
              micSupported
                ? listening
                  ? 'Dừng và gửi'
                  : 'Nói bằng tiếng Trung'
                : 'Trình duyệt chưa hỗ trợ micro — hãy dùng Chrome hoặc Edge'
            }
          >
            <MicIcon size={20} />
            {listening && <span className="mic-ping" aria-hidden="true" />}
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            readOnly={listening}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Hãy nói bằng tiếng Trung…' : 'Nhắn cho Tiểu Nhã bằng tiếng Trung…'}
            aria-label="Tin nhắn của bạn"
          />
          <button
            className="send-button"
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-label="Gửi tin nhắn"
          >
            <SendIcon size={19} />
          </button>
        </div>
        <div className="composer-hint">
          <span>Enter để gửi · Shift + Enter để xuống dòng</span>
          <span className="composer-voice-note">Giọng đọc: Edge TTS</span>
        </div>
      </footer>
    </section>
  );
}
