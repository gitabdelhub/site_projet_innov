import { useEffect, useState } from 'react';

// Training progress. Kept in the browser (works offline and without an account)
// and, when signed in, synchronised with the account (see progressSync.ts).
export interface Progress {
  solvedPuzzles: string[];
  puzzleAttempts: number;
  puzzleFirstTry: number;
  streak: number;
  bestStreak: number;
  solvedPositions: number[];
  positionAttempts: number;
  positionCorrect: number;
  gamesAnalyzed: number;
  lessonsDone: string[]; // ids of finished beginner lessons
  updatedAt: number; // ms, last change
  resetAt: number; // ms, last "reset my progress"
}

const KEY = 'chesshub-progress';
export const PROGRESS_EVENT = 'chesshub-progress-change';

export const EMPTY_PROGRESS: Progress = {
  solvedPuzzles: [],
  puzzleAttempts: 0,
  puzzleFirstTry: 0,
  streak: 0,
  bestStreak: 0,
  solvedPositions: [],
  positionAttempts: 0,
  positionCorrect: 0,
  gamesAnalyzed: 0,
  lessonsDone: [],
  updatedAt: 0,
  resetAt: 0,
};

// Used when the browser blocks storage (private mode), so progress still works during the visit
let memory: Progress | null = null;

export const loadProgress = (): Progress => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY_PROGRESS, ...JSON.parse(raw) };
  } catch {
    // fall through to the in-memory copy
  }
  return memory ? { ...memory } : { ...EMPTY_PROGRESS };
};

// Replace the stored progress as is (used by the account sync)
export const saveProgress = (next: Progress, notify = true) => {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the in-memory copy is used
  }
  if (notify) window.dispatchEvent(new Event(PROGRESS_EVENT));
};

export const updateProgress = (update: (p: Progress) => Progress) => {
  const next = { ...update(loadProgress()), updatedAt: Date.now() };
  saveProgress(next);
  return next;
};

export const resetProgress = () => {
  const now = Date.now();
  saveProgress({ ...EMPTY_PROGRESS, updatedAt: now, resetAt: now });
};

const union = <T,>(a: T[], b: T[]) => Array.from(new Set([...a, ...b]));

// Combine two copies of the progress (this browser and the account) without losing anything.
// A reset on either side wipes whatever the other side recorded before that reset.
export const mergeProgress = (a: Progress, b: Progress): Progress => {
  const resetAt = Math.max(a.resetAt, b.resetAt);
  const keep = (p: Progress) => (p.updatedAt >= resetAt ? p : { ...EMPTY_PROGRESS, updatedAt: p.updatedAt });
  const x = keep(a);
  const y = keep(b);
  const newer = x.updatedAt >= y.updatedAt ? x : y;
  return {
    solvedPuzzles: union(x.solvedPuzzles, y.solvedPuzzles),
    solvedPositions: union(x.solvedPositions, y.solvedPositions),
    lessonsDone: union(x.lessonsDone, y.lessonsDone),
    puzzleAttempts: Math.max(x.puzzleAttempts, y.puzzleAttempts),
    puzzleFirstTry: Math.max(x.puzzleFirstTry, y.puzzleFirstTry),
    positionAttempts: Math.max(x.positionAttempts, y.positionAttempts),
    positionCorrect: Math.max(x.positionCorrect, y.positionCorrect),
    gamesAnalyzed: Math.max(x.gamesAnalyzed, y.gamesAnalyzed),
    bestStreak: Math.max(x.bestStreak, y.bestStreak),
    streak: newer.streak,
    updatedAt: Math.max(x.updatedAt, y.updatedAt),
    resetAt,
  };
};

export const useProgress = (): Progress => {
  const [progress, setProgress] = useState(loadProgress);
  useEffect(() => {
    const onChange = () => setProgress(loadProgress());
    window.addEventListener(PROGRESS_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return progress;
};
