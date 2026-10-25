import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTts } from './api';
import { speakBrowser } from './browserVoice';
import { speechText } from './coursePractice';
let stopCurrentCourseAudio: (() => void) | null = null;
export function stopLessonAudio() {
  stopCurrentCourseAudio?.();
}
export function useLessonAudio(voice: string, onBusy: (busy: boolean) => void) {
  const player = useRef<HTMLAudioElement | null>(null),
    request = useRef<AbortController | null>(null),
    cleanup = useRef<() => void>(() => {}),
    alive = useRef(true),
    loading = useRef(false);
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState(''),
    [provider, setProvider] = useState('');
  const stop = useCallback(() => {
    request.current?.abort();
    cleanup.current();
    player.current = null;
    loading.current = false;
    setPlaying(false);
    onBusy(false);
    if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
  }, [onBusy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
      cleanup.current();
      if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
      onBusy(false);
    };
  }, []);
  async function play(text: string, onStarted?: () => void, onFinished?: (success: boolean) => void) {
    // Reject only the new request. The playing request keeps its own completion.
    if (loading.current) {
      onFinished?.(false);
      return;
    }
    stopCurrentCourseAudio?.();
    stopCurrentCourseAudio = stop;
    const controller = new AbortController();
    request.current = controller;
    let completed = false,
      objectUrl = '',
      audio: HTMLAudioElement | null = null;
    const current = () => alive.current && request.current === controller;
    const complete = (success: boolean) => {
      if (completed) return;
      completed = true;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
        audio.pause();
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }
      if (current()) {
        loading.current = false;
        setPlaying(false);
        onBusy(false);
      }
      onFinished?.(success);
    };
    cleanup.current = () => complete(false);
    loading.current = true;
    setPlaying(true);
    setError('');
    onBusy(true);
    try {
      const result = await fetchTts(speechText(text), voice, controller.signal);
      if (!current() || controller.signal.aborted) {
        complete(false);
        return;
      }
      if (result.browserText) {
        setProvider('Giọng dự phòng trình duyệt; tuỳ giọng có thể dùng mạng.');
        await speakBrowser(result.browserText, result.browserLocale ?? 'zh-CN', controller.signal, onStarted, result.browserRate);
        complete(!controller.signal.aborted);
        return;
      }
      const bytes = Uint8Array.from(atob(result.audioBase64), (ch) => ch.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      audio = new Audio(objectUrl);
      player.current = audio;
      audio.onended = () => complete(true);
      audio.onerror = () => {
        if (current()) setError('Không phát được âm thanh. Hãy thử lại.');
        complete(false);
      };
      audio.onabort = () => complete(false);
      await audio.play();
      if (!current() || controller.signal.aborted) {
        complete(false);
        return;
      }
      setProvider(result.fallbackReason ?? `Giọng ${result.provider}`);
      onStarted?.();
    } catch (e) {
      if (current() && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa phát được.');
      complete(false);
    }
  }
  return { play, stop, playing, error, provider };
}
