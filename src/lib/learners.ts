import type { Level } from '../types';
import { CHAT_KEY, PROGRESS_KEY, scopedKey } from './storage';
import { LEARNING_KEY } from './learning';

export interface Learner {
  id: string;
  name: string;
  level: Level;
  createdAt: number;
}

interface Registry {
  learners: Learner[];
  activeId: string;
}

const REGISTRY_KEY = 'xiaoya.learners.v2';
const LEVELS = new Set<Level>(['HSK1-2', 'HSK3-4', 'HSK5-6', 'free']);
const NAME_MAX = 30;

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function readRegistry(): Registry {
  try {
    const parsed = JSON.parse(localStorage.getItem(REGISTRY_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.learners)) {
      return { learners: [], activeId: '' };
    }
    const learners: Learner[] = parsed.learners
      .filter(
        (item: unknown): item is Learner =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as Learner).id === 'string' &&
          typeof (item as Learner).name === 'string',
      )
      .map((item: Learner) => ({
        id: item.id,
        name: item.name.trim().slice(0, NAME_MAX) || 'Học viên',
        level: LEVELS.has(item.level) ? item.level : 'HSK5-6',
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      }));
    return {
      learners,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : '',
    };
  } catch {
    return { learners: [], activeId: '' };
  }
}

function writeRegistry(registry: Registry) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // storage can be unavailable in private windows
  }
}

export function loadLearners(): Learner[] {
  return readRegistry().learners;
}

export function loadActiveLearnerId(): string {
  const registry = readRegistry();
  return registry.learners.some((item) => item.id === registry.activeId)
    ? registry.activeId
    : '';
}

export function setActiveLearner(id: string) {
  const registry = readRegistry();
  writeRegistry({ ...registry, activeId: id });
}

// The data that existed before profiles were introduced belongs to whoever uses
// the app first, so the first learner created inherits it (copied, not moved).
function inheritLegacyData(id: string) {
  const legacyKeys = [CHAT_KEY, PROGRESS_KEY, LEARNING_KEY];
  for (const base of legacyKeys) {
    try {
      const value = localStorage.getItem(base);
      if (value !== null && localStorage.getItem(scopedKey(base, id)) === null) {
        localStorage.setItem(scopedKey(base, id), value);
      }
    } catch {
      // ignore
    }
  }
}

export function createLearner(name: string, level: Level): Learner {
  const registry = readRegistry();
  const learner: Learner = {
    id: newId(),
    name: name.trim().slice(0, NAME_MAX) || 'Học viên',
    level: LEVELS.has(level) ? level : 'HSK5-6',
    createdAt: Date.now(),
  };
  if (registry.learners.length === 0) inheritLegacyData(learner.id);
  writeRegistry({
    learners: [...registry.learners, learner],
    activeId: learner.id,
  });
  return learner;
}

export function updateLearnerLevel(id: string, level: Level) {
  const registry = readRegistry();
  const learners = registry.learners.map((item) =>
    item.id === id && item.level !== level ? { ...item, level } : item,
  );
  writeRegistry({ ...registry, learners });
}
