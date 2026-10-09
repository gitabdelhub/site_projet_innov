import { Chess, type Move, type Square } from 'chess.js';
import type { MessageKey } from '../i18n/I18nProvider';
import type { AnalyzedMove } from './analysis';

// Explains a move in plain sentences, from what the move does on the board
// (captures, checks, threats, pieces left hanging) and from the engine's verdict.
// Pure function: the page passes its translator, the tests pass a dictionary.

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_KEY: Record<string, MessageKey> = {
  p: 'explain.p.pawn',
  n: 'explain.p.knight',
  b: 'explain.p.bishop',
  r: 'explain.p.rook',
  q: 'explain.p.queen',
  k: 'explain.p.king',
};

const CENTER = new Set(['d4', 'e4', 'd5', 'e5']);

// A piece is "hanging" when the opponent can take it and come out ahead:
// it is attacked and either undefended or attacked by a cheaper piece.
export const hangingPieces = (chess: Chess, color: 'w' | 'b') => {
  const enemy = color === 'w' ? 'b' : 'w';
  const out: { square: Square; type: string; value: number }[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const attackers = chess.attackers(p.square, enemy);
      if (!attackers.length) continue;
      const defended = chess.attackers(p.square, color).length > 0;
      const cheapest = Math.min(...attackers.map((s) => PIECE_VALUE[chess.get(s)!.type]));
      if (!defended || cheapest < PIECE_VALUE[p.type]) out.push({ square: p.square, type: p.type, value: PIECE_VALUE[p.type] });
    }
  }
  return out.sort((a, b) => b.value - a.value);
};

// Facts about a single move, in board terms
export const describeMove = (fenBefore: string, move: string, t: T): string[] => {
  const chess = new Chess(fenBefore);
  const before = chess.fen();
  let m: Move;
  try {
    m = chess.move(move);
  } catch {
    return [];
  }
  const piece = t(PIECE_KEY[m.piece]);
  const lines: string[] = [];

  if (m.isKingsideCastle() || m.isQueensideCastle()) lines.push(t('explain.castle'));
  else if (m.captured) lines.push(t('explain.capture', { piece, target: t(PIECE_KEY[m.captured]).toLowerCase(), square: m.to }));
  else lines.push(t('explain.goes', { piece, square: m.to }));

  if (m.promotion) lines.push(t('explain.promote', { piece: t(PIECE_KEY[m.promotion]).toLowerCase() }));
  if (chess.isCheckmate()) {
    lines.push(t('explain.mate'));
    return lines;
  }
  if (chess.isCheck()) lines.push(t('explain.check'));

  // Opening ideas: develop, take the center
  const moveNumber = parseInt(before.split(' ')[5], 10);
  if (moveNumber <= 10) {
    const backRank = m.color === 'w' ? '1' : '8';
    if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === backRank) lines.push(t('explain.develop'));
    if (m.piece === 'p' && CENTER.has(m.to)) lines.push(t('explain.center'));
    if (m.piece === 'q' && moveNumber <= 5 && !m.captured) lines.push(t('explain.earlyQueen'));
  }

  // New threats: enemy pieces this move leaves en prise to us
  const enemyHanging = hangingPieces(chess, m.color === 'w' ? 'b' : 'w').filter(
    (h) => chess.attackers(h.square, m.color).includes(m.to)
  );
  if (enemyHanging.length >= 2) lines.push(t('explain.fork', { piece }));
  else if (enemyHanging.length === 1)
    lines.push(t('explain.threat', { target: t(PIECE_KEY[enemyHanging[0].type]).toLowerCase(), square: enemyHanging[0].square }));

  // Our own pieces left hanging after the move (a fair trade does not count)
  const ours = hangingPieces(chess, m.color).filter(
    (h) => !(h.square === m.to && m.captured && PIECE_VALUE[m.captured] >= PIECE_VALUE[m.piece])
  );
  if (ours.length) lines.push(t('explain.hangs', { piece: t(PIECE_KEY[ours[0].type]).toLowerCase(), square: ours[0].square }));

  return lines;
};

const uciToSan = (fen: string, uci: string) => {
  try {
    const chess = new Chess(fen);
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
};

export interface Explanation {
  facts: string[]; // what the move does
  verdict: string; // the engine's judgement in words
  better?: { san: string; why: string[] }; // the engine's move, when clearly better
}

// Full explanation of a played move: facts, verdict, and the better move if there was one
export const explainMove = (fenBefore: string, played: AnalyzedMove, bestUci: string | null, t: T): Explanation => {
  const facts = describeMove(fenBefore, played.san, t);
  const pawns = Math.round(played.loss / 100);
  const verdict =
    played.category === 'best'
      ? t('explain.v.best')
      : played.category === 'good'
        ? t('explain.v.good')
        : played.category === 'inaccuracy'
          ? t('explain.v.inaccuracy')
          : t(played.category === 'blunder' ? 'explain.v.blunder' : 'explain.v.mistake', { n: Math.max(1, pawns) });

  let better: Explanation['better'];
  if (bestUci && played.category !== 'best' && played.category !== 'good') {
    const san = uciToSan(fenBefore, bestUci);
    if (san && san !== played.san) better = { san, why: describeMove(fenBefore, san, t) };
  }
  return { facts, verdict, better };
};
