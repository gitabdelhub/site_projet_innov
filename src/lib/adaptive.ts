import { Chess } from 'chess.js';
import { PUZZLES, THEMES, type Puzzle, type ThemeId } from '../data/puzzles';
import { MAX_HISTORY, MAX_MISTAKES, type MistakeCard, type Progress } from './progress';
import type { AnalyzedMove } from './analysis';

// The adaptive coach: everything that turns the player's results into the next exercise.
// Pure functions on the progress, so they are easy to test and to explain.

// ---------- Ratings (classic Elo formula) ----------

export const expectedScore = (rating: number, opponent: number) => 1 / (1 + Math.pow(10, (opponent - rating) / 400));

// Big steps while we know little about the player, smaller ones afterwards
const kFactor = (games: number) => (games < 10 ? 60 : games < 30 ? 32 : 20);

export const updateRating = (rating: number, games: number, opponent: number, score: number) =>
  Math.round(rating + kFactor(games) * (score - expectedScore(rating, opponent)));

// Hand-made puzzles have no Lichess rating: use their theme's difficulty
const LEVEL_RATING = { beginner: 900, intermediate: 1350, advanced: 1750 } as const;
export const puzzleDifficulty = (p: Puzzle) => p.rating ?? LEVEL_RATING[THEMES.find((t) => t.id === p.theme)!.difficulty];

// Record one puzzle result (1 = solved at the first try, 0 = failed or solution shown)
export const recordPuzzle = (p: Progress, puzzle: Puzzle, score: 0 | 1): Progress => {
  const puzzleRating = updateRating(p.puzzleRating, p.puzzleRated, puzzleDifficulty(puzzle), score);
  const stat = p.themeStats[puzzle.theme] ?? { tries: 0, wins: 0 };
  return {
    ...p,
    puzzleRating,
    puzzleRated: p.puzzleRated + 1,
    puzzleHistory: [...p.puzzleHistory, puzzleRating].slice(-MAX_HISTORY),
    themeStats: { ...p.themeStats, [puzzle.theme]: { tries: stat.tries + 1, wins: stat.wins + score } },
  };
};

// ---------- Weak points ----------

const MIN_TRIES = 3;

// Success rate with a small prior, so 1 failure out of 1 does not look like 0 %
const successRate = (s: { tries: number; wins: number }) => (s.wins + 1) / (s.tries + 2);

export interface ThemeScore {
  theme: ThemeId;
  tries: number;
  rate: number; // 0-1
}

// The themes where the player fails most (only themes with enough attempts)
export const weakThemes = (p: Progress, count = 3): ThemeScore[] =>
  THEMES.map((t) => ({ theme: t.id, stat: p.themeStats[t.id] ?? { tries: 0, wins: 0 } }))
    .filter(({ stat }) => stat.tries >= MIN_TRIES)
    .map(({ theme, stat }) => ({ theme, tries: stat.tries, rate: successRate(stat) }))
    .sort((a, b) => a.rate - b.rate)
    .filter((s) => s.rate < 0.6) // above 60 % it is not a weak point
    .slice(0, count);

// ---------- Personalised puzzles ----------

// Next puzzle for this player: close to their rating, often on a weak theme, not solved yet.
// `random` is injectable so the tests are repeatable.
export const pickPuzzle = (p: Progress, exclude: string[] = [], random = Math.random): Puzzle => {
  const weak = new Set(weakThemes(p).map((w) => w.theme));
  const fresh = PUZZLES.filter((q) => !exclude.includes(q.id));
  const unsolved = fresh.filter((q) => !p.solvedPuzzles.includes(q.id));
  const pool = unsolved.length ? unsolved : fresh.length ? fresh : PUZZLES;
  const target = p.puzzleRating + 50; // a little above the current level: that is where we learn
  for (const width of [150, 300, 600, 5000]) {
    const near = pool.filter((q) => Math.abs(puzzleDifficulty(q) - target) <= width);
    if (!near.length) continue;
    const onWeak = near.filter((q) => weak.has(q.theme));
    const from = onWeak.length && random() < 0.6 ? onWeak : near;
    return from[Math.floor(random() * from.length)];
  }
  return pool[0];
};

// ---------- Mistakes from the player's own games ----------

const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 1, 3, 7, 21].map((d) => d * DAY); // per box: review again after…

const uciToSan = (fen: string, uci: string) => {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
};

// Turn the mistakes and blunders of an analysed game into review cards
export const mistakesFromGame = (
  fens: string[], // position before each move
  moves: AnalyzedMove[],
  best: (string | null)[], // engine move (UCI) in each position
  side: 'w' | 'b',
  now = Date.now()
): MistakeCard[] =>
  moves.flatMap((m, i) => {
    if (m.color !== side || (m.category !== 'mistake' && m.category !== 'blunder') || !best[i]) return [];
    const bestSan = uciToSan(fens[i], best[i]!);
    if (!bestSan || bestSan === m.san) return [];
    const evalBefore = side === 'w' ? m.evalBefore : -m.evalBefore;
    // A position already lost or won by miles teaches little
    if (Math.abs(evalBefore) > 800) return [];
    return [{ id: fens[i], fen: fens[i], played: m.san, best: bestSan, loss: m.loss, evalBefore, at: now, box: 0, due: now }];
  });

export const addMistakes = (p: Progress, cards: MistakeCard[]): Progress => {
  const known = new Set(p.mistakes.map((m) => m.id));
  const fresh = cards.filter((c) => !known.has(c.id));
  if (!fresh.length) return p;
  return { ...p, mistakes: [...fresh, ...p.mistakes].slice(0, MAX_MISTAKES) };
};

export const dueMistakes = (p: Progress, now = Date.now()) =>
  p.mistakes.filter((m) => m.due <= now).sort((a, b) => a.box - b.box || b.loss - a.loss);

// Found the right idea: wait longer before the next review. Missed: back to the start.
export const reviewMistake = (p: Progress, id: string, solved: boolean, now = Date.now()): Progress => ({
  ...p,
  mistakes: p.mistakes.map((m) => {
    if (m.id !== id) return m;
    const box = solved ? Math.min(m.box + 1, INTERVALS.length - 1) : 0;
    return { ...m, box, due: now + (solved ? INTERVALS[box] : 10 * 60 * 1000) };
  }),
});

// A move is good enough if it keeps (almost) all of what the best move kept
export const ACCEPT_MARGIN = 80;
export const isGoodEnough = (evalBefore: number, evalAfterFromMover: number) => evalAfterFromMover >= evalBefore - ACCEPT_MARGIN;

// ---------- Opponent that adjusts ----------

export const LEVEL_ELO = { 1: 600, 2: 1000, 3: 1400, 4: 1900, 5: 2400 } as const;
export type Level = keyof typeof LEVEL_ELO;

// Strongest level that is not far above the player's strength against the computer
export const suggestedLevel = (p: Progress): Level => {
  let level: Level = 1;
  for (const l of [1, 2, 3, 4, 5] as Level[]) if (LEVEL_ELO[l] <= p.aiRating + 150) level = l;
  return level;
};

// Record a game against the computer (score: 1 win, 0.5 draw, 0 loss)
export const recordAiGame = (p: Progress, level: Level, score: number): Progress => ({
  ...p,
  aiRating: Math.round(p.aiRating + (p.aiGames < 5 ? 200 : 120) * (score - expectedScore(p.aiRating, LEVEL_ELO[level]))),
  aiGames: p.aiGames + 1,
});

// ---------- Level estimates over time ----------

export const recordLevel = (p: Progress, elo: number, style: Progress['style'], now = Date.now()): Progress => ({
  ...p,
  style,
  levelHistory: [...p.levelHistory, { at: now, elo }].slice(-MAX_HISTORY),
});
