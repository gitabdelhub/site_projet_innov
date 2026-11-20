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
