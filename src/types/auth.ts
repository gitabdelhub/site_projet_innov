export interface User {
  id: string;
  email: string;
  username: string;
  elo_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface Game {
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
}

export interface Message {
  id: string;
  game_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface MatchmakingQueue {
  id: string;
  user_id: string;
  username: string;
  elo_rating: number;
  created_at: string;
}
