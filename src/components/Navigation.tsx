import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

export const Navigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [coachDropdownOpen, setCoachDropdownOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isCoachActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="bg-bg-card border-b border-gray-200/50 shadow-xs">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-black text-text-primary flex items-center gap-1.5 hover:opacity-85 transition-opacity">
            <span className="text-2xl text-accent">♞</span> Chess Hub
          </Link>

          <div className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Home
            </Link>
            <Link
              to="/game"
              className={`text-sm font-medium transition-colors ${
                isActive('/game') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Play
            </Link>
            <div className="relative">
              <button
                onClick={() => setCoachDropdownOpen(!coachDropdownOpen)}
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  isCoachActive('/coach') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                AI Coach
                <svg className={`w-4 h-4 transition-transform ${coachDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {coachDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-bg-card border border-gray-200/80 rounded-xl shadow-lg py-2 z-50">
                  <Link
                    to="/coach/elo"
                    onClick={() => setCoachDropdownOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive('/coach/elo') ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-darker'
                    }`}
                  >
                    📊 Elo Prediction
                  </Link>
                  <Link
                    to="/coach/tactics"
                    onClick={() => setCoachDropdownOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive('/coach/tactics') ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-darker'
                    }`}
                  >
                    ⚔️ Tactic Trainer
                  </Link>
                  <Link
                    to="/coach/position"
                    onClick={() => setCoachDropdownOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive('/coach/position') ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-darker'
                    }`}
                  >
                    🎯 Position Trainer
                  </Link>
                  <Link
                    to="/coach/themes"
                    onClick={() => setCoachDropdownOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive('/coach/themes') ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-darker'
                    }`}
                  >
                    🧩 Theme Analyzer
                  </Link>
                </div>
              )}
            </div>
            <Link
              to="/leaderboard"
              className={`text-sm font-medium transition-colors ${
                isActive('/leaderboard') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Leaderboard
            </Link>
            {user ? (
              <Link
                to="/profile"
                className={`text-sm font-medium transition-colors ${
                  isActive('/profile') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Profile
              </Link>
            ) : (
              <Link
                to="/login"
                className={`text-sm font-medium transition-colors ${
                  isActive('/login') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
