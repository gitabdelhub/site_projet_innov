import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { PUZZLES, THEMES, LEVELS } from '../src/data/puzzles';

describe('puzzle data', () => {
  it('has unique ids and known themes', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    PUZZLES.forEach((p) => expect(THEMES.some((t) => t.id === p.theme)).toBe(true));
  });

  it('has every theme at every level', () => {
    for (const t of THEMES) for (const l of LEVELS) {
      expect(PUZZLES.some((p) => p.theme === t.id && p.rating !== undefined && p.rating >= l.min && p.rating < l.max)).toBe(true);
    }
  });

  it('replays every solution legally, and mates really are mates', () => {
    for (const p of PUZZLES) {
      const chess = new Chess(p.fen);
      if (p.moves) { chess.reset(); p.moves.split(' ').forEach((m) => chess.move(m)); }
      if (p.setup) chess.move(p.setup);
      p.solution.forEach((san) => expect(() => chess.move(san), `${p.id} ${san}`).not.toThrow());
      if (p.solution[p.solution.length - 1].includes('#')) expect(chess.isCheckmate(), p.id).toBe(true);
    }
  });
});
