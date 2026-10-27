import { HanViet } from './HanViet';
import { VocabReadFeedback } from './DailyLesson';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToneFeedback } from './ToneFeedback';
import { SetupCheck } from './SetupCheck';
import { CoursePractice } from './CoursePractice';
import { LearnerPicker } from './LearnerPicker';
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

test('AI-authored Sino-Vietnamese readings are labeled as drafts and Unihan is a fallback', () => {
  const html = renderToStaticMarkup(<HanViet word="你好" />);
  assert.match(html, /AI soạn, chưa duyệt/);
  assert.match(html, /nhĩ hảo/);
  assert.doesNotMatch(html, /Unihan dự phòng/);
  const fallback = renderToStaticMarkup(<HanViet word="學" />);
  assert.match(fallback, /Unihan dự phòng/);
  assert.doesNotMatch(fallback, /chưa có dữ liệu/);
  const memory = renderToStaticMarkup(<HanViet word="学" />);
  assert.match(memory, /AI soạn, chưa duyệt/);
  assert.match(memory, /học/);
  assert.equal(renderToStaticMarkup(<HanViet word={String.fromCodePoint(0x323af)} />), '');
});

test('course practice exposes lesson-linked dictation and shadowing, with global fallback', () => {
  const content = JSON.parse(fs.readFileSync(new URL('../../lessons/courses/hsk1-practical-1-d1.json', import.meta.url), 'utf8'));
  const linked = JSON.parse(fs.readFileSync(new URL('../../lessons/listening/course/hsk1-practical-1-d1.json', import.meta.url), 'utf8'));
  const render = (value: typeof content) =>
    renderToStaticMarkup(
      <CoursePractice
        content={value}
        learnerId="fixture"
        voice="fixture"
        ask={async () => ''}
        micReady={false}
        voicePhase={null}
        onBusy={() => {}}
      />,
    );
  assert.match(render({ ...content, listeningPractice: linked }), /Nghe của bài/);
  assert.ok(render({ ...content, listeningPractice: linked }).includes(linked.shadowing[0].text));
  assert.doesNotMatch(render(content), /Nghe của bài/);
  assert.match(render(content), /Bộ DeepSeek/);
});

test('missing fluency explains transcript, audio and decoding failures separately', () => {
  for (const [reason, expected] of [
    ['empty-transcript', 'chưa nhận được lời nói'],
    ['insufficient-speech', 'âm thanh không đủ tiếng nói'],
    ['decode-failed', 'không giải mã được audio'],
  ]) {
    const html = renderToStaticMarkup(<ToneFeedback report={{ syllables: [], checked: 0, correct: 0, fluencyReason: reason }} />);
    assert.ok(html.includes(expected));
  }
});

test('a new learner is offered the opposite-gender teacher', () => {
  const html = renderToStaticMarkup(<LearnerPicker learners={[]} onPick={() => {}} onCreate={() => {}} />);
  const group = html.match(/aria-label="Giới tính của bạn"[\s\S]*?(?=<button class="learner-submit)/);
  assert.ok(group, 'gender radiogroup is missing');
  assert.match(group[0], /Bạn là Nữ[\s\S]*Giáo viên: Misu · 米苏/);
  assert.match(group[0], /Bạn là Nam[\s\S]*Giáo viên: Tiểu Nhã · 小雅/);
});

test('vocabulary card accepts a recognised ma homophone only for the neutral syllable', () => {
  const render = (word: string, pinyin: string, target: string, text: string) =>
    renderToStaticMarkup(<VocabReadFeedback word={{ word, pinyin }} target={target} text={text} />);
  for (const recognised of ['妈', '马', '骂']) {
    const html = render('吗', 'ma', '吗', recognised);
    assert.match(html, /lesson-ok/);
    assert.match(html, /tạm chấp nhận/);
    assert.match(html, /chưa xác nhận được thanh nhẹ/);
  }
  assert.match(render('吗', 'ma', '吗', '吗'), /chưa được chấm/);
  assert.match(render('吗', 'ma', '吗', '猫'), /lesson-bad/);
  assert.match(render('妈', 'mā', '妈', '马'), /lesson-bad/);
  assert.match(render('吗', 'ma', '这是你的猫吗', '妈'), /lesson-bad/);
  assert.equal(render('吗', 'ma', '吗', ''), '');
});

test('neutral-tone feedback does not ask the learner to prolong the syllable', () => {
  const html = renderToStaticMarkup(
    <ToneFeedback
      neutralTone
      report={{ mode: 'word', checked: 0, correct: 0, syllables: [{ char: '吗', pinyin: 'ma', expected: 0, heard: 0, ok: null }] }}
    />,
  );
  assert.match(html, /Thanh nhẹ chưa được máy chấm/);
  assert.doesNotMatch(html, /kéo dài từng chữ/);
  const note = 'Mình chưa quen giọng bạn: nói thêm vài câu để mình phân biệt thanh 1 và thanh 3 chính xác hơn.';
  const renderNote = (message: string) =>
    renderToStaticMarkup(
      <ToneFeedback
        neutralTone
        report={{
          mode: 'word',
          checked: 0,
          correct: 0,
          syllables: [{ char: '吗', pinyin: 'ma', expected: 0, heard: 0, ok: null }],
          note: message,
        }}
      />,
    );
  assert.doesNotMatch(renderNote(note), /phân biệt thanh 1 và thanh 3/);
  assert.match(renderNote('Không nghe rõ giọng.'), /Không nghe rõ giọng/);
});
