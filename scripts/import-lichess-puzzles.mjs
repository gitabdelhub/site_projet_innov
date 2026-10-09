// Picks ~300 puzzles from the public Lichess puzzle database (CC0), spread over
// our 7 themes and three difficulty levels, and writes src/data/lichessPuzzles.json.
//
//   curl -s https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | node scripts/import-lichess-puzzles.mjs [perTheme=45]
//
// The file is streamed and decompressed on the fly; reading stops as soon as
// every theme and level is filled. Lichess puzzles are already verified by
// their own Stockfish pipeline and voted on by players (popularity).

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'lichessPuzzles.json');
const PER_THEME = Number(process.argv[2] ?? 45);
const LEVELS = [[600, 1200], [1200, 1800], [1800, 2400]];
const PER_LEVEL = Math.ceil(PER_THEME / LEVELS.length);

const MATE_PATTERNS = ['smotheredMate', 'arabianMate', 'anastasiaMate', 'hookMate', 'doubleBishopMate', 'dovetailMate', 'bodenMate'];

// Our theme for a Lichess puzzle, or null. Checked in this order (most specific first).
const themeOf = (themes, firstSan) => {
  if (themes.includes('backRankMate')) return 'back-rank';
  if (MATE_PATTERNS.some((t) => themes.includes(t))) return 'mating-nets';
  if (themes.includes('sacrifice') && themes.some((t) => t.startsWith('mate')) && firstSan.startsWith('Q')) return 'queen-sacrifice';
  if (themes.includes('opening') && (themes.some((t) => t.startsWith('mate')) || themes.includes('trappedPiece'))) return 'opening-traps';
  if (themes.includes('promotion') || themes.includes('advancedPawn')) return 'pawn-promotion';
  if (themes.includes('pin') || themes.includes('skewer')) return 'pins-skewers';
  if (themes.includes('fork')) return 'forks';
  return null;
};

const picked = new Map(); // `${theme}-${level}` -> puzzles
const full = () => [...new Set(['back-rank', 'mating-nets', 'queen-sacrifice', 'opening-traps', 'pawn-promotion', 'pins-skewers', 'forks'])]
  .every((t) => LEVELS.every((_, l) => (picked.get(`${t}-${l}`)?.length ?? 0) >= PER_LEVEL));

const lines = readline.createInterface({ input: process.stdin });

let read = 0;
for await (const line of lines) {
  if (read++ === 0) continue; // header
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const [id, fen, movesText, rating, deviation, popularity, plays, themesText] = line.split(',');
  if (+popularity < 85 || +plays < 1000 || +deviation > 90) continue;
  const level = LEVELS.findIndex(([lo, hi]) => +rating >= lo && +rating < hi);
  if (level < 0) continue;
  const uci = movesText.split(' ');
  if (uci.length < 2 || uci.length > 8) continue; // at most 4 moves to find
  if (uci.some((m, i) => i % 2 === 1 && m.length === 5 && m[4] !== 'q')) continue; // the board always promotes to a queen

  let setup;
  const solution = [];
  try {
    const chess = new Chess(fen);
    setup = chess.move({ from: uci[0].slice(0, 2), to: uci[0].slice(2, 4), promotion: uci[0][4] }).san;
    for (const m of uci.slice(1)) solution.push(chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }).san);
  } catch {
    continue;
  }
  const theme = themeOf(themesText.split(' '), solution[0]);
  if (!theme) continue;
  const key = `${theme}-${level}`;
  const bucket = picked.get(key) ?? [];
  if (bucket.length >= PER_LEVEL) continue;
  bucket.push({ id: `li-${id}`, theme, rating: +rating, fen, setup, solution });
  picked.set(key, bucket);
  if (full()) break;
}

const puzzles = [...picked.values()].flat().sort((a, b) => a.theme.localeCompare(b.theme) || a.rating - b.rating);
fs.writeFileSync(OUT, JSON.stringify(puzzles, null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log(`read ${read} lines, kept ${puzzles.length} puzzles`);
for (const [key, list] of [...picked.entries()].sort()) console.log(key.padEnd(20), list.length);
process.exit(0); // stop the download that feeds stdin
