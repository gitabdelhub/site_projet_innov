import type { AnalyzedMove, MoveCategory } from './analysis';

// Numbers describing how one side played a game. The same function is used to
// build the training set (ml/build-features.ts) and in the browser, so the
// model always sees exactly the same kind of input.

export const FEATURE_NAMES = [
  'my_acpl',
  'my_accuracy',
  'my_best_rate',
  'my_inaccuracy_rate',
  'my_mistake_rate',
  'my_blunder_rate',
  'my_opening_loss',
  'my_balanced_acpl',
  'my_balanced_blunder_rate',
  'my_loss_p75',
  'opp_acpl',
  'opp_accuracy',
  'opp_best_rate',
  'opp_blunder_rate',
  'opp_balanced_acpl',
  'my_moves',
  'my_score',
] as const;

// A position is "balanced" while neither side is ahead by 3 pawns: mistakes there
// say much more about a player than mistakes in an already decided game.
const BALANCED_CP = 300;

export interface FeatureInput {
  moves: AnalyzedMove[];
  side: 'w' | 'b';
  // PGN result tag: '1-0', '0-1', '1/2-1/2' or '*'
  result: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const sideStats = (moves: AnalyzedMove[]) => {
  const rate = (c: MoveCategory) => (moves.length ? moves.filter((m) => m.category === c).length / moves.length : 0);
  const balanced = moves.filter((m) => Math.abs(m.evalBefore) < BALANCED_CP);
  return {
    balancedAcpl: mean(balanced.map((m) => m.loss)),
    balancedBlunders: balanced.length ? balanced.filter((m) => m.category === 'blunder').length / balanced.length : 0,
    lossP75: quantile(moves.map((m) => m.loss), 0.75),
    acpl: mean(moves.map((m) => m.loss)),
    accuracy: mean(moves.map((m) => m.accuracy)),
    best: rate('best'),
    inaccuracy: rate('inaccuracy'),
    mistake: rate('mistake'),
    blunder: rate('blunder'),
  };
};

export const eloFeatures = ({ moves, side, result }: FeatureInput): number[] => {
  const mine = moves.filter((m) => m.color === side);
  const theirs = moves.filter((m) => m.color !== side);
  const me = sideStats(mine);
  const opp = sideStats(theirs);
  const score = result === '1/2-1/2' ? 0.5 : result === (side === 'w' ? '1-0' : '0-1') ? 1 : result === '*' ? 0.5 : 0;
  return [
    me.acpl,
    me.accuracy,
    me.best,
    me.inaccuracy,
    me.mistake,
    me.blunder,
    mean(mine.slice(0, 10).map((m) => m.loss)),
    me.balancedAcpl,
    me.balancedBlunders,
    me.lossP75,
    opp.acpl,
    opp.accuracy,
    opp.best,
    opp.blunder,
    opp.balancedAcpl,
    mine.length,
    score,
  ];
};
