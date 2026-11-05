import { Chess, type Move as ChessMove } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type Color = 'w' | 'b';
export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty'
  | 'resign'
  | 'timeout'
  | 'agreement';

export interface GameOver {
  result: GameResult;
  reason: EndReason;
}

/** A played move, stored in a serialisable way. */
export interface PlayedMove {
  uci: string;
  san: string;
  from: string;
  to: string;
  color: Color;
  piece: string;
  captured?: string;
  promotion?: string;
  fenAfter: string;
  /** Time spent on this move, in ms (games played on the site, or PGN with %clk). */
  spentMs?: number;
  /** Clock of the mover after this move, in ms. */
  clockMs?: number;
}

export const toUci = (m: { from: string; to: string; promotion?: string }) =>
  `${m.from}${m.to}${m.promotion ?? ''}`;

export const fromUci = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? uci[4] : undefined,
});

export const toPlayed = (m: ChessMove): PlayedMove => ({
  uci: toUci(m),
  san: m.san,
  from: m.from,
  to: m.to,
  color: m.color,
  piece: m.piece,
  captured: m.captured,
  promotion: m.promotion,
  fenAfter: m.after,
});

/** Rebuilds a chess.js instance from a start position and a list of UCI moves. */
export const replay = (startFen: string, ucis: string[]): Chess => {
  const chess = new Chess(startFen);
  for (const u of ucis) chess.move(fromUci(u));
  return chess;
};

/** Natural end of the game according to the rules, or null if still running. */
export const detectGameOver = (chess: Chess): GameOver | null => {
  if (chess.isCheckmate()) {
    return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'threefold' };
  if (chess.isDraw()) return { result: '1/2-1/2', reason: 'fifty' };
  return null;
};

/** Outcome from the point of view of `color`. */
export const outcomeFor = (result: GameResult, color: Color): 'win' | 'loss' | 'draw' => {
  if (result === '1/2-1/2') return 'draw';
  return (result === '1-0') === (color === 'w') ? 'win' : 'loss';
};

/** Fen positions: index 0 is the start position, index i is after move i. */
export const positionsOf = (startFen: string, moves: PlayedMove[]): string[] => [
  startFen,
  ...moves.map((m) => m.fenAfter),
];

export interface PgnHeaders {
  [key: string]: string;
}

export const buildPgn = (startFen: string, moves: PlayedMove[], headers: PgnHeaders): string => {
  const chess = new Chess(startFen);
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, v);
  if (startFen !== START_FEN) {
    chess.setHeader('SetUp', '1');
    chess.setHeader('FEN', startFen);
  }
  for (const m of moves) {
    chess.move(fromUci(m.uci));
    if (m.clockMs !== undefined) chess.setComment(`[%clk ${formatClk(m.clockMs)}]`);
  }
  return chess.pgn();
};

const formatClk = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const parseClk = (comment: string | undefined): number | undefined => {
  const m = comment?.match(/\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/);
  if (!m) return undefined;
  return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
};

export interface ParsedPgn {
  startFen: string;
  moves: PlayedMove[];
  headers: PgnHeaders;
}

/** Parses a PGN; throws an Error with a readable message if it is invalid. */
export const parsePgn = (pgn: string): ParsedPgn => {
  const chess = new Chess();
  chess.loadPgn(pgn.trim());
  const headers = chess.getHeaders() as PgnHeaders;
  const startFen = headers.FEN ?? START_FEN;
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));
  const moves = chess.history({ verbose: true }).map((m) => {
    const played = toPlayed(m);
    const clk = parseClk(comments.get(m.after));
    if (clk !== undefined) played.clockMs = clk;
    return played;
  });
  if (moves.length === 0) throw new Error('empty');
  // Time spent per move from consecutive clocks of the same side (+ increment if known).
  const inc = Number((headers.TimeControl ?? '').split('+')[1] ?? 0) * 1000 || 0;
  const lastClock: Record<string, number | undefined> = {};
  for (const m of moves) {
    const prev = lastClock[m.color];
    if (m.clockMs !== undefined && prev !== undefined) m.spentMs = Math.max(0, prev - m.clockMs + inc);
    lastClock[m.color] = m.clockMs;
  }
  return { startFen, moves, headers };
};

export const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Captured pieces and material balance computed from a FEN. */
export const materialFromFen = (fen: string) => {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } } as Record<
    Color,
    Record<string, number>
  >;
  for (const ch of fen.split(' ')[0]) {
    const lower = ch.toLowerCase();
    if (!(lower in start)) continue;
    count[ch === lower ? 'b' : 'w'][lower]++;
  }
  const lost = (c: Color) =>
    Object.keys(start).flatMap((t) => Array(Math.max(0, start[t] - count[c][t])).fill(t) as string[]);
  const score = (c: Color) => Object.keys(start).reduce((s, t) => s + count[c][t] * pieceValue[t], 0);
  return {
    /** Black pieces captured by White. */
    capturedByWhite: lost('b'),
    capturedByBlack: lost('w'),
    balance: score('w') - score('b'),
  };
};

/** Splits a PGN file that contains several games (Lichess / Chess.com exports). */
export const splitPgnGames = (text: string): string[] => {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  // A new game starts at a header line that follows a blank line (or the start of the file).
  const parts = normalized.split(/\n\s*\n(?=\[Event\s)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
};
