import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTts } from './api';
import { speakBrowser } from './browserVoice';
import { speechText } from './coursePractice';
let stopCurrentCourseAudio: (() => void) | null = null;

export function stopLessonAudio() { stopCurrentCourseAudio?.(); }
export function useLessonAudio(voice: string, onBusy: (busy: boolean) => void) {
  const player = useRef<HTMLAudioElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const url = useRef('');
  const alive = useRef(true);
  const [playing, setPlaying] = useState(false);
  const loading = useRef(false);
  const finished = useRef<((success: boolean) => void) | undefined>(undefined);
  const finish = (ok: boolean) => { const done=finished.current;finished.current=undefined;done?.(ok); };
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const stop = useCallback(() => {
    finish(false);
    request.current?.abort();
    player.current?.pause();
    player.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    loading.current = false;
    setPlaying(false);
    onBusy(false);
    if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
  }, [onBusy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      finish(false);
      request.current?.abort();
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      if (stopCurrentCourseAudio === stop) stopCurrentCourseAudio = null;
      onBusy(false);
    };
  }, []);
  async function play(text: string, onStarted?: () => void, onFinished?: (success: boolean) => void) {
    if (loading.current) {
      stop();
      return;
    }
    stopCurrentCourseAudio?.();
    stopCurrentCourseAudio = stop;
    loading.current = true;
    finished.current = onFinished;
    const controller = new AbortController();
    request.current = controller;
    setPlaying(true);
    setError('');
    onBusy(true);
    try {
      const result = await fetchTts(speechText(text), voice, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (result.browserText) {
        setProvider('Giọng dự phòng trình duyệt; tuỳ giọng có thể dùng mạng.');
        await speakBrowser(result.browserText, result.browserLocale ?? 'zh-CN', controller.signal, onStarted, result.browserRate);
        if (alive.current && !controller.signal.aborted) {
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
        finish(true);
        return;
      }
      const bytes = Uint8Array.from(atob(result.audioBase64), (ch) => ch.charCodeAt(0));
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const audio = new Audio(url.current);
      player.current = audio;
      audio.onended = () => {
        finish(true);
        if (alive.current) {
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
      };
      audio.onerror = () => {
        finish(false);
        if (alive.current) {
          setError('Không phát được âm thanh. Hãy thử lại.');
          loading.current = false;
          setPlaying(false);
          onBusy(false);
        }
      };
      await audio.play();
      if (!alive.current || controller.signal.aborted) {
        audio.pause();
        return;
      }
      setProvider(result.fallbackReason ?? `Giọng ${result.provider}`);
      onStarted?.();
    } catch (e) {
      finish(false);
      if (alive.current && !controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Chưa phát được.');
        loading.current = false;
        setPlaying(false);
        onBusy(false);
      }
    }
  }
  return { play, stop, playing, error, provider };
}
