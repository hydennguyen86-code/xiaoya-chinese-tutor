import { useEffect, useState } from 'react';
import { fetchWordNotes } from '../lib/api';
import type { Level, WordNotes } from '../types';
import { Han } from './LessonWidgets';

type Route = { provider: string; model: string };

// Remembered per word so flipping back and forth never calls the model again.
const notesCache = new Map<string, WordNotes>();
const pending = new Map<string, Promise<WordNotes>>();

interface NotesRequest {
  word: string;
  pinyin: string;
  meaning: string;
}

/** One request per word at a time; the server also caches, so a word is written once. */
function loadNotes(item: NotesRequest, route: Route, level: Level): Promise<WordNotes> {
  const cached = notesCache.get(item.word);
  if (cached) return Promise.resolve(cached);
  let request = pending.get(item.word);
  if (!request) {
    request = fetchWordNotes({ provider: route.provider, model: route.model, ...item, level }).then((result) => {
      notesCache.set(item.word, result);
      return result;
    });
    pending.set(item.word, request);
    const clear = () => pending.delete(item.word);
    request.then(clear, clear);
  }
  return request;
}

/**
 * Writes the notes of every word of a lesson one after another in the background,
 * so the next card is usually ready by the time the learner flips to it.
 */
export async function prefetchWordNotes(items: NotesRequest[], route: Route | null, level: Level, signal?: AbortSignal) {
  if (!route) return;
  for (const item of items) {
    if (signal?.aborted) return;
    try {
      await loadNotes(item, route, level);
    } catch {
      // one failed word does not stop the rest; its card simply shows no notes
    }
  }
}

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
    const request = loadNotes({ word, pinyin, meaning }, { provider, model: model ?? '' }, level);
    request.then(
      (result) => {
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
