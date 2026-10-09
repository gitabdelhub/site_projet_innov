import { describe, expect, it } from 'vitest';
import { mergeProgress, EMPTY_PROGRESS, type Progress } from '../src/lib/progress';

const p = (over: Partial<Progress>): Progress => ({ ...EMPTY_PROGRESS, ...over });

describe('progress sync between the browser and the account', () => {
  it('keeps everything solved on either device', () => {
    const merged = mergeProgress(
      p({ solvedPuzzles: ['br1', 'fk1'], puzzleAttempts: 5, updatedAt: 10 }),
      p({ solvedPuzzles: ['fk1', 'mn2'], puzzleAttempts: 3, bestStreak: 4, updatedAt: 20 })
    );
    expect(merged.solvedPuzzles.sort()).toEqual(['br1', 'fk1', 'mn2']);
    expect(merged.puzzleAttempts).toBe(5);
    expect(merged.bestStreak).toBe(4);
    expect(merged.updatedAt).toBe(20);
  });

  it('takes the current streak from the most recent device', () => {
    expect(mergeProgress(p({ streak: 7, updatedAt: 5 }), p({ streak: 0, updatedAt: 9 })).streak).toBe(0);
  });

  it('honours a reset made on one device', () => {
    const merged = mergeProgress(
      p({ updatedAt: 100, resetAt: 100 }),
      p({ solvedPuzzles: ['br1'], puzzleAttempts: 9, updatedAt: 50 })
    );
    expect(merged.solvedPuzzles).toEqual([]);
    expect(merged.puzzleAttempts).toBe(0);
    expect(merged.resetAt).toBe(100);
  });

  it('keeps progress made after a reset', () => {
    const merged = mergeProgress(p({ updatedAt: 100, resetAt: 100 }), p({ solvedPuzzles: ['ot1'], updatedAt: 150 }));
    expect(merged.solvedPuzzles).toEqual(['ot1']);
  });
});
