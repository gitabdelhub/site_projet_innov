// Turns the downloaded Lichess games into the training table, using the very
// same code as the website (judgeMoves + eloFeatures).
//
//   npx vite-node ml/build-features.ts
//
// Input: ml/data/games.ndjson   Output: ml/data/features.csv (one row per player per game)

import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';
import { judgeMoves, MATE_SCORE } from '../src/lib/analysis';
import { eloFeatures, FEATURE_NAMES } from '../src/lib/eloFeatures';

const DIR = path.join(process.cwd(), 'ml', 'data');
const START_EVAL = 20; // Lichess evaluation of the initial position, in centipawns

const toCp = (e: number | { mate: number }) =>
  typeof e === 'number' ? e : e.mate > 0 ? MATE_SCORE - e.mate : -MATE_SCORE - e.mate;

const rows: string[] = [['game', 'player', 'collected_user', 'side', 'speed', 'rating', 'lichess_acpl', ...FEATURE_NAMES].join(',')];
let kept = 0;
let skipped = 0;

for (const line of fs.readFileSync(path.join(DIR, 'games.ndjson'), 'utf8').split('\n')) {
  if (!line) continue;
  const g = JSON.parse(line);
  const chess = new Chess();
  const sans: string[] = g.moves.split(' ');
  try {
    sans.forEach((s) => chess.move(s));
  } catch {
    skipped++;
    continue;
  }

  const evals = [START_EVAL, ...g.evals.map(toCp)];
  // Lichess does not evaluate a final checkmate position: add it
  if (evals.length === sans.length && chess.isCheckmate()) evals.push(chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE);
  if (evals.length !== sans.length + 1) {
    skipped++;
    continue;
  }

  const judged = judgeMoves(sans, evals, 'w');
  const result = g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2';

  for (const side of ['w', 'b'] as const) {
    const features = eloFeatures({ moves: judged, side, result });
    const player = side === 'w' ? g.wid : g.bid;
    const rating = side === 'w' ? g.wr : g.br;
    const lichessAcpl = g.lichess?.[side]?.acpl ?? '';
    rows.push([g.id, player, g.user.toLowerCase(), side, g.speed, rating, lichessAcpl, ...features.map((f) => +f.toFixed(5))].join(','));
  }
  kept++;
}

fs.writeFileSync(path.join(DIR, 'features.csv'), rows.join('\n') + '\n');
console.log(`games kept: ${kept}, skipped: ${skipped}, rows: ${rows.length - 1}`);
