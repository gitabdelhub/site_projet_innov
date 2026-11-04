import { Chess } from 'chess.js';
import { getAnalysisEngine, scoreToCp, winPercent, type Score } from './engine';
import { fromUci, type Color, type PlayedMove } from '../lib/chessGame';

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';

export interface PositionEval {
  fen: string;
  score: Score | null;
  cp: number; // White POV, mates mapped to +/- 10000
  bestUci: string | null;
  bestSan: string | null;
}

export interface MoveAnalysis {
  ply: number; // 1-based
  color: Color;
  san: string;
  uci: string;
  cpBefore: number; // White POV
  cpAfter: number;
  /** Centipawn loss from the mover's point of view (capped at 1000). */
  cpLoss: number;
  /** Drop of winning chances for the mover, in percentage points. */
  winDrop: number;
  accuracy: number; // 0..100
  cls: MoveClass;
  bestSan: string | null;
  bestUci: string | null;
}

export interface PlayerSummary {
  accuracy: number;
  acpl: number;
  best: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  moves: number;
}

export interface GameAnalysis {
  positions: PositionEval[];
  moves: MoveAnalysis[];
  white: PlayerSummary;
  black: PlayerSummary;
  depth: number;
}

/** Lichess move accuracy formula, from the drop of winning chances. */
export const moveAccuracy = (winDrop: number) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, winDrop)) - 3.1669));

const classify = (winDrop: number, isBest: boolean, allowsMate: boolean, cpBeforeMover: number): MoveClass => {
  if (isBest) return 'best';
  // Allowing a forced mate is a blunder unless the position was already lost.
  if (allowsMate) return cpBeforeMover > -500 ? 'blunder' : 'mistake';
  if (winDrop >= 30) return 'blunder';
  if (winDrop >= 20) return 'mistake';
  if (winDrop >= 10) return 'inaccuracy';
  return 'good';
};

const uciToSan = (fen: string, uci: string | null): string | null => {
  if (!uci) return null;
  try {
    return new Chess(fen).move(fromUci(uci)).san;
  } catch {
    return null;
  }
};

/** White POV centipawns of a finished position (mate / draw), or null if the game goes on. */
const terminalCp = (fen: string): number | null => {
  const c = new Chess(fen);
  if (c.isCheckmate()) return c.turn() === 'w' ? -10000 : 10000;
  if (c.isDraw() || c.isStalemate()) return 0;
  return null;
};

const summarize = (moves: MoveAnalysis[]): PlayerSummary => {
  const n = moves.length || 1;
  const count = (c: MoveClass) => moves.filter((m) => m.cls === c).length;
  return {
    accuracy: Math.round((moves.reduce((s, m) => s + m.accuracy, 0) / n) * 10) / 10,
    acpl: Math.round(moves.reduce((s, m) => s + m.cpLoss, 0) / n),
    best: count('best'),
    good: count('good'),
    inaccuracy: count('inaccuracy'),
    mistake: count('mistake'),
    blunder: count('blunder'),
    moves: moves.length,
  };
};

const cache = new Map<string, GameAnalysis>();

/**
 * Analyses every position of a game with Stockfish.
 * `onProgress(done, total)` is called after each position.
 */
export const analyseGame = async (
  startFen: string,
  moves: PlayedMove[],
  { depth = 12, onProgress }: { depth?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<GameAnalysis | null> => {
  const key = `${depth}|${startFen}|${moves.map((m) => m.uci).join(' ')}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const engine = getAnalysisEngine();
  const fens = [startFen, ...moves.map((m) => m.fenAfter)];
  const positions: PositionEval[] = [];

  for (let i = 0; i < fens.length; i++) {
    const fen = fens[i];
    const terminal = terminalCp(fen);
    if (terminal !== null) {
      const score: Score = terminal === 0 ? { cp: 0 } : { mate: 0 };
      positions.push({ fen, score, cp: terminal, bestUci: null, bestSan: null });
    } else {
      const r = await engine.search(fen, { depth });
      if (r.cancelled) return null;
      positions.push({ fen, score: r.score, cp: scoreToCp(r.score), bestUci: r.bestmove, bestSan: uciToSan(fen, r.bestmove) });
    }
    onProgress?.(i + 1, fens.length);
  }

  const analysed: MoveAnalysis[] = moves.map((m, i) => {
    const before = positions[i];
    const after = positions[i + 1];
    const sign = m.color === 'w' ? 1 : -1;
    const cpBefore = before.cp;
    const cpAfter = after.cp;
    const cpLoss = Math.max(0, Math.min(1000, sign * (cpBefore - cpAfter)));
    const wpBefore = winPercent(sign * cpBefore);
    const wpAfter = winPercent(sign * cpAfter);
    const winDrop = Math.max(0, wpBefore - wpAfter);
    const isBest = before.bestUci === m.uci;
    const moverMatedAfter = after.score?.mate !== undefined && sign * after.cp < 0;
    const moverMatedBefore = before.score?.mate !== undefined && sign * before.cp < 0;
    const allowsMate = moverMatedAfter && !moverMatedBefore;
    return {
      ply: i + 1,
      color: m.color,
      san: m.san,
      uci: m.uci,
      cpBefore,
      cpAfter,
      cpLoss,
      winDrop,
      accuracy: isBest ? 100 : moveAccuracy(winDrop),
      cls: classify(winDrop, isBest, allowsMate, sign * cpBefore),
      bestSan: before.bestSan,
      bestUci: before.bestUci,
    };
  });

  const result: GameAnalysis = {
    positions,
    moves: analysed,
    white: summarize(analysed.filter((m) => m.color === 'w')),
    black: summarize(analysed.filter((m) => m.color === 'b')),
    depth,
  };
  cache.set(key, result);
  return result;
};

export const cancelAnalysis = () => getAnalysisEngine().cancelAll();

export const CLASS_COLORS: Record<MoveClass, string> = {
  best: '#16a34a',
  good: '#3273f5',
  book: '#a16207',
  inaccuracy: '#ca8a04',
  mistake: '#ea580c',
  blunder: '#e83808',
};

export const CLASS_BADGE: Record<MoveClass, string> = {
  best: '★',
  good: '✓',
  book: 'B',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};
