import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { isSupabaseConfigured } from '../lib/supabase';

export const Profile = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Please sign in to view your profile</p>
          <Link
            to="/login"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <Link
            to="/"
            className="text-text-secondary hover:text-text-primary"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="bg-bg-card rounded-lg p-8 mb-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center text-white font-bold text-4xl">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user.username}</h2>
              <p className="text-text-secondary">{user.email}</p>
              <p className="text-text-secondary text-sm mt-1">
                {isSupabaseConfigured() ? 'Online Account' : 'Guest Player (Local Mode)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-bg-darker rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-accent">{user.elo_rating}</p>
              <p className="text-text-secondary text-sm">Elo Rating</p>
            </div>
            <div className="bg-bg-darker rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-text-primary">{user.games_played}</p>
              <p className="text-text-secondary text-sm">Games Played</p>
            </div>
            <div className="bg-bg-darker rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{user.wins}</p>
              <p className="text-text-secondary text-sm">Wins</p>
            </div>
            <div className="bg-bg-darker rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{user.losses}</p>
              <p className="text-text-secondary text-sm">Losses</p>
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Account Settings</h3>
          <button
            onClick={signOut}
            className="bg-danger hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
