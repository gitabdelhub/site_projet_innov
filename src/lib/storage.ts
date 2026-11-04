/**
 * Local progress, saved in the browser (localStorage). Works without any server.
 * Every access is wrapped in try/catch: private mode or blocked storage must
 * never break the site.
 */
import { useSyncExternalStore } from 'react';
import type { Color, EndReason, GameResult } from './chessGame';

const KEY = 'chesshub.progress.v1';

export interface SavedGame {
  id: string;
  date: string; // ISO
  pgn: string;
  playerColor: Color;
  result: GameResult;
  reason: EndReason;
  engineLevel: number;
  engineElo: number;
  moves: number;
  predictedElo?: number;
  accuracy?: number;
}

export interface EloPrediction {
  date: string;
  elo: number;
  source: 'game' | 'pgn';
  method: string;
}

export interface PuzzleAttempt {
  id: string;
  rating: number;
  solved: boolean;
  date: string;
  themes: string[];
}

export interface Progress {
  games: SavedGame[];
  predictions: EloPrediction[];
  puzzles: PuzzleAttempt[];
  puzzleRating: number;
}

const EMPTY: Progress = { games: [], predictions: [], puzzles: [], puzzleRating: 0 };

export const safeGet = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};

export const safeGetRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSet = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
};

export const safeRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

let cache: Progress = safeGet(KEY, EMPTY);
const listeners = new Set<() => void>();

export const getProgress = () => cache;

export const updateProgress = (fn: (p: Progress) => Progress) => {
  cache = fn(cache);
  safeSet(KEY, cache);
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useProgress = () => useSyncExternalStore(subscribe, getProgress, getProgress);

export const saveGame = (g: SavedGame) =>
  updateProgress((p) => ({ ...p, games: [g, ...p.games.filter((x) => x.id !== g.id)].slice(0, 50) }));

export const patchGame = (id: string, patch: Partial<SavedGame>) =>
  updateProgress((p) => ({ ...p, games: p.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));

export const addPrediction = (e: EloPrediction) =>
  updateProgress((p) => ({ ...p, predictions: [e, ...p.predictions].slice(0, 50) }));

/** Last predicted Elo, or null if the player has never been evaluated. */
export const latestElo = (p: Progress): number | null => p.predictions[0]?.elo ?? null;

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
