import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Chess } from 'chess.js';
import type { Game, Message } from '../types/auth';
import { useAuth } from './useAuth';
import { soundEffects } from '../utils/soundEffects';
import { getGameResult } from './useChessGame';

type ResultCode = 'white' | 'black' | 'draw';

const loadInto = (chess: Chess, game: Pick<Game, 'pgn' | 'fen'>) => {
  try {
    if (game.pgn) chess.loadPgn(game.pgn);
    else chess.load(game.fen);
  } catch {
    chess.load(game.fen);
  }
};

export const useMultiplayerGame = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const chessRef = useRef(new Chess());
  const [, setVersion] = useState(0); // re-render after the chess instance changes
  const [messages, setMessages] = useState<Message[]>([]);
  const [ratings, setRatings] = useState<{ white: number | null; black: number | null }>({ white: null, black: null });
  const [error, setError] = useState<string | null>(null);
  const { user, refreshProfile } = useAuth();
  const configured = isSupabaseConfigured();
  const finishingRef = useRef(false);

  const bump = () => setVersion((v) => v + 1);

  const fetchRatings = useCallback(async (g: Game) => {
    const { data } = await supabase.from('profiles').select('id, elo_rating').in('id', [g.white_player_id, g.black_player_id]);
    setRatings({
      white: data?.find((p) => p.id === g.white_player_id)?.elo_rating ?? null,
      black: data?.find((p) => p.id === g.black_player_id)?.elo_rating ?? null,
    });
  }, []);

  useEffect(() => {
    setGame(null);
    setMessages([]);
    setError(null);
    finishingRef.current = false;
    chessRef.current = new Chess();
    bump();
    if (!gameId || !user || !configured) return;

    const chess = chessRef.current;

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
        if (updated.status === 'completed') {
          if (!chess.isGameOver()) soundEffects.playGameOver(updated.winner === user.id);
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

  const finishGame = useCallback(async (result: ResultCode, reason: string) => {
    if (!game || finishingRef.current) return;
    finishingRef.current = true;
    const { error } = await supabase.rpc('finish_game', { p_game_id: game.id, p_result: result, p_reason: reason });
    if (error) {
      finishingRef.current = false;
      console.error('finish_game failed — did you run supabase-migration-v2.sql?', error);
      setError('Could not record the result. Ask the admin to run supabase-migration-v2.sql.');
      return;
    }
    refreshProfile();
  }, [game, refreshProfile]);

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
    // Optimistic update: show the move immediately, roll back if the server refuses it
    bump();
    if (chess.isCheck()) soundEffects.playCheck();
    else if (move.captured) soundEffects.playCapture();
    else soundEffects.playMove();

    const { error } = await supabase
      .from('games')
      .update({ fen: chess.fen(), pgn: chess.pgn(), updated_at: new Date().toISOString() })
      .eq('id', game.id);

    if (error) {
      console.error('Error making move:', error);
      chess.undo();
      bump();
      setError('Your move could not be sent. Check your connection.');
      return false;
    }

    const result = getGameResult(chess);
    if (result) {
      await finishGame(result.winner === null ? 'draw' : result.winner === 'w' ? 'white' : 'black', result.reason);
    }
    return true;
  }, [game, user, finishGame]);

  const resign = useCallback(async () => {
    if (!game || !user || game.status !== 'playing') return;
    await finishGame(game.white_player_id === user.id ? 'black' : 'white', 'resignation');
  }, [game, user, finishGame]);

  const sendMessage = async (content: string) => {
    if (!user || !game) return;
    const { error } = await supabase.from('messages').insert({ game_id: gameId, user_id: user.id, username: user.username, content });
    if (error) console.error('Error sending message:', error);
  };

  return {
    game,
    chess: chessRef.current,
    messages,
    ratings,
    error,
    makeMove,
    resign,
    sendMessage,
  };
};
