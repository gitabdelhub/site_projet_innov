/**
 * Calibrates the free parameters of src/elo/features.ts (PARAMS) on real Lichess players.
 *
 *   npm run calibrate:elo                      evaluations from Lichess (in the data file)
 *   npm run calibrate:elo -- evals_d12.ndjson  evaluations from the site's own engine
 *
 * The second form uses a file of {id, cps} lines (White POV centipawns of every position,
 * mates as +/-10000) produced by analysing the calibration games with the browser engine.
 * The model was trained on another evaluation pipeline, so the parameters must be tuned
 * on the evaluations the site really produces.
 *
 * Honest score: players are split in two halves; parameters are chosen on one half and
 * measured on the other (and the other way round).
 */
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { buildProfile, computeGameStats, PARAMS, type FeatureParams, type GameStats } from '../src/elo/features';
import { evaluateLgbm, type LgbmModel } from '../src/elo/model';
import type { GameAnalysis } from '../src/engine/analysis';
import { toPlayed, type PlayedMove } from '../src/lib/chessGame';

const model = JSON.parse(fs.readFileSync('public/models/elo_lgbm.json', 'utf8')) as LgbmModel;
type Eval = number | { mate: number };
interface Row { id: string; user: string; wid: string; bid: string; wr: number; br: number; moves: string; evals: Eval[] }

const evalFile = process.argv[2];
const ours = new Map<string, number[]>();
if (evalFile) {
  for (const l of fs.readFileSync(evalFile, 'utf8').split('\n')) if (l) {
    const r = JSON.parse(l) as { id: string; cps: number[] };
    ours.set(r.id, r.cps);
  }
}

interface Game { user: string; rating: number; color: 'w' | 'b'; analysis: GameAnalysis; moves: PlayedMove[] }
const byUser = new Map<string, Game[]>();
for (const line of fs.readFileSync('ml/data/lichess_calibration_games.ndjson', 'utf8').split('\n')) {
  if (!line) continue;
  const g = JSON.parse(line) as Row;
  const user = g.user.toLowerCase();
  const color = g.wid === user ? 'w' : g.bid === user ? 'b' : null;
  if (!color) continue;
  if (evalFile && !ours.has(g.id)) continue;
  const chess = new Chess();
  const moves: PlayedMove[] = [];
  const fens = [chess.fen()];
  for (const san of g.moves.split(' ')) {
    moves.push(toPlayed(chess.move(san)));
    fens.push(chess.fen());
  }
  const cps = evalFile
    ? (ours.get(g.id) as number[])
    : [15, ...fens.slice(1).map((_, i) => {
        const e = g.evals[i];
        if (e === undefined) return new Chess(fens[i + 1]).turn() === 'w' ? -10000 : 10000;
        return typeof e === 'number' ? e : e.mate > 0 ? 10000 : -10000;
      })];
  const analysis = { positions: fens.map((fen, i) => ({ fen, cp: cps[i] })) } as unknown as GameAnalysis;
  const list = byUser.get(user) ?? [];
  list.push({ user, rating: color === 'w' ? g.wr : g.br, color, analysis, moves });
  byUser.set(user, list);
}
const players = [...byUser.values()]
  .map((games) => ({ games, rating: games.reduce((s, g) => s + g.rating, 0) / games.length }))
  .filter((p) => p.games.length >= 20 && p.rating >= 809 && p.rating <= 2796);
console.log(`${players.length} players, ${players.reduce((s, p) => s + p.games.length, 0)} games, evaluations: ${evalFile ?? 'Lichess'}`);

const predictAll = (P: FeatureParams) =>
  players.map((p) => {
    const stats = p.games.map((g) => computeGameStats({ analysis: g.analysis, moves: g.moves, color: g.color }, P)).filter(
      (s): s is GameStats => s !== null,
    );
    return evaluateLgbm(model, buildProfile(stats));
  });
const mae = (pred: number[], idx: number[]) => idx.reduce((s, i) => s + Math.abs(pred[i] - players[i].rating), 0) / idx.length;

const grid: FeatureParams[] = [];
for (const skipMoves of [2, 4, 6, 8, 10])
  for (const decidedCp of [300, 400, 500, 700, 1000])
    for (const criticalCp of [100, 150, 200, 300])
      for (const blunderCp of [200, 300]) grid.push({ ...PARAMS, skipMoves, decidedCp, criticalCp, blunderCp });

const all = players.map((_, i) => i);
const foldA = all.filter((i) => i % 2 === 0);
const foldB = all.filter((i) => i % 2 === 1);
const results = grid.map((P) => {
  const pred = predictAll(P);
  return { P, pred, all: mae(pred, all), a: mae(pred, foldA), b: mae(pred, foldB) };
});
const best = (k: 'all' | 'a' | 'b') => results.reduce((x, r) => (r[k] < x[k] ? r : x));
const cv = (mae(best('a').pred, foldB) * foldB.length + mae(best('b').pred, foldA) * foldA.length) / players.length;
const current = results.find((r) => JSON.stringify(r.P) === JSON.stringify(PARAMS));

const show = (P: FeatureParams) =>
  `skip ${P.skipMoves}, decided ${P.decidedCp}, critical ${P.criticalCp}, blunder ${P.blunderCp}`;
if (current) console.log(`current PARAMS (${show(PARAMS)}): MAE ${current.all.toFixed(1)}`);
console.log(`best on all players (${show(best('all').P)}): MAE ${best('all').all.toFixed(1)}`);
console.log(`honest 2 fold estimate (chosen on one half, measured on the other): MAE ${cv.toFixed(1)}`);
console.log('top 8:');
for (const r of [...results].sort((x, y) => x.all - y.all).slice(0, 8)) console.log(`  ${r.all.toFixed(1)}  ${show(r.P)}`);
const bias = best('all').pred.reduce((s, p, i) => s + p - players[i].rating, 0) / players.length;
console.log(`mean bias of the best setting: ${bias.toFixed(1)}`);
