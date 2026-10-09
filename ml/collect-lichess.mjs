// Collects rated Lichess games that Lichess already analysed with Stockfish,
// spread across all rating levels, to train and measure the Elo model.
//
//   node ml/collect-lichess.mjs [targetPerBand=300] [maxMinutes=90]
//
// Output: ml/data/games.ndjson (one compact game per line, appended; safe to resume).
// Follows the Lichess API rules: one request at a time, and a full minute pause after a 429.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const OUT = path.join(DIR, 'games.ndjson');
const TARGET = Number(process.argv[2] ?? 300);
const MAX_MINUTES = Number(process.argv[3] ?? 90);
const GAMES_PER_USER = 15;
const BANDS = Array.from({ length: 12 }, (_, i) => 600 + i * 200); // 600-799, ..., 2800-2999
const UA = 'chess-hub-school-project (Elo model research)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bandOf = (r) => BANDS.findIndex((b) => r >= b && r < b + 200);

fs.mkdirSync(DIR, { recursive: true });
const seenGames = new Set();
const visited = new Set();
const perBand = BANDS.map(() => 0);
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue;
    const g = JSON.parse(line);
    seenGames.add(g.id);
    visited.add(g.user);
    for (const r of [g.wr, g.br]) if (bandOf(r) >= 0) perBand[bandOf(r)] += 0.5;
  }
}
const candidates = new Map(); // username -> last seen rating

const get = async (url, accept) => {
  for (;;) {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA } });
    if (res.status === 429) {
      console.log('rate limited, waiting 65s');
      await sleep(65000);
      continue;
    }
    return res;
  }
};

// Seeds: players currently on Lichess TV (strong) and their opponents; we then walk down the ladder
const seed = await (await get('https://lichess.org/api/tv/channels', 'application/json')).json();
for (const c of ['blitz', 'rapid', 'classical', 'best']) if (seed[c]) candidates.set(seed[c].user.name, seed[c].rating);
for (const u of visited) candidates.delete(u);

// Pick the next player from the least-filled band; if none there, the closest unvisited player
const pickUser = () => {
  const order = BANDS.map((_, i) => i).sort((a, b) => perBand[a] - perBand[b]);
  for (const band of order) {
    if (perBand[band] >= TARGET) continue;
    const centre = BANDS[band] + 100;
    let best = null;
    for (const [name, r] of candidates) {
      if (visited.has(name)) continue;
      if (!best || Math.abs(r - centre) < Math.abs(best[1] - centre)) best = [name, r];
    }
    if (best) return best[0];
  }
  return null;
};

const started = Date.now();
while (Date.now() - started < MAX_MINUTES * 60000) {
  const user = pickUser();
  if (!user) break;
  visited.add(user);
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${GAMES_PER_USER}&rated=true&analysed=true&evals=true&perfType=blitz,rapid,classical&clocks=false&opening=false`;
  const res = await get(url, 'application/x-ndjson');
  if (!res.ok) {
    await sleep(1000);
    continue;
  }
  const lines = (await res.text()).split('\n').filter(Boolean);
  let kept = 0;
  for (const line of lines) {
    const g = JSON.parse(line);
    const w = g.players?.white;
    const b = g.players?.black;
    if (w?.user?.name) candidates.set(w.user.name, w.rating);
    if (b?.user?.name) candidates.set(b.user.name, b.rating);
    if (seenGames.has(g.id) || g.variant !== 'standard' || !g.analysis || !g.moves) continue;
    if (!w?.rating || !b?.rating || w.provisional || b.provisional || w.aiLevel || b.aiLevel) continue;
    if (w.user?.title === 'BOT' || b.user?.title === 'BOT') continue;
    const plies = g.moves.split(' ').length;
    if (plies < 20) continue;
    seenGames.add(g.id);
    fs.appendFileSync(OUT, JSON.stringify({
      id: g.id,
      user,
      speed: g.speed,
      initial: g.clock?.initial ?? null,
      increment: g.clock?.increment ?? null,
      wr: w.rating,
      br: b.rating,
      wid: w.user?.id ?? null,
      bid: b.user?.id ?? null,
      status: g.status,
      winner: g.winner ?? null,
      moves: g.moves,
      evals: g.analysis.map((a) => (a.mate !== undefined ? { mate: a.mate } : a.eval)),
      lichess: { w: w.analysis ?? null, b: b.analysis ?? null },
    }) + '\n');
    for (const r of [w.rating, b.rating]) if (bandOf(r) >= 0) perBand[bandOf(r)] += 0.5;
    kept++;
  }
  console.log(`${user}: +${kept}  bands=${perBand.map(Math.round).join(' ')}  total=${seenGames.size}`);
  await sleep(1000);
}
console.log('done', perBand.map(Math.round).join(' '));
