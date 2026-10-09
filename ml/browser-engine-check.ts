// Re-analyses a sample of the Lichess games with the website's own engine
// (Stockfish 18 lite, same settings as src/lib/analysis.ts), so we can measure
// the model in the exact conditions of the website.
//
//   npx vite-node ml/browser-engine-check.ts [users=40] [gamesPerUser=5]
//
// Output: ml/data/browser-features.csv (same columns as features.csv)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import { judgeMoves, MATE_SCORE } from '../src/lib/analysis';
import { eloFeatures, FEATURE_NAMES } from '../src/lib/eloFeatures';

const require = createRequire(import.meta.url);
const { engine: startEngine } = require('../scripts/stockfish-node.cjs');

const DIR = path.join(process.cwd(), 'ml', 'data');
const [USERS, PER_USER] = [40, 5].map((d, i) => Number(process.argv[2 + i] ?? d));

// Same search settings as the website (src/lib/analysis.ts)
const GO = 'go depth 12 movetime 2000';

// Pick a reproducible sample of players and some of their own games
const games = fs.readFileSync(path.join(DIR, 'games.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byUser = new Map<string, any[]>();
for (const g of games) byUser.set(g.user, [...(byUser.get(g.user) ?? []), g]);
let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const users = [...byUser.keys()].filter((u) => byUser.get(u)!.length >= PER_USER).sort().sort(() => random() - 0.5).slice(0, USERS);
const sample = users.flatMap((u) => byUser.get(u)!.slice(0, PER_USER));
console.log(`${sample.length} games from ${users.length} players`);

const rows: string[] = [['game', 'player', 'collected_user', 'side', 'speed', 'rating', 'lichess_acpl', ...FEATURE_NAMES].join(',')];
let done = 0;
const queue = [...sample];
const engine = await startEngine();
{
  for (let g = queue.shift(); g; g = queue.shift()) {
    const chess = new Chess();
    const sans: string[] = g.moves.split(' ');
    const fens = [chess.fen()];
    sans.forEach((s) => { chess.move(s); fens.push(chess.fen()); });
    const evals: number[] = [];
    for (const fen of fens) {
      const c = new Chess(fen);
      if (c.isCheckmate()) evals.push(c.turn() === 'w' ? -MATE_SCORE : MATE_SCORE);
      else if (c.isDraw()) evals.push(0);
      else evals.push(await engine.evaluate(fen, GO));
    }
    const judged = judgeMoves(sans, evals, 'w');
    const result = g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2';
    for (const side of ['w', 'b'] as const) {
      const f = eloFeatures({ moves: judged, side, result });
      rows.push([g.id, side === 'w' ? g.wid : g.bid, g.user.toLowerCase(), side, g.speed, side === 'w' ? g.wr : g.br,
        g.lichess?.[side]?.acpl ?? '', ...f.map((x) => +x.toFixed(5))].join(','));
    }
    done++;
    if (done % 10 === 0) console.log(`${done}/${sample.length}`);
  }
  engine.quit();
}

fs.writeFileSync(path.join(DIR, 'browser-features.csv'), rows.join('\n') + '\n');
console.log('done');
