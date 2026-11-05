/**
 * Measures our Elo model on real Lichess games, with the SAME feature code as the site
 * (src/elo/features.ts) and the SAME evaluator (src/elo/model.ts).
 *
 *   npm run eval:elo
 *
 * Data: ml/data/lichess_calibration_games.ndjson, 3769 rated Lichess games already
 * analysed by Lichess (Stockfish evaluation after every ply), collected from 208 players.
 * Each line: { user, wid, bid, wr, br, moves (SAN), evals (cp White POV or {mate}) }.
 * Only players with 20+ games and a rating inside the model range (809-2796) are scored.
 */
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { buildProfile, computeGameStats, FEATURE_NAMES, type GameStats } from '../src/elo/features';
import { evaluateLgbm, type LgbmModel } from '../src/elo/model';
import type { GameAnalysis, PositionEval } from '../src/engine/analysis';
import type { PlayedMove } from '../src/lib/chessGame';
import { toPlayed } from '../src/lib/chessGame';

const model = JSON.parse(fs.readFileSync('public/models/elo_lgbm.json', 'utf8')) as LgbmModel;
if (model.features.join() !== FEATURE_NAMES.join()) throw new Error('Feature order differs from the model');

type Eval = number | { mate: number };
interface Row { user: string; wid: string; bid: string; wr: number; br: number; moves: string; evals: Eval[] }

const toCp = (e: Eval) => (typeof e === 'number' ? e : e.mate > 0 ? 10000 : -10000);

const perUser = new Map<string, { stats: GameStats[]; ratings: number[] }>();
for (const line of fs.readFileSync('ml/data/lichess_calibration_games.ndjson', 'utf8').split('\n')) {
  if (!line) continue;
  const g = JSON.parse(line) as Row;
  const user = g.user.toLowerCase();
  const color = g.wid === user ? 'w' : g.bid === user ? 'b' : null;
  if (!color) continue;
  const chess = new Chess();
  const moves: PlayedMove[] = [];
  const positions: PositionEval[] = [{ fen: chess.fen(), score: null, cp: 15, bestUci: null, bestSan: null }];
  g.moves.split(' ').forEach((san, i) => {
    moves.push(toPlayed(chess.move(san)));
    // The last move of a mate has no evaluation: the side that mated wins.
    const cp = i < g.evals.length ? toCp(g.evals[i]) : chess.turn() === 'w' ? -10000 : 10000;
    positions.push({ fen: chess.fen(), score: null, cp, bestUci: null, bestSan: null });
  });
  const analysis = { positions, moves: [], depth: 0 } as unknown as GameAnalysis;
  const stats = computeGameStats({ analysis, moves, color });
  if (!stats) continue;
  const u = perUser.get(user) ?? { stats: [], ratings: [] };
  u.stats.push(stats);
  u.ratings.push(color === 'w' ? g.wr : g.br);
  perUser.set(user, u);
}

const players = [...perUser.values()]
  .map((u) => ({ ...u, rating: u.ratings.reduce((s, r) => s + r, 0) / u.ratings.length }))
  .filter((u) => u.stats.length >= 20 && u.rating >= 809 && u.rating <= 2796);

// Seeded random subsets so the numbers are reproducible.
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const sample = <T>(a: T[], k: number) => [...a].sort(() => rand() - 0.5).slice(0, k);

const meanRating = players.reduce((s, p) => s + p.rating, 0) / players.length;
console.log(`${players.length} players, MAE of a constant guess: ${Math.round(players.reduce((s, p) => s + Math.abs(p.rating - meanRating), 0) / players.length)}`);
for (const k of [1, 3, 5, 10, 20, Infinity]) {
  const errs: number[] = [];
  for (let rep = 0; rep < (k === Infinity ? 1 : 10); rep++) {
    for (const p of players) {
      const games = k === Infinity ? p.stats : sample(p.stats, k);
      errs.push(Math.abs(evaluateLgbm(model, buildProfile(games)) - p.rating));
    }
  }
  const mae = errs.reduce((s, e) => s + e, 0) / errs.length;
  const within = errs.filter((e) => e <= 200).length / errs.length;
  console.log(`${k === Infinity ? 'all' : k} games: MAE ${Math.round(mae)}, within 200: ${Math.round(within * 100)}%`);
}

if (process.argv[2]) {
  // Dump the full profiles (all games) for a parity check with other implementations.
  const out = players.map((p) => ({ rating: p.rating, features: buildProfile(p.stats) }));
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
}
