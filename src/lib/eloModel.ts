import model from '../data/eloModel.json';
import { FEATURE_NAMES } from './eloFeatures';

// Gradient-boosted trees trained by ml/train.py on public Lichess games.
// Each tree is stored as flat arrays: feature, threshold, left/right child, value.
interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] }

const trees = model.trees as Tree[];

if (model.features.join() !== FEATURE_NAMES.join()) {
  throw new Error('eloModel.json does not match eloFeatures.ts: rerun ml/build-features.ts and ml/train.py');
}

const leafValue = (tree: Tree, x: number[]) => {
  let node = 0;
  while (tree.l[node] !== -1) node = x[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node];
  return tree.v[node];
};

// Raw model output for one game (Lichess rating of the player who made these moves)
export const rawPrediction = (features: number[]) =>
  model.init + model.learningRate * trees.reduce((sum, tree) => sum + leafValue(tree, features), 0);

export const predictElo = (features: number[]) => Math.round(Math.max(400, Math.min(3000, rawPrediction(features))));

// Measured on players the model never saw: 80% of estimates are within ±error80 points
export const errorFor = (games: number) => {
  const measured = Object.keys(model.error80).map(Number).sort((a, b) => a - b);
  const n = [...measured].reverse().find((m) => m <= games) ?? measured[0];
  return (model.error80 as Record<string, number>)[String(n)];
};

// e.g. "3769 rated Lichess games (7538 player-games), ratings 421-3001"
const info = model.trainedOn.match(/^(\d+)\D.*?(\d+)-(\d+)$/);
export const MODEL_GAMES = info ? Number(info[1]) : 0;
export const MODEL_RANGE = info ? { min: Number(info[2]), max: Number(info[3]) } : { min: 0, max: 0 };
