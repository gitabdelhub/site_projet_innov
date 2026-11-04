import type { SearchOptions } from './engine';

/**
 * Engine levels for the "play vs computer" mode.
 *
 * Below 1320 Stockfish cannot limit its own Elo, so the weak levels combine a
 * low "Skill Level", a shallow depth and a share of random legal moves. The Elo
 * values are approximate targets, shown as "~" in the interface.
 */
export interface EngineLevel {
  id: number;
  elo: number;
  search: SearchOptions;
  /** Probability (0..1) of playing a random legal move instead of the engine move. */
  randomMove: number;
  /** Minimum delay (ms) before the engine plays, so moves do not appear instantly. */
  minDelay: number;
}

export const ENGINE_LEVELS: EngineLevel[] = [
  { id: 1, elo: 400, search: { skill: 0, depth: 1 }, randomMove: 0.35, minDelay: 500 },
  { id: 2, elo: 600, search: { skill: 0, depth: 2 }, randomMove: 0.2, minDelay: 500 },
  { id: 3, elo: 800, search: { skill: 1, depth: 3 }, randomMove: 0.1, minDelay: 500 },
  { id: 4, elo: 1000, search: { skill: 3, depth: 4 }, randomMove: 0.04, minDelay: 500 },
  { id: 5, elo: 1200, search: { skill: 6, depth: 6 }, randomMove: 0, minDelay: 400 },
  { id: 6, elo: 1400, search: { elo: 1400, movetime: 300 }, randomMove: 0, minDelay: 300 },
  { id: 7, elo: 1700, search: { elo: 1700, movetime: 500 }, randomMove: 0, minDelay: 200 },
  { id: 8, elo: 2000, search: { elo: 2000, movetime: 700 }, randomMove: 0, minDelay: 100 },
  { id: 9, elo: 2400, search: { elo: 2400, movetime: 1000 }, randomMove: 0, minDelay: 0 },
];

export const getLevel = (id: number): EngineLevel =>
  ENGINE_LEVELS.find((l) => l.id === id) ?? ENGINE_LEVELS[3];

/** Picks the engine level closest to a given Elo (used after a prediction). */
export const levelForElo = (elo: number): EngineLevel =>
  ENGINE_LEVELS.reduce((best, l) => (Math.abs(l.elo - elo) < Math.abs(best.elo - elo) ? l : best));
