export function voiceLocale(voice: string) {
  return voice.startsWith('vi-') || voice === 'clone-vi' ? 'vi-VN' : 'zh-CN';
}
export function chooseBrowserVoice<T extends { lang: string }>(voices: T[], locale: string) {
  const normalize = (lang: string) => lang.replace('_', '-').toLowerCase();
  return voices.find((voice) => normalize(voice.lang) === normalize(locale));
}
let voiceRun = 0;
let cancelActive: (() => void) | null = null;
export function stopBrowserVoice() {
  voiceRun += 1;
  cancelActive?.();
}
export async function speakBrowser(text: string, locale: string, signal?: AbortSignal, onStarted?: () => void) {
  if (!('speechSynthesis' in window)) throw new Error('Trình duyệt chưa hỗ trợ giọng dự phòng.');
  if (signal?.aborted) throw new DOMException('Đã dừng', 'AbortError');
  stopBrowserVoice();
  const run = voiceRun;
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (!voices.length) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        synth.removeEventListener('voiceschanged', done);
        resolve();
      };
      const timer = setTimeout(done, 1200);
      synth.addEventListener('voiceschanged', done);
    });
    voices = synth.getVoices();
  }
  if (run !== voiceRun || signal?.aborted) throw new DOMException('Đã dừng', 'AbortError');
  const voice = chooseBrowserVoice(voices, locale);
  if (!voice) throw new Error(`Máy chưa cài giọng ${locale}. Thêm giọng trong cài đặt ngôn ngữ của hệ điều hành rồi mở lại trình duyệt.`);
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = locale;
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (cancelActive === cancel) cancelActive = null;
    };
    const cancel = () => {
      cleanup();
      synth.cancel();
      reject(new DOMException('Đã dừng', 'AbortError'));
    };
    timer = setTimeout(() => {
      cleanup();
      synth.cancel();
      reject(new Error('Trình duyệt chưa bắt đầu đọc. Bấm Nghe để thử lại và kiểm tra giọng đã cài.'));
    }, 10000);
    cancelActive = cancel;
    signal?.addEventListener('abort', cancel, { once: true });
    utterance.onstart = () => {
      if (settled) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        cleanup();
        synth.cancel();
        reject(new Error('Giọng trình duyệt quá thời gian chờ.'));
      }, 240000);
      window.dispatchEvent(
        new CustomEvent('misu:voice-source', {
          detail: `Giọng dự phòng trình duyệt: ${voice.name} (${locale}). Có thể dùng mạng tuỳ giọng; không có khẩu hình khớp audio.`,
        }),
      );
      onStarted?.();
    };
    utterance.onend = () => {
      cleanup();
      resolve();
    };
    utterance.onerror = () => {
      cleanup();
      reject(new Error('Giọng trình duyệt không phát được. Hãy thử lại bằng nút Nghe.'));
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    try {
      synth.speak(utterance);
    } catch {
      cleanup();
      reject(new Error('Không khởi động được giọng trình duyệt.'));
    }
  });
}
