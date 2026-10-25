import { HanViet } from './HanViet';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToneFeedback } from './ToneFeedback';
import { SetupCheck } from './SetupCheck';
import { CoursePractice } from './CoursePractice';
import { DEFAULT_SETTINGS } from '../lib/storage';
import fs from 'node:fs';
test('tone feedback never marks unclear syllables correct and disables replay without recording', () => {
  const html = renderToStaticMarkup(
    <ToneFeedback
      report={{
        mode: 'word',
        checked: 0,
        correct: 0,
        syllables: [{ char: '马', pinyin: 'mǎ', expected: 3, heard: 0, ok: null }],
        segments: [{ char: '马', start: 0, end: 0.2 }],
      }}
    />,
  );
  assert.match(html, /is-unclear/);
  assert.doesNotMatch(html, /is-ok/);
  assert.match(html, /disabled/);
});
test('setup screen does not claim successful microphone or system checks before they run', () => {
  const html = renderToStaticMarkup(
    <SetupCheck settings={DEFAULT_SETTINGS} onChange={() => {}} onClose={() => {}} onStart={() => {}} onStatus={() => {}} />,
  );
  assert.match(html, /Chưa thử/);
  assert.doesNotMatch(html, /Đã phát giọng thử/);
});
test('listening course initially conceals transcript and answer key', () => {
  const content = JSON.parse(fs.readFileSync(new URL('../../lessons/courses/hsk1-practical-1-d1.json', import.meta.url), 'utf8'));
  const html = renderToStaticMarkup(
    <CoursePractice
      content={content}
      learnerId="fixture"
      voice="fixture"
      ask={async () => ''}
      micReady={false}
      voicePhase={null}
      onBusy={() => {}}
    />,
  );
  assert.ok(!html.includes(content.listening.transcript));
  assert.match(html, /Nộp bài nghe/);
});

test('listen-first role-play hides both Chinese and translation by default', async () => {
  const { ListenFirstLine } = await import('./ListeningControls');
  const html = renderToStaticMarkup(<ListenFirstLine text="秘密句子" translation="Bản dịch fixture" onPlay={() => {}} />);
  assert.ok(!html.includes('秘密句子'));
  assert.ok(!html.includes('Bản dịch fixture'));
  assert.match(html, /Hiện chữ và nghĩa/);
  assert.match(html, /Nghe chậm/);
});

test('Unihan character readings are not mislabeled as authoritative Sino-Vietnamese word readings', () => {
  const html = renderToStaticMarkup(<HanViet word="你好" />);
  assert.match(html, /Âm Việt theo chữ/);
  assert.doesNotMatch(html, /Âm Hán Việt:/);
  const memory = renderToStaticMarkup(<HanViet word="学" />);
  assert.match(memory, /AI soạn, chưa duyệt/);
  assert.match(memory, /học/);
});
