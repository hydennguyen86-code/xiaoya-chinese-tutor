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
