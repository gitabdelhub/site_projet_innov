import { Chess } from 'chess.js';

export const MATE_SCORE = 10000;
const ANALYSIS_DEPTH = 12;
const ANALYSIS_MOVETIME = 250; // ms per position, keeps a 40-move game under ~25s

export type MoveCategory = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedMove {
  san: string;
  color: 'w' | 'b';
  evalBefore: number; // centipawns, White's point of view
  evalAfter: number;
  loss: number; // centipawns lost by the side that moved (capped)
  accuracy: number; // 0-100, Lichess formula
  category: MoveCategory;
}

export const categorize = (loss: number): MoveCategory => {
  if (loss >= 300) return 'blunder';
  if (loss >= 150) return 'mistake';
  if (loss >= 60) return 'inaccuracy';
  if (loss <= 15) return 'best';
  return 'good';
};

// Win probability (0-100) for White from a centipawn score (Lichess model)
const winPercent = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

// Accuracy of a single move from the mover's win% before and after (Lichess formula)
const moveAccuracy = (winBefore: number, winAfter: number) => {
  const drop = Math.max(0, winBefore - winAfter);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
};

// Evaluate every position with a dedicated Stockfish worker. Returns White-POV scores.
export const evaluatePositions = (fens: string[], onProgress?: (done: number) => void) => {
  const worker = new Worker('/stockfish.js');
  let cancelled = false;

  const evaluate = (fen: string) =>
    new Promise<number>((resolve) => {
      let score = 0;
      const whiteToMove = fen.split(' ')[1] === 'w';
      worker.onmessage = (e) => {
        const line = String(e.data);
        const cp = line.match(/score cp (-?\d+)/);
        const mate = line.match(/score mate (-?\d+)/);
        if (cp) score = parseInt(cp[1], 10);
        if (mate) {
          const n = parseInt(mate[1], 10);
          score = n > 0 ? MATE_SCORE - n : -MATE_SCORE - n;
        }
        if (line.startsWith('bestmove')) resolve(whiteToMove ? score : -score);
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${ANALYSIS_DEPTH} movetime ${ANALYSIS_MOVETIME}`);
    });

  const promise = (async () => {
    worker.postMessage('uci');
    worker.postMessage('ucinewgame');
    const evals: number[] = [];
    for (let i = 0; i < fens.length; i++) {
      if (cancelled) break;
      const chess = new Chess(fens[i]);
      if (chess.isCheckmate()) evals.push(chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE);
      else if (chess.isDraw()) evals.push(0);
      else evals.push(await evaluate(fens[i]));
      onProgress?.(i + 1);
    }
    worker.terminate();
    return evals;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker.terminate();
    },
  };
};

// Turn position evaluations into per-move judgements
export const judgeMoves = (sans: string[], evals: number[], startColor: 'w' | 'b' = 'w'): AnalyzedMove[] =>
  sans.map((san, i) => {
    const color: 'w' | 'b' = (i % 2 === 0) === (startColor === 'w') ? 'w' : 'b';
    const before = Math.max(-1500, Math.min(1500, evals[i]));
    const after = Math.max(-1500, Math.min(1500, evals[i + 1]));
    const loss = Math.max(0, color === 'w' ? before - after : after - before);
    const winBefore = color === 'w' ? winPercent(before) : 100 - winPercent(before);
    const winAfter = color === 'w' ? winPercent(after) : 100 - winPercent(after);
    return {
      san,
      color,
      evalBefore: evals[i],
      evalAfter: evals[i + 1],
      loss: Math.min(loss, 1000),
      accuracy: moveAccuracy(winBefore, winAfter),
      category: categorize(loss),
    };
  });

export interface SideSummary {
  moves: number;
  accuracy: number;
  acpl: number;
  best: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

export const summarize = (moves: AnalyzedMove[], color: 'w' | 'b'): SideSummary => {
  const mine = moves.filter((m) => m.color === color);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    moves: mine.length,
    accuracy: Math.round(avg(mine.map((m) => m.accuracy)) * 10) / 10,
    acpl: Math.round(avg(mine.map((m) => m.loss))),
    best: mine.filter((m) => m.category === 'best').length,
    inaccuracies: mine.filter((m) => m.category === 'inaccuracy').length,
    mistakes: mine.filter((m) => m.category === 'mistake').length,
    blunders: mine.filter((m) => m.category === 'blunder').length,
  };
};

// Rough Elo estimate from average centipawn loss (single-game estimates are noisy)
export const eloFromAcpl = (acpl: number) => Math.round(Math.max(400, Math.min(2800, 3100 * Math.exp(-0.01 * acpl))));

export const formatEval = (cp: number) =>
  Math.abs(cp) >= MATE_SCORE - 100
    ? `${cp > 0 ? '+' : '-'}M${MATE_SCORE - Math.abs(cp)}`
    : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
