import { describe, expect, it } from 'vitest';
import { categorize, judgeMoves, summarize, formatEval, MATE_SCORE } from '../src/lib/analysis';
import { calculateEloChange } from '../src/lib/elo';

describe('move analysis', () => {
  it('categorises centipawn losses', () => {
    expect(categorize(0)).toBe('best');
    expect(categorize(40)).toBe('good');
    expect(categorize(80)).toBe('inaccuracy');
    expect(categorize(200)).toBe('mistake');
    expect(categorize(500)).toBe('blunder');
  });

  it('charges the loss to the side that moved', () => {
    // White keeps +0.3, Black drops from +0.3 to +3.3 (a blunder)
    const moves = judgeMoves(['e4', 'f6'], [30, 30, 330]);
    expect(moves[0]).toMatchObject({ color: 'w', loss: 0, category: 'best' });
    expect(moves[1]).toMatchObject({ color: 'b', loss: 300, category: 'blunder' });
    expect(moves[0].accuracy).toBeGreaterThan(99);
    expect(moves[1].accuracy).toBeLessThan(50);
  });

  it('summarises one side', () => {
    const s = summarize(judgeMoves(['e4', 'f6', 'd4', 'g5'], [30, 30, 330, 330, MATE_SCORE]), 'b');
    expect(s.moves).toBe(2);
    expect(s.blunders).toBe(2);
  });

  it('formats evaluations', () => {
    expect(formatEval(150)).toBe('+1.5');
    expect(formatEval(MATE_SCORE - 3)).toBe('+M3');
  });
});

describe('Elo update', () => {
  it('moves both ratings by the same amount in opposite directions', () => {
    const r = calculateEloChange(1500, 1500, 'white');
    expect(r.newWhiteRating).toBe(1516);
    expect(r.newBlackRating).toBe(1484);
  });
});
