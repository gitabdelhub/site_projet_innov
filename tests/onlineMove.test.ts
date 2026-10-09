import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { checkMove, type StoredGame } from '../server/onlineMove';

const WHITE = 'white-id';
const BLACK = 'black-id';

const gameAfter = (moves: string[]): StoredGame => {
  const chess = new Chess();
  moves.forEach((m) => chess.move(m));
  return { status: 'playing', fen: chess.fen(), pgn: chess.pgn(), ply: moves.length, white_player_id: WHITE, black_player_id: BLACK };
};

describe('server move check', () => {
  it('accepts a legal move from the side to move', () => {
    const check = checkMove(gameAfter([]), WHITE, { from: 'e2', to: 'e4' });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.result).toBeNull();
  });

  it('refuses an illegal move', () => {
    expect(checkMove(gameAfter([]), WHITE, { from: 'e2', to: 'e5' })).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a move when it is not your turn', () => {
    expect(checkMove(gameAfter([]), BLACK, { from: 'e7', to: 'e5' })).toMatchObject({ ok: false, status: 409 });
  });

  it('refuses a move from someone who is not playing', () => {
    expect(checkMove(gameAfter([]), 'stranger', { from: 'e2', to: 'e4' })).toMatchObject({ ok: false, status: 403 });
  });

  it('refuses moves in a finished game', () => {
    expect(checkMove({ ...gameAfter([]), status: 'completed' }, WHITE, { from: 'e2', to: 'e4' })).toMatchObject({ ok: false, status: 409 });
  });

  it('detects checkmate itself instead of trusting the player', () => {
    const check = checkMove(gameAfter(['f3', 'e5', 'g4']), BLACK, { from: 'd8', to: 'h4' });
    expect(check).toMatchObject({ ok: true, result: 'black', reason: 'checkmate' });
  });

  it('refuses a tampered stored game', () => {
    const game = { ...gameAfter(['e4']), fen: new Chess().fen() };
    expect(checkMove(game, BLACK, { from: 'e7', to: 'e5' })).toMatchObject({ ok: false, status: 500 });
  });

  it('requires a promotion piece and validates it', () => {
    const chess = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const game: StoredGame = { status: 'playing', fen: chess.fen(), pgn: '', ply: 0, white_player_id: WHITE, black_player_id: BLACK };
    // A custom start position is not a stored online game: the replay check catches it
    expect(checkMove(game, WHITE, { from: 'a7', to: 'a8', promotion: 'q' })).toMatchObject({ ok: false, status: 500 });
    expect(checkMove(gameAfter([]), WHITE, { from: 'e2', to: 'e4', promotion: 'k' })).toMatchObject({ ok: false, status: 400 });
  });

  it('handles a real promotion inside a game', () => {
    const moves = ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2'];
    const game = gameAfter(moves);
    expect(checkMove(game, WHITE, { from: 'b7', to: 'a8' })).toMatchObject({ ok: false, status: 400 });
    expect(checkMove(game, WHITE, { from: 'b7', to: 'a8', promotion: 'n' })).toMatchObject({ ok: true });
  });

  it('rejects malformed squares', () => {
    expect(checkMove(gameAfter([]), WHITE, { from: 'e9', to: 'e4' })).toMatchObject({ ok: false, status: 400 });
  });
});
