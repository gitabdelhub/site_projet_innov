import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { judgeLessonMove, lessonBoard, starsSolution } from '../src/lib/lessonRules';

describe('beginner lessons', () => {
  it('have unique ids and texts in both languages', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      for (const text of [l.title, l.intro, ...l.exercises.map((e) => e.prompt)]) {
        expect(text.fr.length).toBeGreaterThan(0);
        expect(text.en.length).toBeGreaterThan(0);
      }
    }
  });

  for (const lesson of LESSONS) {
    lesson.exercises.forEach((ex, i) => {
      it(`${lesson.id} #${i + 1} can be solved`, () => {
        if (ex.kind === 'stars') {
          const board = lessonBoard(ex.fen);
          for (const s of ex.targets) expect(board.get(s as never)).toBeFalsy();
          expect(starsSolution(ex.fen, ex.targets)).not.toBeNull();
          return;
        }
        // Real positions: valid for chess.js without any shortcut
        const chess = new Chess(ex.fen);
        const moves = chess.moves({ verbose: true });
        const right = moves.filter((m) => {
          const after = new Chess(ex.fen);
          after.move(m);
          return judgeLessonMove(ex, ex.fen, m, after, []) === 'right';
        });
        expect(right.length).toBeGreaterThan(0);
        if (ex.kind === 'move') for (const san of ex.accept) expect(moves.map((m) => m.san)).toContain(san);
      });
    });
  }
});
