/**
 * Online mode: calls to the Supabase functions defined in supabase-setup.sql.
 * The tables are read only for the site; every game action goes through a server
 * function that checks the turn, the move number and the clock.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Color, GameResult } from '../lib/chessGame';

export type OnlineStatus = 'waiting' | 'active' | 'finished' | 'aborted';

export interface OnlineGame {
  id: string;
  status: OnlineStatus;
  white_id: string | null;
  black_id: string | null;
  white_name: string | null;
  black_name: string | null;
  white_rating: number | null;
  black_rating: number | null;
  white_delta: number | null;
  black_delta: number | null;
  created_by: string | null;
  rated: boolean;
  initial_ms: number;
  increment_ms: number;
  white_ms: number;
  black_ms: number;
  start_fen: string;
  fen: string;
  moves: string[];
  sans: string[];
  spent_ms: number[];
  ply: number;
  last_move_at: string | null;
  result: GameResult | null;
  reason: string | null;
  draw_offer: string | null;
  rematch_offer: string | null;
  rematch_game: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface OnlineMessage {
  id: number;
  game_id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
}

export interface TimeControl {
  id: string;
  initialMin: number;
  incrementSec: number;
  kind: 'bullet' | 'blitz' | 'rapid' | 'classical';
}

/** Quick pairing presets, as on the big chess sites. */
export const ONLINE_TIME_CONTROLS: TimeControl[] = [
  { id: '1+0', initialMin: 1, incrementSec: 0, kind: 'bullet' },
  { id: '2+1', initialMin: 2, incrementSec: 1, kind: 'bullet' },
  { id: '3+0', initialMin: 3, incrementSec: 0, kind: 'blitz' },
  { id: '3+2', initialMin: 3, incrementSec: 2, kind: 'blitz' },
  { id: '5+0', initialMin: 5, incrementSec: 0, kind: 'blitz' },
  { id: '5+3', initialMin: 5, incrementSec: 3, kind: 'blitz' },
  { id: '10+0', initialMin: 10, incrementSec: 0, kind: 'rapid' },
  { id: '10+5', initialMin: 10, incrementSec: 5, kind: 'rapid' },
  { id: '15+10', initialMin: 15, incrementSec: 10, kind: 'rapid' },
  { id: '30+0', initialMin: 30, incrementSec: 0, kind: 'classical' },
];

export const tcMs = (tc: TimeControl) => ({ initial: tc.initialMin * 60000, increment: tc.incrementSec * 1000 });

export const tcLabel = (initialMs: number, incrementMs: number) => `${initialMs / 60000}+${incrementMs / 1000}`;

export const tcKind = (initialMs: number, incrementMs: number): TimeControl['kind'] => {
  // Estimated duration for 40 moves, same rule as Lichess.
  const est = initialMs / 1000 + (40 * incrementMs) / 1000;
  if (est < 180) return 'bullet';
  if (est < 480) return 'blitz';
  if (est < 1500) return 'rapid';
  return 'classical';
};

/** Delay to play the first move before the game is aborted (same value as the server). */
export const FIRST_MOVE_MS = 30000;

export const onlineConfigured = isSupabaseConfigured;

/** Error codes raised by the server functions. */
export type OnlineErrorCode =
  | 'not_signed_in'
  | 'no_profile'
  | 'game_not_found'
  | 'game_not_active'
  | 'not_your_turn'
  | 'stale_position'
  | 'bad_move'
  | 'bad_time_control'
  | 'bad_username'
  | 'username_taken'
  | 'network';

export class OnlineError extends Error {
  code: OnlineErrorCode;
  constructor(code: OnlineErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const KNOWN: OnlineErrorCode[] = [
  'not_signed_in',
  'no_profile',
  'game_not_found',
  'game_not_active',
  'not_your_turn',
  'stale_position',
  'bad_move',
  'bad_time_control',
  'bad_username',
  'username_taken',
];

const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = KNOWN.find((k) => error.message?.includes(k));
    throw new OnlineError(code ?? 'network', error.message);
  }
  return data as T;
};

export const api = {
  serverNow: () => rpc<number>('server_now_ms'),
  currentGame: () => rpc<string | null>('my_current_game'),
  findMatch: (initialMs: number, incrementMs: number) =>
    rpc<string | null>('find_match', { p_initial_ms: initialMs, p_increment_ms: incrementMs }),
  cancelSeek: () => rpc<void>('cancel_seek'),
  lobbyCounts: () => rpc<{ initial_ms: number; increment_ms: number; players: number }[]>('lobby_counts'),
  createChallenge: (initialMs: number, incrementMs: number, color: Color | 'random', rated: boolean) =>
    rpc<OnlineGame>('create_challenge', {
      p_initial_ms: initialMs,
      p_increment_ms: incrementMs,
      p_color: color,
      p_rated: rated,
    }),
  joinChallenge: (id: string) => rpc<OnlineGame>('join_challenge', { p_game: id }),
  playMove: (id: string, ply: number, uci: string, san: string, fen: string, result?: string, reason?: string) =>
    rpc<OnlineGame>('play_move', {
      p_game: id,
      p_ply: ply,
      p_uci: uci,
      p_san: san,
      p_fen: fen,
      p_result: result ?? null,
      p_reason: reason ?? null,
    }),
  resign: (id: string) => rpc<OnlineGame>('resign', { p_game: id }),
  abort: (id: string) => rpc<OnlineGame>('abort_game', { p_game: id }),
  offerDraw: (id: string) => rpc<OnlineGame>('offer_draw', { p_game: id }),
  declineDraw: (id: string) => rpc<OnlineGame>('decline_draw', { p_game: id }),
  claimTimeout: (id: string) => rpc<OnlineGame>('claim_timeout', { p_game: id }),
  offerRematch: (id: string) => rpc<OnlineGame>('offer_rematch', { p_game: id }),
  declineRematch: (id: string) => rpc<OnlineGame>('decline_rematch', { p_game: id }),
  setUsername: (name: string) => rpc<unknown>('set_username', { p_username: name }),

  getGame: async (id: string): Promise<OnlineGame | null> => {
    const { data, error } = await supabase.from('online_games').select('*').eq('id', id).maybeSingle();
    if (error) throw new OnlineError('network', error.message);
    return data as OnlineGame | null;
  },
  recentGames: async (userId: string, limit = 20): Promise<OnlineGame[]> => {
    const { data, error } = await supabase
      .from('online_games')
      .select('*')
      .or(`white_id.eq.${userId},black_id.eq.${userId}`)
      .in('status', ['finished', 'active'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new OnlineError('network', error.message);
    return (data ?? []) as OnlineGame[];
  },
  messages: async (gameId: string): Promise<OnlineMessage[]> => {
    const { data, error } = await supabase
      .from('online_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('id', { ascending: true })
      .limit(200);
    if (error) throw new OnlineError('network', error.message);
    return (data ?? []) as OnlineMessage[];
  },
  sendMessage: async (gameId: string, userId: string, username: string, body: string) => {
    const { error } = await supabase
      .from('online_messages')
      .insert({ game_id: gameId, user_id: userId, username, body: body.slice(0, 300) });
    if (error) throw new OnlineError('network', error.message);
  },
};

/** Color of a user in a game, or null for a spectator. */
export const colorOf = (g: OnlineGame, userId: string | null | undefined): Color | null => {
  if (!userId) return null;
  if (g.white_id === userId) return 'w';
  if (g.black_id === userId) return 'b';
  return null;
};

/** Side to move from the start position and the number of plies. */
export const sideToMove = (g: Pick<OnlineGame, 'start_fen' | 'ply'>): Color => {
  const first = (g.start_fen.split(' ')[1] ?? 'w') as Color;
  return g.ply % 2 === 0 ? first : first === 'w' ? 'b' : 'w';
};

/**
 * Checks once whether the Supabase project answers (a paused or deleted project
 * makes every call fail). Cached for the session.
 */
let health: Promise<boolean> | null = null;
export const onlineAvailable = (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return Promise.resolve(false);
  if (!health) {
    health = Promise.race([
      api
        .serverNow()
        .then((n) => Number.isFinite(Number(n)))
        .catch(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(false), 8000)),
    ]).then((ok) => {
      if (!ok) health = null; // try again next time
      return ok;
    });
  }
  return health;
};
