import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Chess } from 'chess.js';
import type { Game, Message } from '../types/auth';
import { useAuth } from './useAuth';
import { soundEffects } from '../utils/soundEffects';

const loadInto = (chess: Chess, game: Pick<Game, 'pgn' | 'fen'>) => {
  try {
    if (game.pgn) chess.loadPgn(game.pgn);
    else chess.load(game.fen);
  } catch {
    chess.load(game.fen);
  }
};

// Online game. The browser only reads the game: moves go through /api/move
// (checked by the server), resignation and time-outs through database functions.
export const useMultiplayerGame = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const chessRef = useRef(new Chess());
  const [, setVersion] = useState(0); // re-render after the chess instance changes
  const [messages, setMessages] = useState<Message[]>([]);
  const [ratings, setRatings] = useState<{ white: number | null; black: number | null }>({ white: null, black: null });
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const serverOffsetRef = useRef(0); // database clock minus browser clock, in ms
  const claimingRef = useRef(false);
  const { user, refreshProfile } = useAuth();
  const configured = isSupabaseConfigured();

  const bump = () => setVersion((v) => v + 1);

  const fetchRatings = useCallback(async (g: Game) => {
    const { data } = await supabase.from('profiles').select('id, elo_rating').in('id', [g.white_player_id, g.black_player_id]);
    setRatings({
      white: data?.find((p) => p.id === g.white_player_id)?.elo_rating ?? null,
      black: data?.find((p) => p.id === g.black_player_id)?.elo_rating ?? null,
    });
  }, []);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!data) return;
    setGame(data);
    loadInto(chessRef.current, data);
    bump();
  }, [gameId]);

  useEffect(() => {
    setGame(null);
    setMessages([]);
    setError(null);
    chessRef.current = new Chess();
    bump();
    if (!gameId || !user || !configured) return;

    const chess = chessRef.current;

    // Line the browser clock up with the database clock
    const sent = Date.now();
    supabase.rpc('server_now').then(({ data }) => {
      if (data) serverOffsetRef.current = new Date(data as string).getTime() - (sent + Date.now()) / 2;
    });

    supabase.from('games').select('*').eq('id', gameId).single().then(({ data, error }) => {
      if (error || !data) {
        console.error('Error fetching game state:', error);
        return;
      }
      setGame(data);
      loadInto(chess, data);
      bump();
      fetchRatings(data);
    });

    supabase.from('messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true }).then(({ data }) => {
      setMessages(data || []);
    });

    const gameChannel = supabase
      .channel(`game_${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        const updated = payload.new as Game;
        const prevCount = chess.history().length;
        setGame(updated);
        loadInto(chess, updated);
        bump();

        if (chess.history().length > prevCount) {
          const last = chess.history({ verbose: true }).slice(-1)[0];
          if (chess.isCheckmate()) soundEffects.playGameOver(chess.turn() !== (updated.white_player_id === user.id ? 'w' : 'b'));
          else if (chess.isCheck()) soundEffects.playCheck();
          else if (last?.captured) soundEffects.playCapture();
          else soundEffects.playMove();
        }
        if (updated.status !== 'playing') {
          if (updated.status === 'completed' && !chess.isGameOver()) soundEffects.playGameOver(updated.winner === user.id);
          refreshProfile();
          fetchRatings(updated);
        }
      })
      .subscribe();

    const messageChannel = supabase
      .channel(`messages_${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message]));
      })
      .subscribe();

    return () => {
      gameChannel.unsubscribe();
      messageChannel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.id, configured]);

  // Clock: the database stores the time left when the turn started
  const playing = game?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [playing]);

  const turn = chessRef.current.turn();
  const elapsed = game?.turn_started_at && playing
    ? Math.max(0, now + serverOffsetRef.current - new Date(game.turn_started_at).getTime())
    : 0;
  const clock = {
    white: Math.max(0, (game?.white_ms ?? 0) - (turn === 'w' ? elapsed : 0)),
    black: Math.max(0, (game?.black_ms ?? 0) - (turn === 'b' ? elapsed : 0)),
  };
  const flagged = playing && game?.white_ms !== undefined && (turn === 'w' ? clock.white : clock.black) <= 0;

  // When a clock reaches zero, ask the database to confirm the time-out
  useEffect(() => {
    if (!flagged || !game || claimingRef.current) return;
    claimingRef.current = true;
    supabase.rpc('claim_timeout', { p_game_id: game.id }).then(() => {
      setTimeout(() => { claimingRef.current = false; }, 1000);
    });
  }, [flagged, game, now]);

  const makeMove = useCallback(async (from: string, to: string, promotion?: string) => {
    const chess = chessRef.current;
    if (!game || !user || game.status !== 'playing') return false;
    const myColor = game.white_player_id === user.id ? 'w' : 'b';
    if (chess.turn() !== myColor) return false;

    let move;
    try {
      move = chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    // Optimistic update: show the move immediately, the server has the final word
    bump();
    if (chess.isCheck()) soundEffects.playCheck();
    else if (move.captured) soundEffects.playCapture();
    else soundEffects.playMove();
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    let message: string | null = null;
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ gameId: game.id, from, to, promotion }),
      });
      if (!res.ok) message = (await res.json().catch(() => null))?.error ?? 'Your move was refused.';
    } catch {
      message = 'Your move could not be sent. Check your connection.';
    }

    if (message) {
      setError(message);
      await reload();
      return false;
    }
    return true;
  }, [game, user, reload]);

  const resign = useCallback(async () => {
    if (!game || game.status !== 'playing') return;
    const { error } = await supabase.rpc('resign_game', { p_game_id: game.id });
    if (error) setError('Could not resign. Check your connection.');
  }, [game]);

  // Cancel a game the opponent never started (no rating change)
  const canAbort = playing && (game?.ply ?? 0) < 2 && elapsed > 30000;
  const abort = useCallback(async () => {
    if (!game) return;
    await supabase.rpc('abort_game', { p_game_id: game.id });
  }, [game]);

  const sendMessage = async (content: string) => {
    if (!user || !game) return;
    const { error } = await supabase.from('messages').insert({ game_id: gameId, user_id: user.id, content: content.slice(0, 500) });
    if (error) console.error('Error sending message:', error);
  };

  return {
    game,
    chess: chessRef.current,
    messages,
    ratings,
    error,
    clock,
    hasClock: game?.white_ms !== undefined,
    canAbort,
    makeMove,
    resign,
    abort,
    sendMessage,
  };
};
