import { describe, expect, it } from 'vitest';
import model from '../src/data/eloModel.json';
import { rawPrediction, errorFor, predictElo } from '../src/lib/eloModel';

describe('Elo model in the browser', () => {
  it('gives exactly the same numbers as the Python model it was exported from', () => {
    model.check.inputs.forEach((x: number[], i: number) => {
      expect(rawPrediction(x)).toBeCloseTo(model.check.outputs[i], 0);
    });
  });

  it('stays within a sensible rating range', () => {
    expect(predictElo(new Array(17).fill(0))).toBeGreaterThanOrEqual(400);
    expect(predictElo(new Array(17).fill(1000))).toBeLessThanOrEqual(3000);
  });

  it('reports a smaller error with more games', () => {
    expect(errorFor(10)).toBeLessThan(errorFor(1));
    expect(errorFor(4)).toBe(errorFor(3));
  });
});
