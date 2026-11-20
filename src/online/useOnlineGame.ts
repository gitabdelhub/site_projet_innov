/**
 * State of one online game: live updates (Supabase Realtime, with polling as a
 * fallback), clocks synced on the server time, moves checked with chess.js before
 * they are sent, opponent presence and chat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { detectGameOver, fromUci, toPlayed, type Color, type PlayedMove } from '../lib/chessGame';
import { api, colorOf, FIRST_MOVE_MS, OnlineError, sideToMove, type OnlineGame, type OnlineMessage } from './api';
import { playSound } from './sounds';

const STATUS_RANK = { waiting: 0, active: 1, finished: 2, aborted: 2 } as const;

/** True if `next` is not older than `cur` (updates can arrive out of order). */
const isNewer = (cur: OnlineGame | null, next: OnlineGame) =>
  !cur ||
  next.ply > cur.ply ||
  (next.ply === cur.ply && STATUS_RANK[next.status] >= STATUS_RANK[cur.status]);

export interface Clocks {
  w: number;
  b: number;
  /** Time left to play the first move (before the game is aborted), or null. */
  firstMove: number | null;
}

export const useOnlineGame = (gameId: string | undefined, userId: string | null | undefined) => {
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<OnlineMessage[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const gameRef = useRef<OnlineGame | null>(null);
  const sending = useRef(false);
  const claimAt = useRef(0);

  const accept = useCallback((next: OnlineGame | null, sound = true) => {
    if (!next) return;
    const cur = gameRef.current;
    if (cur && cur.id === next.id && !isNewer(cur, next)) return;
    if (sound && cur && cur.id === next.id) {
      if (next.ply > cur.ply) {
        const san = next.sans[next.sans.length - 1] ?? '';
        playSound(san.includes('x') ? 'capture' : 'move');
      }
      if (cur.status !== next.status && (next.status === 'finished' || next.status === 'aborted')) playSound('end');
      if (cur.status === 'waiting' && next.status === 'active') playSound('notify');
      if (!cur.draw_offer && next.draw_offer && next.draw_offer !== userId) playSound('notify');
      if (!cur.rematch_offer && next.rematch_offer && next.rematch_offer !== userId) playSound('notify');
    }
    gameRef.current = next;
    setGame(next);
  }, [userId]);

  const refetch = useCallback(async () => {
    if (!gameId) return;
    try {
      const g = await api.getGame(gameId);
      if (!g) setNotFound(true);
      else accept(g);
    } catch {
      /* network hiccup: the next poll will retry */
    }
  }, [gameId, accept]);

  // Initial load and server clock offset.
  useEffect(() => {
    if (!gameId) return;
    gameRef.current = null;
    setGame(null);
    setNotFound(false);
    setMessages([]);
    const t0 = Date.now();
    api
      .serverNow()
      .then((server) => {
        const t1 = Date.now();
        offset.current = Number(server) - (t0 + t1) / 2;
      })
      .catch(() => undefined);
    void refetch();
  }, [gameId, refetch]);

  // Realtime: game row, chat and presence.
  useEffect(() => {
    if (!gameId) return;
    let channel: RealtimeChannel | null = supabase
      .channel(`game:${gameId}`, { config: { presence: { key: userId ?? `guest-${Math.random()}` } } })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'online_games', filter: `id=eq.${gameId}` },
        (payload) => accept(payload.new as OnlineGame),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'online_messages', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const m = payload.new as OnlineMessage;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
          if (m.user_id !== userId) playSound('notify');
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel?.presenceState() ?? {};
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          if (userId) void channel?.track({ at: Date.now() });
          // Catch up on anything missed while connecting.
          void refetch();
        }
      });
    return () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
  }, [gameId, userId, accept, refetch]);

  // Chat history (players only).
  useEffect(() => {
    if (!gameId || !userId) return;
    api
      .messages(gameId)
      .then((list) => setMessages((cur) => [...list, ...cur.filter((m) => !list.some((x) => x.id === m.id))]))
      .catch(() => undefined);
  }, [gameId, userId]);

  // Chat polling while realtime is down.
  useEffect(() => {
    if (!gameId || !userId || live) return;
    const id = setInterval(() => {
      api
        .messages(gameId)
        .then((list) => setMessages((cur) => (list.length === cur.length ? cur : list)))
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [gameId, userId, live]);

  // Polling: fast when realtime is down, slow otherwise (safety net). Refetch on focus.
  useEffect(() => {
    if (!gameId) return;
    const status = game?.status;
    if (status === 'finished' || status === 'aborted') {
      // Still poll slowly for a rematch offer.
      const id = setInterval(refetch, live ? 15000 : 3000);
      return () => clearInterval(id);
    }
    const id = setInterval(refetch, live ? 10000 : 2000);
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [gameId, live, game?.status, refetch]);

  // Clock tick.
  useEffect(() => {
    if (game?.status !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [game?.status]);

  const serverNow = now + offset.current;
  const turn: Color | null = game ? sideToMove(game) : null;

  const clocks: Clocks | null = useMemo(() => {
    if (!game) return null;
    const c = { w: game.white_ms, b: game.black_ms, firstMove: null as number | null };
    if (game.status !== 'active' || !game.last_move_at || !turn) return c;
    const elapsed = Math.max(0, serverNow - Date.parse(game.last_move_at));
    if (game.ply < 2) c.firstMove = Math.max(0, FIRST_MOVE_MS - elapsed);
    else c[turn] = Math.max(0, c[turn] - elapsed);
    return c;
  }, [game, turn, serverNow]);

  const myColor = game ? colorOf(game, userId) : null;

  // When a clock reaches 0 (or the first move does not come), ask the server to check.
  useEffect(() => {
    if (!game || game.status !== 'active' || !myColor || !clocks || !turn) return;
    const flagged = clocks.firstMove !== null ? clocks.firstMove <= 0 : clocks[turn] <= 0;
    if (!flagged || Date.now() - claimAt.current < 1500) return;
    claimAt.current = Date.now();
    api
      .claimTimeout(game.id)
      .then((g) => accept(g))
      .catch(() => undefined);
  }, [game, clocks, turn, myColor, accept]);

  // Low time warning for me (once under 10 s).
  const warned = useRef(false);
  useEffect(() => {
    if (!clocks || !myColor || game?.status !== 'active' || game.ply < 2) return;
    if (clocks[myColor] < 10000 && turn === myColor && !warned.current) {
      warned.current = true;
      playSound('low-time');
    }
    if (clocks[myColor] > 15000) warned.current = false;
  }, [clocks, myColor, turn, game?.status, game?.ply]);

  /** Moves as PlayedMove (for the move list, the review and the Elo model). */
  const played: PlayedMove[] = useMemo(() => {
    if (!game) return [];
    const chess = new Chess(game.start_fen);
    const list: PlayedMove[] = [];
    for (let i = 0; i < game.moves.length; i++) {
      try {
        const m = toPlayed(chess.move(fromUci(game.moves[i])));
        if (game.spent_ms[i] !== undefined) m.spentMs = game.spent_ms[i];
        list.push(m);
      } catch {
        break; // should not happen: every move was checked before being sent
      }
    }
    return list;
  }, [game]);

  const playMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const g = gameRef.current;
      if (!g || g.status !== 'active' || !myColor || sideToMove(g) !== myColor || sending.current) return false;
      const chess = new Chess(g.start_fen);
      for (const u of g.moves) chess.move(fromUci(u));
      let mv;
      try {
        mv = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      const over = detectGameOver(chess);
      const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
      // Optimistic update: the move is shown at once, the server confirms it.
      const elapsed = g.last_move_at ? Math.max(0, Date.now() + offset.current - Date.parse(g.last_move_at)) : 0;
      const key = myColor === 'w' ? 'white_ms' : 'black_ms';
      const optimistic: OnlineGame = {
        ...g,
        moves: [...g.moves, uci],
        sans: [...g.sans, mv.san],
        spent_ms: [...g.spent_ms, g.ply < 2 ? 0 : elapsed],
        fen: mv.after,
        ply: g.ply + 1,
        [key]: g.ply < 2 ? g[key] : Math.max(0, g[key] - elapsed) + g.increment_ms,
        last_move_at: new Date(Date.now() + offset.current).toISOString(),
        draw_offer: g.draw_offer === userId ? g.draw_offer : null,
      };
      gameRef.current = optimistic;
      setGame(optimistic);
      playSound(mv.captured ? 'capture' : 'move');
      sending.current = true;
      setError(null);
      api
        .playMove(g.id, g.ply, uci, mv.san, mv.after, over?.result, over?.reason)
        .then((server) => {
          gameRef.current = server;
          setGame(server);
          if (server.status === 'finished') playSound('end');
        })
        .catch((e: unknown) => {
          setError(e instanceof OnlineError ? e.code : 'network');
          gameRef.current = g;
          setGame(g);
          void refetch();
        })
        .finally(() => {
          sending.current = false;
        });
      return true;
    },
    [myColor, userId, refetch],
  );

  const act = useCallback(
    async (fn: (id: string) => Promise<OnlineGame>) => {
      const g = gameRef.current;
      if (!g) return;
      try {
        setError(null);
        const res = await fn(g.id);
        if (res && res.id === g.id) {
          gameRef.current = res;
          setGame(res);
        }
      } catch (e) {
        setError(e instanceof OnlineError ? e.code : 'network');
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (username: string, body: string) => {
      const text = body.trim();
      if (!gameId || !userId || !text) return;
      try {
        await api.sendMessage(gameId, userId, username, text);
        if (!live) {
          const list = await api.messages(gameId);
          setMessages(list);
        }
      } catch {
        setError('network');
      }
    },
    [gameId, userId, live],
  );

  const opponentId = game && myColor ? (myColor === 'w' ? game.black_id : game.white_id) : null;

  return {
    game,
    notFound,
    played,
    clocks,
    turn,
    myColor,
    live,
    error,
    clearError: () => setError(null),
    messages,
    // Presence is only known while the live connection works.
    opponentOnline: opponentId && live ? online.has(opponentId) : null,
    isOnline: (id: string | null): boolean | null => (id && live ? online.has(id) : null),
    playMove,
    resign: () => act(api.resign),
    abort: () => act(api.abort),
    offerDraw: () => act(api.offerDraw),
    declineDraw: () => act(api.declineDraw),
    offerRematch: () => act(api.offerRematch),
    declineRematch: () => act(api.declineRematch),
    join: () => act(api.joinChallenge),
    sendMessage,
    refetch,
  };
};
