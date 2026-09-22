import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { MatchmakingQueue, Game } from '../types/auth';
import { useAuth } from './useAuth';

export const useMatchmaking = () => {
  const [queue, setQueue] = useState<MatchmakingQueue[]>([]);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();
  
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!user || !configured) return;

    // Subscribe to matchmaking queue changes
    const queueSubscription = supabase
      .channel('matchmaking_queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_queue',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setQueue(prev => {
              // Avoid duplicates
              const next = payload.new as MatchmakingQueue;
              if (prev.some(item => item.id === next.id)) return prev;
              return [...prev, next];
            });
          } else if (payload.eventType === 'DELETE') {
            setQueue(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to game invitations
    const gameSubscription = supabase
      .channel('game_invitations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `black_player_id=eq.${user.id}`,
        },
        async (payload) => {
          const game = payload.new as Game;
          setCurrentGame(game);
          setIsSearching(false);
          
          // Remove from queue
          await supabase
            .from('matchmaking_queue')
            .delete()
            .eq('user_id', user.id);
        }
      )
      .subscribe();

    // Fetch current queue
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setQueue(data);
    };
    
    fetchQueue();

    return () => {
      queueSubscription.unsubscribe();
      gameSubscription.unsubscribe();
    };
  }, [user, configured]);

  const joinQueue = async () => {
    if (!user || !configured) return;

    try {
      setIsSearching(true);

      // Check if already in queue
      const { data: existing } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        setIsSearching(true);
        // Try to match again in case it was missed
        await findMatch();
        return;
      }

      // Add to queue
      const { error } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          username: user.username,
          elo_rating: user.elo_rating,
        });

      if (error) throw error;

      // Try to find a match
      await findMatch();
    } catch (error) {
      console.error('Error joining queue:', error);
      setIsSearching(false);
    }
  };

  const findMatch = async () => {
    if (!user || !configured) return;

    try {
      // Find a suitable opponent (within 150 Elo points, sorted by oldest first)
      const { data: opponents } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .gte('elo_rating', user.elo_rating - 150)
        .lte('elo_rating', user.elo_rating + 150)
        .order('created_at', { ascending: true })
        .limit(1);

      if (opponents && opponents.length > 0) {
        const opponent = opponents[0];

        // PREVENT RACE CONDITION: Check if a game was already created between us
        const { data: existingGames } = await supabase
          .from('games')
          .select('*')
          .eq('status', 'playing')
          .in('white_player_id', [user.id, opponent.user_id])
          .in('black_player_id', [user.id, opponent.user_id]);

        if (existingGames && existingGames.length > 0) {
          setCurrentGame(existingGames[0]);
          setIsSearching(false);
          
          // Remove from queue
          await supabase
            .from('matchmaking_queue')
            .delete()
            .eq('user_id', user.id);
          return;
        }

        // Create game (we are White, opponent is Black)
        const { data: game, error: gameError } = await supabase
          .from('games')
          .insert({
            white_player_id: user.id,
            black_player_id: opponent.user_id,
            white_player_username: user.username,
            black_player_username: opponent.username,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            pgn: '',
            status: 'playing',
            winner: null,
          })
          .select()
          .single();

        if (gameError) throw gameError;

        // Remove both players from queue
        await supabase
          .from('matchmaking_queue')
          .delete()
          .in('user_id', [user.id, opponent.user_id]);

        setCurrentGame(game);
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Error finding match:', error);
    }
  };

  const leaveQueue = async () => {
    if (!user || !configured) return;

    try {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      setIsSearching(false);
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  };

  return {
    queue,
    currentGame,
    isSearching,
    joinQueue,
    leaveQueue,
    setCurrentGame,
    isConfigured: configured,
  };
};
