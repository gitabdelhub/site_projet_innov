import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Chess } from 'chess.js';
import type { Game, Message } from '../types/auth';
import { calculateEloChange } from '../lib/elo';
import { useAuth } from './useAuth';
import { soundEffects } from '../utils/soundEffects';

export const useMultiplayerGame = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [chess] = useState(() => new Chess());
  const [messages, setMessages] = useState<Message[]>([]);
  const { user } = useAuth();
  
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!gameId || !user || !configured) return;

    // Fetch initial game state
    fetchGameState();

    // Subscribe to game updates
    const gameSubscription = supabase
      .channel(`game_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game;
          setGame(updatedGame);
          
          const prevMoveCount = chess.history().length;
          if (updatedGame.pgn) {
            chess.loadPgn(updatedGame.pgn);
          } else {
            chess.load(updatedGame.fen);
          }
          const newMoveCount = chess.history().length;
          
          if (newMoveCount > prevMoveCount) {
            const history = chess.history({ verbose: true });
            const lastMove = history[history.length - 1];
            if (chess.isCheckmate()) {
              soundEffects.playGameOver(updatedGame.winner === user.id);
            } else if (chess.isDraw() || chess.isStalemate()) {
              soundEffects.playGameOver(false);
            } else if (chess.isCheck()) {
              soundEffects.playCheck();
            } else if (lastMove?.captured) {
              soundEffects.playCapture();
            } else {
              soundEffects.playMove();
            }
          }
        }
      )
      .subscribe();

    // Subscribe to messages
    const messageSubscription = supabase
      .channel(`messages_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    // Fetch initial messages
    fetchMessages();

    return () => {
      gameSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [gameId, user]);

  const fetchGameState = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) throw error;

      setGame(data);
      if (data.pgn) {
        chess.loadPgn(data.pgn);
      } else {
        chess.load(data.fen);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const makeMove = async (from: string, to: string, promotion?: string) => {
    if (!game || !user) return false;

    // Check if it's the user's turn
    const isWhitePlayer = game.white_player_id === user.id;
    const isBlackPlayer = game.black_player_id === user.id;
    const isUserTurn = (isWhitePlayer && chess.turn() === 'w') || (isBlackPlayer && chess.turn() === 'b');

    if (!isUserTurn) return false;

    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;

      // Update game state
      const { error } = await supabase
        .from('games')
        .update({
          fen: chess.fen(),
          pgn: chess.pgn(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      if (error) throw error;

      // Check for game end
      if (chess.isCheckmate() || chess.isDraw()) {
        await endGame(chess.isCheckmate() ? (chess.turn() === 'w' ? 'black' : 'white') : 'draw');
      }

      return true;
    } catch (error) {
      console.error('Error making move:', error);
      return false;
    }
  };

  const endGame = async (result: 'white' | 'black' | 'draw') => {
    if (!game) return;

    try {
      // Calculate Elo changes
      const whitePlayer = await supabase
        .from('profiles')
        .select('elo_rating, games_played, wins, losses, draws')
        .eq('id', game.white_player_id)
        .single();

      const blackPlayer = await supabase
        .from('profiles')
        .select('elo_rating, games_played, wins, losses, draws')
        .eq('id', game.black_player_id)
        .single();

      if (whitePlayer.data && blackPlayer.data) {
        const eloResult = calculateEloChange(
          whitePlayer.data.elo_rating,
          blackPlayer.data.elo_rating,
          result
        );

        // Update ratings
        await supabase
          .from('profiles')
          .update({ elo_rating: eloResult.newWhiteRating })
          .eq('id', game.white_player_id);

        await supabase
          .from('profiles')
          .update({ elo_rating: eloResult.newBlackRating })
          .eq('id', game.black_player_id);

        // Update game stats
        await supabase
          .from('profiles')
          .update({
            games_played: whitePlayer.data.games_played + 1,
            wins: result === 'white' ? whitePlayer.data.wins + 1 : whitePlayer.data.wins,
            losses: result === 'black' ? whitePlayer.data.losses + 1 : whitePlayer.data.losses,
            draws: result === 'draw' ? whitePlayer.data.draws + 1 : whitePlayer.data.draws,
          })
          .eq('id', game.white_player_id);

        await supabase
          .from('profiles')
          .update({
            games_played: blackPlayer.data.games_played + 1,
            wins: result === 'black' ? blackPlayer.data.wins + 1 : blackPlayer.data.wins,
            losses: result === 'white' ? blackPlayer.data.losses + 1 : blackPlayer.data.losses,
            draws: result === 'draw' ? blackPlayer.data.draws + 1 : blackPlayer.data.draws,
          })
          .eq('id', game.black_player_id);
      }

      // Update game status
      await supabase
        .from('games')
        .update({
          status: 'completed',
          winner: result === 'draw' ? null : (result === 'white' ? game.white_player_id : game.black_player_id),
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || !game) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          game_id: gameId,
          user_id: user.id,
          username: user.username,
          content,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return {
    game,
    chess,
    messages,
    makeMove,
    sendMessage,
  };
};
