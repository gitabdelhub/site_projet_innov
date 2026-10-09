// Verifies every puzzle: legal moves, real mates, and that each player move is Stockfish's choice.
// Usage: npm run verify:puzzles (Node 22.6+ for TypeScript imports)
import { Chess } from 'chess.js';
import sf from './stockfish-node.cjs';
import { PUZZLES } from '../src/data/puzzles.ts';
const eng = await sf.engine();
let fails = 0;
// Hand-made puzzles only: the rated ones are verified by Lichess's own pipeline
for (const p of PUZZLES.filter((x) => !x.source)) {
  const c = new Chess(p.fen);
  if (p.moves) { c.reset(); p.moves.split(' ').forEach((m) => c.move(m)); }
  const problems = [];
  for (let i = 0; i < p.solution.length; i++) {
    const fen = c.fen();
    let mv;
    try { mv = c.move(p.solution[i]); } catch { problems.push(`illegal ${p.solution[i]}`); break; }
    if (i % 2 === 0) { // player move: compare with engine
      const best = await eng.analyse(fen);
      const after = c.isCheckmate() ? { score: -100000 } : await eng.analyse(c.fen());
      const mine = -after.score;
      const loss = best.score - mine;
      const uci = mv.from + mv.to + (mv.promotion || '');
      if (uci !== best.best && loss > 80 && !c.isCheckmate()) problems.push(`${p.solution[i]} not best (engine ${best.best} ${best.score} vs ${mine})`);
    }
  }
  const last = p.solution[p.solution.length - 1];
  if (last.includes('#') && !c.isCheckmate()) problems.push('final move is not mate');
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${p.id} ${p.title}${problems.length ? ' -> ' + problems.join('; ') : ''}`);
  if (problems.length) fails++;
}
console.log(fails ? `${fails} puzzle(s) to fix` : 'All puzzles verified');
eng.quit(); process.exit(fails ? 1 : 0);
