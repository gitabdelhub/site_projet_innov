import { useEffect, useState } from 'react';

// Training progress, stored per browser in localStorage
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
}

const KEY = 'chesshub-progress';
const EVENT = 'chesshub-progress-change';

const EMPTY: Progress = {
  solvedPuzzles: [],
  puzzleAttempts: 0,
  puzzleFirstTry: 0,
  streak: 0,
  bestStreak: 0,
  solvedPositions: [],
  positionAttempts: 0,
  positionCorrect: 0,
  gamesAnalyzed: 0,
};

export const loadProgress = (): Progress => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
};

export const updateProgress = (update: (p: Progress) => Progress) => {
  const next = update(loadProgress());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode): progress simply isn't persisted
  }
  window.dispatchEvent(new Event(EVENT));
  return next;
};

export const resetProgress = () => updateProgress(() => ({ ...EMPTY }));

export const useProgress = (): Progress => {
  const [progress, setProgress] = useState(loadProgress);
  useEffect(() => {
    const onChange = () => setProgress(loadProgress());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return progress;
};
