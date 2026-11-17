import { useEffect, useState } from 'react';
import { fetchWordNotes } from '../lib/api';
import type { Level, WordNotes } from '../types';
import { Han } from './LessonWidgets';

type Route = { provider: string; model: string };

// Remembered per word so flipping back and forth never calls the model again.
const notesCache = new Map<string, WordNotes>();
const pending = new Map<string, Promise<WordNotes>>();

interface WordNotesCardProps {
  word: string;
  pinyin: string;
  meaning: string;
  level: Level;
  route: Route | null;
  onSay: (text: string) => void;
}

/** AI-written notes for one word: where it comes from, how to remember it, how it is used. */
export function WordNotesCard({ word, pinyin, meaning, level, route, onSay }: WordNotesCardProps) {
  const [notes, setNotes] = useState<WordNotes | null>(() => notesCache.get(word) ?? null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() => (notesCache.has(word) ? 'ready' : 'loading'));
  const provider = route?.provider;
  const model = route?.model;

  useEffect(() => {
    if (!provider) return undefined;
    const cached = notesCache.get(word);
    if (cached) {
      setNotes(cached);
      setState('ready');
      return undefined;
    }
    let alive = true;
    setNotes(null);
    setState('loading');
    let request = pending.get(word);
    if (!request) {
      request = fetchWordNotes({ provider, model: model ?? '', word, pinyin, meaning, level });
      pending.set(word, request);
      const clear = () => pending.delete(word);
      request.then(clear, clear);
    }
    request.then(
      (result) => {
        notesCache.set(word, result);
        if (!alive) return;
        setNotes(result);
        setState('ready');
      },
      () => {
        if (alive) setState('failed');
      },
    );
    return () => {
      alive = false;
    };
    // the card is keyed by word; pinyin/meaning follow the word
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, provider, model]);

  if (!route || state === 'failed') return null;
  if (state === 'loading' || !notes) {
    return (
      <div className="wordnotes is-loading" aria-busy="true" aria-label="Đang soạn ghi chú từ">
        <span className="wordnotes-skel" />
        <span className="wordnotes-skel" />
        <span className="wordnotes-skel is-short" />
      </div>
    );
  }

  const parts = notes.parts.filter((p) => p.char && p.meaning);
  const examples = notes.examples.filter((e) => e.zh);
  return (
    <section className="wordnotes" aria-label={`Ghi chú về từ ${word}`}>
      {parts.length > 0 && (
        <div className="wordnotes-parts">
          {parts.map((part, i) => (
            <span key={i} className="wordnotes-part">
              <b>{part.char}</b> {part.meaning}
            </span>
          ))}
        </div>
      )}
      {notes.origin && (
        <p>
          <span className="wordnotes-label">Nguồn gốc</span>
          {notes.origin}
        </p>
      )}
      {notes.memoryTip && (
        <p>
          <span className="wordnotes-label">Mẹo nhớ</span>
          {notes.memoryTip}
        </p>
      )}
      {notes.usage && (
        <p>
          <span className="wordnotes-label">Cách dùng</span>
          {notes.usage}
        </p>
      )}
      {examples.map((example, i) => (
        <div key={i} className="wordnotes-example">
          <div className="wordnotes-example-zh">
            <Han text={example.zh} pinyinText={example.pinyin} />
            <button type="button" className="lesson-link" aria-label={`Nghe câu: ${example.zh}`} onClick={() => onSay(example.zh)}>
              Nghe
            </button>
          </div>
          <p className="lesson-hint">{example.vi}</p>
        </div>
      ))}
      <small className="wordnotes-badge">AI soạn · chưa duyệt</small>
    </section>
  );
}
