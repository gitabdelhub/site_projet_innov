import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="bg-bg-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-primary font-bold">Profile</h3>
        <button
          onClick={signOut}
          className="text-sm text-text-secondary hover:text-danger transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-text-primary font-bold">{user.username}</p>
            <p className="text-text-secondary text-sm">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-bg-darker rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent">{user.elo_rating}</p>
            <p className="text-text-secondary text-xs">Elo Rating</p>
          </div>
          <div className="bg-bg-darker rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{user.games_played}</p>
            <p className="text-text-secondary text-xs">Games</p>
          </div>
          <div className="bg-bg-darker rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{user.wins}</p>
            <p className="text-text-secondary text-xs">Wins</p>
          </div>
          <div className="bg-bg-darker rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{user.losses}</p>
            <p className="text-text-secondary text-xs">Losses</p>
          </div>
        </div>
      </div>
    </div>
  );
};
