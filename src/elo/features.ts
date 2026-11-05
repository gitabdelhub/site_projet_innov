/**
 * The 42 input variables of our Elo model (modele_elo.joblib, LightGBM).
 *
 * The model works on a PLAYER PROFILE: statistics are computed for each game
 * (computeGameStats), then aggregated over the player's games (buildProfile):
 *   - "robust" statistics are aggregated with the median over games (suffix _med)
 *   - "means" statistics are aggregated with the mean over games (suffix _avg)
 *   - loss_median_between / acc_mean_between: standard deviation between games
 *   - n_moves_avg, n_plies_avg, n_games, frac_white
 * Names, order and the robust / means split come from the .joblib itself.
 *
 * The training notebook was not available, so the per game definitions below
 * were rebuilt from the variable names and calibrated on 103 real Lichess players
 * (20+ analysed games each). Every choice is documented in docs/MODELE_ELO.md
 * and the Flask API receives the 42 values computed here.
 */
import type { GameAnalysis } from '../engine/analysis';
import type { Color, PlayedMove } from '../lib/chessGame';

/**
 * Calibrated parameters (see docs/MODELE_ELO.md), tuned with scripts/calibrate-elo-features.ts
 * on 103 Lichess players whose games were analysed by the site's own engine (depth 12).
 */
export const PARAMS = {
  /** Evaluations are clipped to +/- 10 pawns (mates count as +/- 10 pawns). */
  clipCp: 1000,
  /** The first 6 moves of each side are opening theory and are not counted. */
  skipMoves: 6,
  /** Moves played in an already decided position (|eval| > 5 pawns) are not counted. */
  decidedCp: 500,
  /** A position is "critical" while it is still balanced: |eval| <= 1.5 pawn. */
  criticalCp: 150,
  /** Opening = up to move 10; endgame = 13 points of pieces or less on the board (both sides). */
  openingMoves: 10,
  endgameMaterial: 13,
  /** A blunder loses 2 pawns or more. */
  blunderCp: 200,
  /** Fast move: less than 5 % of the starting clock. Time trouble: less than 10 % left. */
  fastFrac: 0.05,
  zeitnotFrac: 0.1,
} as const;

export const ROBUST = [
  'loss_median',
  'loss_trimmed_mean',
  'loss_q25',
  'loss_q75',
  'loss_q90',
  'acc_median',
  'loss_mean_open',
  'loss_mean_mid',
  'loss_mean_end',
  'loss_mean_critical',
  'loss_mean_noncritical',
  'loss_after_blunder',
  'loss_fast_moves',
  'loss_slow_moves',
  'loss_zeitnot',
  'time_median_frac',
  'time_std',
] as const;

export const MEANS = [
  'loss_mean',
  'loss_std',
  'acc_mean',
  'frac_loss_0_10',
  'frac_loss_10_25',
  'frac_loss_25_50',
  'frac_loss_50_100',
  'frac_loss_100_200',
  'frac_loss_200_500',
  'frac_loss_500_plus',
  'frac_critical',
  'blunder_rate_critical',
  'loss_first_third',
  'loss_last_third',
  'frac_fast_moves',
  'ratio_fast_slow',
  'corr_time_loss',
  'frac_zeitnot',
  'ratio_zeitnot',
] as const;

/** Exact order expected by the model. */
export const FEATURE_NAMES = [
  ...ROBUST.map((n) => `${n}_med`),
  ...MEANS.map((n) => `${n}_avg`),
  'n_moves_avg',
  'n_plies_avg',
  'loss_median_between',
  'acc_mean_between',
  'n_games',
  'frac_white',
];

type StatName = (typeof ROBUST)[number] | (typeof MEANS)[number];

/** Statistics of one game for one player. NaN = not available (no clock, no blunder...). */
export type GameStats = Record<StatName, number> & {
  n_moves: number;
  n_plies: number;
  white: number;
};

/* ---------------------------- small numeric helpers --------------------------- */

const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN);
const std = (x: number[], ddof = 0) => {
  if (x.length - ddof <= 0) return NaN;
  const m = mean(x);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - ddof));
};
/** Same as numpy.percentile (linear interpolation). */
const percentile = (x: number[], p: number) => {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const pos = ((s.length - 1) * p) / 100;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const median = (x: number[]) => percentile(x, 50);
const pearson = (a: number[], b: number[]) => {
  if (a.length < 2) return NaN;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN;
};
const finite = (x: number[]) => x.filter((v) => Number.isFinite(v));

const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const moveAcc = (before: number, after: number) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, winPct(before) - winPct(after))) - 3.1669));

const PIECE: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };
const pieceMaterial = (fen: string) => {
  let m = 0;
  for (const ch of fen.split(' ')[0]) m += PIECE[ch.toLowerCase()] ?? 0;
  return m;
};
const fullMove = (fen: string) => Number(fen.split(' ')[5]) || 1;

/* ------------------------------- one game -------------------------------- */

export interface GameStatsInput {
  analysis: GameAnalysis;
  moves: PlayedMove[];
  color: Color;
  /** Starting clock in seconds, if the game was timed. */
  initialSec?: number;
}

/** Starting clock in seconds from a PGN TimeControl header ("180+2"), if any. */
export const initialFromHeaders = (headers?: Record<string, string>) => {
  const base = Number((headers?.TimeControl ?? '').split('+')[0]);
  return Number.isFinite(base) && base > 0 ? base : undefined;
};

interface MoveRow {
  loss: number;
  acc: number;
  critical: boolean;
  phase: 'open' | 'mid' | 'end';
  spent?: number;
  clockBefore?: number;
}

/** Tunable parameters, see PARAMS. */
export type FeatureParams = { [K in keyof typeof PARAMS]: number };

export const computeGameStats = (
  { analysis, moves, color, initialSec }: GameStatsInput,
  P: FeatureParams = PARAMS,
): GameStats | null => {
  const clip = (cp: number) => Math.max(-P.clipCp, Math.min(P.clipCp, cp));
  const sign = color === 'w' ? 1 : -1;
  const rows: MoveRow[] = [];
  let lastClock = initialSec !== undefined ? initialSec * 1000 : undefined;

  moves.forEach((m, i) => {
    if (m.color !== color) return;
    const clockBefore = lastClock;
    if (m.clockMs !== undefined) lastClock = m.clockMs;
    const pos = analysis.positions[i];
    const next = analysis.positions[i + 1];
    if (!pos || !next) return;
    if (fullMove(pos.fen) <= P.skipMoves) return;
    const before = sign * clip(pos.cp);
    const after = sign * clip(next.cp);
    if (Math.abs(before) > P.decidedCp) return;
    const full = fullMove(pos.fen);
    rows.push({
      loss: Math.max(0, before - after),
      acc: moveAcc(before, after),
      critical: Math.abs(before) <= P.criticalCp,
      phase: full <= P.openingMoves ? 'open' : pieceMaterial(pos.fen) <= P.endgameMaterial ? 'end' : 'mid',
      spent: m.spentMs !== undefined ? m.spentMs / 1000 : undefined,
      clockBefore: clockBefore !== undefined ? clockBefore / 1000 : undefined,
    });
  });
  if (rows.length === 0) return null;

  const L = rows.map((r) => r.loss);
  const A = rows.map((r) => r.acc);
  const k = L.length;
  const third = Math.max(1, Math.floor(k / 3));
  const sorted = [...L].sort((a, b) => a - b);
  const cut = Math.floor(0.1 * k);
  const trimmed = k - 2 * cut > 0 ? mean(sorted.slice(cut, k - cut)) : mean(sorted);
  const lossWhere = (f: (r: MoveRow) => boolean) => mean(rows.filter(f).map((r) => r.loss));
  const crit = rows.filter((r) => r.critical);
  const afterBlunder: number[] = [];
  for (let j = 0; j < k - 1; j++) if (L[j] >= P.blunderCp) afterBlunder.push(L[j + 1]);
  const frac = (lo: number, hi: number) => L.filter((v) => v >= lo && v < hi).length / k;

  // Clock based statistics (only if every counted move has a time).
  const timed = initialSec !== undefined && rows.every((r) => r.spent !== undefined);
  let t: Partial<Record<StatName, number>> = {};
  if (timed && initialSec) {
    const T = rows.map((r) => r.spent as number);
    const fast = rows.filter((r) => (r.spent as number) < P.fastFrac * initialSec);
    const slow = rows.filter((r) => (r.spent as number) >= P.fastFrac * initialSec);
    const zeit = rows.filter((r) => r.clockBefore !== undefined && r.clockBefore < P.zeitnotFrac * initialSec);
    const calm = rows.filter((r) => !(r.clockBefore !== undefined && r.clockBefore < P.zeitnotFrac * initialSec));
    const lFast = mean(fast.map((r) => r.loss));
    const lSlow = mean(slow.map((r) => r.loss));
    const lZeit = mean(zeit.map((r) => r.loss));
    const lCalm = mean(calm.map((r) => r.loss));
    t = {
      loss_fast_moves: lFast,
      loss_slow_moves: lSlow,
      loss_zeitnot: lZeit,
      time_median_frac: median(T) / initialSec,
      time_std: std(T),
      frac_fast_moves: fast.length / k,
      ratio_fast_slow: lFast / (lSlow + 1e-6),
      corr_time_loss: pearson(T, L),
      frac_zeitnot: zeit.length / k,
      ratio_zeitnot: lZeit / (lCalm + 1e-6),
    };
  }
  const tv = (n: StatName) => t[n] ?? NaN;

  return {
    loss_median: median(L),
    loss_trimmed_mean: trimmed,
    loss_q25: percentile(L, 25),
    loss_q75: percentile(L, 75),
    loss_q90: percentile(L, 90),
    acc_median: median(A),
    loss_mean_open: lossWhere((r) => r.phase === 'open'),
    loss_mean_mid: lossWhere((r) => r.phase === 'mid'),
    loss_mean_end: lossWhere((r) => r.phase === 'end'),
    loss_mean_critical: lossWhere((r) => r.critical),
    loss_mean_noncritical: lossWhere((r) => !r.critical),
    loss_after_blunder: mean(afterBlunder),
    loss_fast_moves: tv('loss_fast_moves'),
    loss_slow_moves: tv('loss_slow_moves'),
    loss_zeitnot: tv('loss_zeitnot'),
    time_median_frac: tv('time_median_frac'),
    time_std: tv('time_std'),
    loss_mean: mean(L),
    loss_std: k > 1 ? std(L, 1) : 0,
    acc_mean: mean(A),
    frac_loss_0_10: frac(0, 10),
    frac_loss_10_25: frac(10, 25),
    frac_loss_25_50: frac(25, 50),
    frac_loss_50_100: frac(50, 100),
    frac_loss_100_200: frac(100, 200),
    frac_loss_200_500: frac(200, 500),
    frac_loss_500_plus: frac(500, Infinity),
    frac_critical: crit.length / k,
    blunder_rate_critical: crit.length ? crit.filter((r) => r.loss >= P.blunderCp).length / crit.length : NaN,
    loss_first_third: mean(L.slice(0, third)),
    loss_last_third: mean(L.slice(-third)),
    frac_fast_moves: tv('frac_fast_moves'),
    ratio_fast_slow: tv('ratio_fast_slow'),
    corr_time_loss: tv('corr_time_loss'),
    frac_zeitnot: tv('frac_zeitnot'),
    ratio_zeitnot: tv('ratio_zeitnot'),
    n_moves: k,
    n_plies: moves.length,
    white: color === 'w' ? 1 : 0,
  };
};

/* ------------------------------ player profile ------------------------------ */

/** Aggregates the games of one player into the 42 features, in model order. */
export const buildProfile = (games: GameStats[]): number[] => {
  const col = (n: keyof GameStats) => finite(games.map((g) => g[n]));
  const f: Record<string, number> = {};
  for (const n of ROBUST) f[`${n}_med`] = median(col(n));
  for (const n of MEANS) f[`${n}_avg`] = mean(col(n));
  f.n_moves_avg = mean(games.map((g) => g.n_moves));
  f.n_plies_avg = mean(games.map((g) => g.n_plies));
  f.loss_median_between = std(col('loss_median'), 1);
  f.acc_mean_between = std(col('acc_mean'), 1);
  f.n_games = games.length;
  f.frac_white = mean(games.map((g) => g.white));
  return FEATURE_NAMES.map((n) => f[n]);
};

/** The model was trained on profiles of 20 games or more. */
export const MIN_GAMES = 20;

export type Reliability = 'low' | 'medium' | 'good';
export const reliabilityOf = (nGames: number): Reliability =>
  nGames >= MIN_GAMES ? 'good' : nGames >= 5 ? 'medium' : 'low';

/**
 * Typical error measured on 103 Lichess players with the site's engine (docs/MODELE_ELO.md):
 * 1 game 360, 3 games 280, 5 games 250, 10 games 200, 20 games 170.
 */
export const marginFor = (nGames: number) => {
  const table: [number, number][] = [
    [1, 360],
    [3, 280],
    [5, 250],
    [10, 200],
    [20, 170],
  ];
  if (nGames >= 20) return 170;
  for (let i = table.length - 1; i >= 0; i--) {
    if (nGames >= table[i][0]) {
      const [g0, m0] = table[i];
      const [g1, m1] = table[i + 1];
      return Math.round((m0 + ((m1 - m0) * (nGames - g0)) / (g1 - g0)) / 10) * 10;
    }
  }
  return 360;
};
