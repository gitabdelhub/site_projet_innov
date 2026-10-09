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
  // Adaptive coach (see adaptive.ts)
  puzzleRating: number; // the player's puzzle rating, updated like an Elo
  puzzleRated: number; // number of puzzles that counted for it
  puzzleHistory: number[]; // last ratings, for the progress curve
  themeStats: Record<string, { tries: number; wins: number }>; // puzzle results per theme
  mistakes: MistakeCard[]; // positions where the player went wrong in their games
  levelHistory: { at: number; elo: number }[]; // level estimates over time
  style: 'aggressive' | 'positional' | 'balanced' | null;
  aiRating: number; // strength against the computer, to pick its level
  aiGames: number;
  updatedAt: number; // ms, last change
  resetAt: number; // ms, last "reset my progress"
}

// A mistake from one of the player's games, turned into an exercise
export interface MistakeCard {
  id: string; // the position (FEN) where the mistake was made
  fen: string;
  played: string; // SAN of the move played in the game
  best: string; // SAN of the engine's move
  loss: number; // centipawns lost
  evalBefore: number; // engine score before the move, from the mover's side
  at: number; // when it was found
  box: number; // 0-4: how well it is known (spaced repetition)
  due: number; // when to show it again
}

const KEY = 'chesshub-progress';
export const PROGRESS_EVENT = 'chesshub-progress-change';

export const MAX_MISTAKES = 60;
export const MAX_HISTORY = 40;

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
  puzzleRating: 1000,
  puzzleRated: 0,
  puzzleHistory: [],
  themeStats: {},
  mistakes: [],
  levelHistory: [],
  style: null,
  aiRating: 700,
  aiGames: 0,
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

// Union of two lists of records by key; on a clash keep the one `prefer` picks
const unionBy = <T,>(a: T[], b: T[], key: (x: T) => string, prefer: (x: T, y: T) => T) => {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const k = key(x);
    const old = map.get(k);
    map.set(k, old ? prefer(old, x) : x);
  }
  return Array.from(map.values());
};

const mergeThemeStats = (a: Progress['themeStats'], b: Progress['themeStats']) => {
  const out: Progress['themeStats'] = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? { tries: 0, wins: 0 };
    const y = b[k] ?? { tries: 0, wins: 0 };
    out[k] = x.tries >= y.tries ? x : y;
  }
  return out;
};

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
    // Ratings: the copy that has seen the most games is the most up to date
    ...(x.puzzleRated >= y.puzzleRated
      ? { puzzleRating: x.puzzleRating, puzzleRated: x.puzzleRated, puzzleHistory: x.puzzleHistory }
      : { puzzleRating: y.puzzleRating, puzzleRated: y.puzzleRated, puzzleHistory: y.puzzleHistory }),
    ...(x.aiGames >= y.aiGames ? { aiRating: x.aiRating, aiGames: x.aiGames } : { aiRating: y.aiRating, aiGames: y.aiGames }),
    themeStats: mergeThemeStats(x.themeStats, y.themeStats),
    mistakes: unionBy(x.mistakes, y.mistakes, (m) => m.id, (m, n) => (n.due > m.due ? n : m))
      .sort((m, n) => n.at - m.at)
      .slice(0, MAX_MISTAKES),
    levelHistory: unionBy(x.levelHistory, y.levelHistory, (l) => String(l.at), (l) => l)
      .sort((l, m) => l.at - m.at)
      .slice(-MAX_HISTORY),
    style: newer.style ?? (newer === x ? y.style : x.style),
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
