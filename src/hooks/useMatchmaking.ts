import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Game } from '../types/auth';
import { useAuth } from './useAuth';

const POLL_MS = 2000;

// Matchmaking runs in the database (join_queue): it reads the real rating,
// pairs players atomically and widens the rating window the longer you wait.
export const useMatchmaking = () => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const configured = isSupabaseConfigured();
  const searchingRef = useRef(false);

  const openGame = useCallback(async (gameId: string) => {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (data) {
      searchingRef.current = false;
      setIsSearching(false);
      setCurrentGame(data);
    }
  }, []);

  // One call both keeps our queue entry alive and tries to pair us
  const poll = useCallback(async () => {
    const { data, error } = await supabase.rpc('join_queue');
    if (error) {
      console.error('join_queue failed — did you run supabase-migration-v3.sql?', error);
      setError('Matchmaking is unavailable. Ask the admin to run supabase-migration-v3.sql.');
      searchingRef.current = false;
      setIsSearching(false);
      return;
    }
    if (data && searchingRef.current) await openGame(data as string);
  }, [openGame]);

  useEffect(() => {
    if (!isSearching || !user || !configured) return;
    const started = Date.now();
    const interval = setInterval(() => {
      setWaitedSeconds(Math.floor((Date.now() - started) / 1000));
      if (searchingRef.current) poll();
    }, POLL_MS);
    const leave = () => { supabase.rpc('leave_queue'); };
    window.addEventListener('beforeunload', leave);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', leave);
    };
  }, [isSearching, user, configured, poll]);

  // Leave the queue if the page is left during a search
  useEffect(() => () => {
    if (searchingRef.current) supabase.rpc('leave_queue').then(() => {});
  }, []);

  const joinQueue = async () => {
    if (!user || !configured) return;
    setError(null);
    setWaitedSeconds(0);
    searchingRef.current = true;
    setIsSearching(true);
    await poll();
  };

  const leaveQueue = async () => {
    searchingRef.current = false;
    setIsSearching(false);
    if (configured) await supabase.rpc('leave_queue');
  };

  // Back in the lobby with a game still running (page reloaded): offer to resume it
  const findOngoingGame = useCallback(async () => {
    if (!user || !configured) return null;
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'playing')
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as Game | null) ?? null;
  }, [user, configured]);

  return {
    currentGame,
    isSearching,
    waitedSeconds,
    // Same formula as join_queue()
    ratingWindow: Math.min(800, 100 + 10 * waitedSeconds),
    error,
    joinQueue,
    leaveQueue,
    setCurrentGame,
    findOngoingGame,
    isConfigured: configured,
  };
};
