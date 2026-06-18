import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl &&
    supabaseUrl !== 'your_supabase_project_url' &&
    supabaseUrl !== 'YOUR_SUPABASE_URL' &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'your_supabase_anon_key' &&
    supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
    supabaseAnonKey.length > 20
  );
};

// Only create a real client if credentials are valid; otherwise use a safe fallback URL
// that won't throw on initialization.
const safeUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key-that-is-long-enough-to-not-crash';

export const supabase = createClient(safeUrl, safeKey);


export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          elo_rating: number;
          games_played: number;
          wins: number;
          losses: number;
          draws: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          email: string;
          elo_rating?: number;
          games_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          elo_rating?: number;
          games_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          white_player_id: string;
          black_player_id: string;
          white_player_username: string;
          black_player_username: string;
          fen: string;
          pgn: string;
          status: 'waiting' | 'playing' | 'completed' | 'aborted';
          winner: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          white_player_id: string;
          black_player_id: string;
          white_player_username: string;
          black_player_username: string;
          fen?: string;
          pgn?: string;
          status?: 'waiting' | 'playing' | 'completed' | 'aborted';
          winner?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          white_player_id?: string;
          black_player_id?: string;
          white_player_username?: string;
          black_player_username?: string;
          fen?: string;
          pgn?: string;
          status?: 'waiting' | 'playing' | 'completed' | 'aborted';
          winner?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      matchmaking_queue: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          elo_rating: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          elo_rating: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          elo_rating?: number;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          username: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          username: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          user_id?: string;
          username?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
};
