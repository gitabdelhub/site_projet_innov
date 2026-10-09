import { Chess, type Move } from 'chess.js';
import type { Exercise, Goal } from '../data/lessons';

// Rules of the lesson exercises, kept apart from the page so they can be tested.

// Star boards hold a single piece and no kings, so chess.js must not insist on kings
export const lessonBoard = (fen: string) => new Chess(fen, { skipValidation: true });

// In a star exercise the same side keeps moving: hand the move back after each step
export const keepTurn = (fen: string, side: 'w' | 'b') => {
  const parts = fen.split(' ');
  parts[1] = side;
  parts[3] = '-';
  return parts.join(' ');
};

export const reachesGoal = (goal: Goal, after: Chess, move: Move, wasInCheck: boolean) => {
  switch (goal) {
    case 'mate':
      return after.isCheckmate();
    case 'check':
      return after.isCheck();
    case 'castle':
      return move.isKingsideCastle() || move.isQueensideCastle();
    case 'promote':
      return !!move.promotion;
    case 'escape':
      return wasInCheck; // any legal move out of check counts
  }
};

export type Verdict = 'right' | 'wrong' | 'star' | 'continue';

// Judge one move of an exercise. `remaining` is the list of stars still on the board.
export const judgeLessonMove = (ex: Exercise, fenBefore: string, move: Move, after: Chess, remaining: string[]): Verdict => {
  if (ex.kind === 'stars') return remaining.includes(move.to) ? 'star' : 'continue';
  if (ex.kind === 'move') return ex.accept.includes(move.san) ? 'right' : 'wrong';
  return reachesGoal(ex.goal, after, move, lessonBoard(fenBefore).isCheck()) ? 'right' : 'wrong';
};

// Fewest moves needed to collect every star (breadth-first search); null if impossible
export const starsSolution = (fen: string, targets: string[]): number | null => {
  const side = fen.split(' ')[1] as 'w' | 'b';
  const key = (f: string, left: string[]) => `${f.split(' ')[0]}|${[...left].sort().join(',')}`;
  let frontier: { fen: string; left: string[] }[] = [{ fen, left: targets }];
  const seen = new Set([key(fen, targets)]);
  for (let depth = 1; depth <= 20 && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const board = lessonBoard(node.fen);
      for (const m of board.moves({ verbose: true })) {
        const b = lessonBoard(node.fen);
        b.move(m);
        const left = node.left.filter((s) => s !== m.to);
        if (!left.length) return depth;
        const f = keepTurn(b.fen(), side);
        const k = key(f, left);
        if (!seen.has(k)) {
          seen.add(k);
          next.push({ fen: f, left });
        }
      }
    }
    frontier = next;
  }
  return null;
};
