import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseBrowserVoice, voiceLocale } from './browserVoice.ts';
test('browser fallback never substitutes a non-Mandarin or wrong region voice', () => {
  const voices = [{ lang: 'en-US' }, { lang: 'zh-TW' }, { lang: 'zh_CN' }, { lang: 'vi-VN' }];
  assert.equal(chooseBrowserVoice(voices, 'zh-CN'), voices[2]);
  assert.equal(chooseBrowserVoice(voices.slice(0, 2), 'zh-CN'), undefined);
  assert.equal(voiceLocale('clone-vi'), 'vi-VN');
  assert.equal(voiceLocale('zh-CN-XiaoxiaoNeural'), 'zh-CN');
});

test('browser speech reports source, resolves at end and cancels on abort', async () => {
  const { speakBrowser } = await import('./browserVoice.ts');
  const oldWindow = globalThis.window;
  const oldUtterance = globalThis.SpeechSynthesisUtterance;
  let active: any;
  let reported = '';
  const synthesis = {
    getVoices: () => [{ lang: 'zh-CN', name: 'Synthetic browser fixture' }],
    speak: (utterance: any) => {
      active = utterance;
      queueMicrotask(() => utterance.onstart?.());
    },
    cancel: () => {},
  };
  try {
    globalThis.window = {
      speechSynthesis: synthesis,
      dispatchEvent: (event: any) => {
        reported = event.detail;
      },
    } as any;
    globalThis.SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    } as any;
    const done = speakBrowser('测试', 'zh-CN');
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(reported, /Synthetic browser fixture/);
    active.onend();
    await done;
    const abort = new AbortController();
    const pending = speakBrowser('测试', 'zh-CN', abort.signal);
    abort.abort();
    await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
  } finally {
    globalThis.window = oldWindow;
    globalThis.SpeechSynthesisUtterance = oldUtterance;
  }
});
