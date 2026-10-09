import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, mergeProgress, type Progress } from '../src/lib/progress';
import {
  addMistakes, dueMistakes, isGoodEnough, mistakesFromGame, pickPuzzle, puzzleDifficulty,
  recordAiGame, recordPuzzle, reviewMistake, suggestedLevel, updateRating, weakThemes,
} from '../src/lib/adaptive';
import { PUZZLES } from '../src/data/puzzles';
import type { AnalyzedMove } from '../src/lib/analysis';

const p = (over: Partial<Progress> = {}): Progress => ({ ...EMPTY_PROGRESS, ...over });

// Small repeatable random generator
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('puzzle rating', () => {
  it('goes up when solving and down when failing', () => {
    expect(updateRating(1000, 0, 1000, 1)).toBe(1030);
    expect(updateRating(1000, 0, 1000, 0)).toBe(970);
    // Failing a much harder puzzle costs little
    expect(1000 - updateRating(1000, 50, 1800, 0)).toBeLessThan(1);
  });

  it('records the theme of each attempt', () => {
    const puzzle = PUZZLES.find((q) => q.theme === 'forks')!;
    const after = recordPuzzle(recordPuzzle(p(), puzzle, 1), puzzle, 0);
    expect(after.themeStats.forks).toEqual({ tries: 2, wins: 1 });
    expect(after.puzzleRated).toBe(2);
    expect(after.puzzleHistory).toHaveLength(2);
  });
});

describe('weak themes', () => {
  it('lists the themes failed most, once there is enough data', () => {
    const progress = p({
      themeStats: {
        forks: { tries: 10, wins: 2 },
        'back-rank': { tries: 10, wins: 9 },
        'pins-skewers': { tries: 6, wins: 3 },
        'mating-nets': { tries: 1, wins: 0 }, // too few tries to judge
      },
    });
    expect(weakThemes(progress).map((w) => w.theme)).toEqual(['forks', 'pins-skewers']);
  });
});

describe('personalised puzzles', () => {
  it('picks unsolved puzzles close to the player rating', () => {
    const rnd = seeded(7);
    for (const rating of [700, 1200, 1700, 2100]) {
      for (let i = 0; i < 30; i++) {
        const q = pickPuzzle(p({ puzzleRating: rating }), [], rnd);
        expect(Math.abs(puzzleDifficulty(q) - (rating + 50))).toBeLessThanOrEqual(600);
      }
    }
  });

  it('favours weak themes', () => {
    const rnd = seeded(3);
    const progress = p({ puzzleRating: 1300, themeStats: { forks: { tries: 10, wins: 1 } } });
    const picks = Array.from({ length: 200 }, () => pickPuzzle(progress, [], rnd).theme);
    const share = picks.filter((th) => th === 'forks').length / picks.length;
    expect(share).toBeGreaterThan(0.5);
  });

  it('never repeats an excluded puzzle', () => {
    const exclude = PUZZLES.slice(0, 300).map((q) => q.id);
    expect(exclude).not.toContain(pickPuzzle(p(), exclude).id);
  });
});

describe('mistakes from my games', () => {
  const fen = 'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const blunder: AnalyzedMove = { san: 'Qh5', color: 'w', evalBefore: 40, evalAfter: -850, loss: 890, accuracy: 5, category: 'blunder' };

  it('become review cards with the engine move', () => {
    const cards = mistakesFromGame([fen], [blunder], ['g1f3'], 'w', 1000);
    expect(cards).toEqual([expect.objectContaining({ fen, played: 'Qh5', best: 'Nf3', evalBefore: 40, box: 0, due: 1000 })]);
    // Only the player's own moves count
    expect(mistakesFromGame([fen], [blunder], ['g1f3'], 'b')).toEqual([]);
  });

  it('come back later when solved, soon when missed', () => {
    const cards = mistakesFromGame([fen], [blunder], ['g1f3'], 'w', 0);
    let progress = addMistakes(p(), cards);
    expect(addMistakes(progress, cards).mistakes).toHaveLength(1); // no duplicates
    expect(dueMistakes(progress, 0)).toHaveLength(1);
    progress = reviewMistake(progress, fen, true, 0);
    expect(dueMistakes(progress, 0)).toHaveLength(0);
    expect(dueMistakes(progress, 2 * 24 * 3600 * 1000)).toHaveLength(1);
    progress = reviewMistake(progress, fen, false, 0);
    expect(progress.mistakes[0].box).toBe(0);
  });

  it('accept any move that keeps the advantage', () => {
    expect(isGoodEnough(40, 0)).toBe(true);
    expect(isGoodEnough(40, -300)).toBe(false);
  });

  it('are merged between devices without duplicates', () => {
    const cards = mistakesFromGame([fen], [blunder], ['g1f3'], 'w', 0);
    const a = addMistakes(p({ updatedAt: 1 }), cards);
    const b = reviewMistake(a, fen, true, 5);
    expect(mergeProgress(a, b).mistakes).toEqual(b.mistakes);
  });
});

describe('opponent that adjusts', () => {
  it('starts easy and moves up after wins', () => {
    let progress = p();
    expect(suggestedLevel(progress)).toBe(1);
    for (let i = 0; i < 3; i++) progress = recordAiGame(progress, suggestedLevel(progress), 1);
    expect(suggestedLevel(progress)).toBe(2);
  });

  it('moves down after losses', () => {
    let progress = p({ aiRating: 1300, aiGames: 10 });
    expect(suggestedLevel(progress)).toBe(3);
    for (let i = 0; i < 3; i++) progress = recordAiGame(progress, 3, 0);
    expect(suggestedLevel(progress)).toBe(2);
  });
});
