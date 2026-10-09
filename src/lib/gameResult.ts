import type { Chess } from 'chess.js';
import type { GameResult } from '../types/chess';

// Determine whether the position on the board ends the game, and how.
// Shared by the browser and the /api/move server check.
export const getGameResult = (chess: Chess): GameResult | null => {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'threefold' };
  if (chess.isDraw()) return { winner: null, reason: 'fifty-moves' };
  return null;
};
