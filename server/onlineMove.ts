import { Chess } from 'chess.js';
import { getGameResult } from '../src/lib/gameResult.js';

// The part of a stored online game the move check needs
export interface StoredGame {
  status: string;
  fen: string;
  pgn: string;
  ply: number;
  white_player_id: string;
  black_player_id: string;
}

export interface MoveRequest {
  from: string;
  to: string;
  promotion?: string;
}

export type MoveCheck =
  | { ok: true; fen: string; pgn: string; result: 'white' | 'black' | 'draw' | null; reason: string | null }
  | { ok: false; status: number; error: string };

const SQUARE = /^[a-h][1-8]$/;

// Replays the stored game and checks that `userId` may play `move` in it.
// Pure function: the database write happens in apply_move().
export const checkMove = (game: StoredGame, userId: string, move: MoveRequest): MoveCheck => {
  if (game.status !== 'playing') return { ok: false, status: 409, error: 'This game is over.' };
  if (!SQUARE.test(move.from) || !SQUARE.test(move.to)) return { ok: false, status: 400, error: 'Invalid square.' };
  if (move.promotion !== undefined && !['q', 'r', 'b', 'n'].includes(move.promotion)) {
    return { ok: false, status: 400, error: 'Invalid promotion piece.' };
  }

  const chess = new Chess();
  try {
    if (game.pgn) chess.loadPgn(game.pgn);
  } catch {
    return { ok: false, status: 500, error: 'Stored game could not be read.' };
  }
  if (chess.fen() !== game.fen || chess.history().length !== game.ply) {
    return { ok: false, status: 500, error: 'Stored game is inconsistent.' };
  }

  const mover = chess.turn() === 'w' ? game.white_player_id : game.black_player_id;
  if (userId !== game.white_player_id && userId !== game.black_player_id) {
    return { ok: false, status: 403, error: 'You are not playing this game.' };
  }
  if (userId !== mover) return { ok: false, status: 409, error: 'It is not your turn.' };

  // A pawn reaching the last rank must say what it becomes
  const piece = chess.get(move.from as never);
  if (piece?.type === 'p' && (move.to[1] === '8' || move.to[1] === '1') && !move.promotion) {
    return { ok: false, status: 400, error: 'Choose a promotion piece.' };
  }

  try {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return { ok: false, status: 400, error: 'Illegal move.' };
  }

  const end = getGameResult(chess);
  return {
    ok: true,
    fen: chess.fen(),
    pgn: chess.pgn(),
    result: end ? (end.winner === null ? 'draw' : end.winner === 'w' ? 'white' : 'black') : null,
    reason: end ? end.reason : null,
  };
};
