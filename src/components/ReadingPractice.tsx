import { useMemo, useState } from 'react';
import readings from '../../lessons/reading/hsk1.json' with { type: 'json' };
import { useLessonAudio } from '../lib/useLessonAudio';
import { pinyinWord } from '../lib/coursePinyin.mjs';
import { hanVietText } from '../lib/hanviet';

// Graded reading for beginners: short passages built only from words the HSK 1
// course teaches. Tap a word for pinyin, Hán Việt and meaning; tap the speaker
// to hear a sentence; one comprehension question at the end. Reading is input,
// so nothing here is scored or saved.

interface Sentence {
  hanzi: string;
  vi: string;
}
interface Passage {
  id: string;
  title: string;
  titleVi: string;
  sentences: Sentence[];
  question: { hanzi: string; vi: string; options: string[]; answer: number };
  glossary: Record<string, { pinyin: string; meaning: string }>;
}

const DATA = readings as unknown as { source: string; level: string; passages: Passage[] };
const HAN = /\p{Script=Han}/u;

/** split a sentence into glossary words where possible, single characters otherwise */
export function tokenize(text: string, glossary: Record<string, unknown>) {
  const words = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const out: { text: string; han: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!HAN.test(ch)) {
      out.push({ text: ch, han: false });
      i += 1;
      continue;
    }
    const hit = words.find((w) => text.startsWith(w, i));
    out.push({ text: hit || ch, han: true });
    i += (hit || ch).length;
  }
  return out;
}

export function ReadingPractice({ level, voice, onBusy }: { level: string; voice: string; onBusy: (busy: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showVi, setShowVi] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const audio = useLessonAudio(voice, onBusy);
  const passage = DATA.passages[index % DATA.passages.length];
  const sentences = useMemo(() => passage.sentences.map((s) => ({ ...s, tokens: tokenize(s.hanzi, passage.glossary) })), [passage]);
  if (!level.startsWith('HSK1')) return null;
  const gloss = picked ? passage.glossary[picked] : null;
  const go = (next: number) => {
    setIndex(((next % DATA.passages.length) + DATA.passages.length) % DATA.passages.length);
    setPicked(null);
    setShowVi(false);
    setAnswer(null);
  };
  return (
    <section className="reading-practice">
      <h4>
        📖 Đọc theo bậc · {passage.title} <small>({passage.titleVi})</small>
      </h4>
      <p className="lesson-hint">
        Bài {index + 1}/{DATA.passages.length}, chỉ dùng từ trong lộ trình HSK 1. Chạm vào chữ để xem pinyin và nghĩa; bấm 🔊 để nghe cả
        câu. {DATA.source}.
      </p>
      <div className="reading-body">
        {sentences.map((s, si) => (
          <p key={si} className="reading-sentence">
            <button
              type="button"
              className="reading-speak"
              aria-label="Nghe câu này"
              disabled={audio.playing}
              onClick={() => void audio.play(s.hanzi)}
            >
              🔊
            </button>
            {s.tokens.map((t, ti) =>
              t.han ? (
                <button
                  key={ti}
                  type="button"
                  className={`reading-word${picked === t.text ? ' is-picked' : ''}${passage.glossary[t.text] ? '' : ' is-plain'}`}
                  onClick={() => setPicked(picked === t.text ? null : t.text)}
                >
                  {t.text}
                </button>
              ) : (
                <span key={ti}>{t.text}</span>
              ),
            )}
            {showVi && <span className="reading-vi">{s.vi}</span>}
          </p>
        ))}
      </div>
      {picked && (
        <div className="reading-gloss" role="status">
          <strong>{picked}</strong> · {gloss?.pinyin || pinyinWord(picked)}
          {hanVietText(picked) ? ` · Hán Việt: ${hanVietText(picked)}` : ''}
          {gloss ? ` · ${gloss.meaning}` : ' · (chữ này chưa có nghĩa riêng trong bài)'}
          <button type="button" onClick={() => void audio.play(picked)} disabled={audio.playing}>
            🔊
          </button>
        </div>
      )}
      <div className="reading-question">
        <p>
          <strong>{passage.question.hanzi}</strong> <small>{passage.question.vi}</small>
        </p>
        <div className="reading-options">
          {passage.question.options.map((option, oi) => (
            <button
              key={oi}
              type="button"
              className={answer === null ? '' : oi === passage.question.answer ? 'is-right' : oi === answer ? 'is-wrong' : ''}
              onClick={() => setAnswer(oi)}
              disabled={answer !== null}
            >
              {option}
            </button>
          ))}
        </div>
        {answer !== null && (
          <p className="lesson-hint">
            {answer === passage.question.answer
              ? 'Đúng rồi! Đọc hiểu tốt.'
              : `Chưa đúng: đáp án là “${passage.question.options[passage.question.answer]}”. Đọc lại câu có từ này nhé.`}
          </p>
        )}
      </div>
      <div className="lesson-actions">
        <button type="button" className="lesson-secondary" onClick={() => setShowVi((v) => !v)}>
          {showVi ? 'Ẩn tiếng Việt' : 'Hiện tiếng Việt'}
        </button>
        <button type="button" className="lesson-secondary" onClick={() => go(index - 1)}>
          ← Bài trước
        </button>
        <button type="button" className="lesson-secondary" onClick={() => go(index + 1)}>
          Bài sau →
        </button>
      </div>
    </section>
  );
}
