import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Leaderboard = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const configured = isSupabaseConfigured();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Without a database there is no real ranking to show: never display invented players
    if (!configured) {
      setLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, elo_rating, wins, losses, draws')
          .order('elo_rating', { ascending: false })
          .limit(50);

        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setError('The leaderboard could not be loaded. Try again in a moment.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [configured]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-text-secondary';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none text-text-primary">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-text-primary">Leaderboard</h1>
          <Link
            to="/"
            className="text-text-secondary hover:text-text-primary text-sm font-semibold transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="bg-bg-card border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-bg-darker border-b border-gray-200/50 flex justify-between items-center">
            <p className="text-text-secondary text-xs font-bold uppercase tracking-wider">
              🏆 Live Global Standings
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-secondary text-sm">Loading leaderboards...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="bg-bg-darker/60 text-left border-b border-gray-200/50">
                    <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-20">Rank</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Player</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">Rating</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-32">Wins/Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userItem, index) => (
                    <tr key={userItem.id} className="border-b border-gray-100 hover:bg-bg-darker/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`text-xl font-extrabold ${getRankColor(index + 1)}`}>
                          {getRankIcon(index + 1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-accent/10 border border-accent/25 rounded-full flex items-center justify-center text-accent font-extrabold text-sm uppercase">
                            {userItem.username[0]}
                          </div>
                          <span className="text-text-primary font-bold text-sm">{userItem.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-accent font-extrabold text-sm">{userItem.elo_rating} Elo</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-text-secondary font-semibold">
                        <span className="text-green-500">{userItem.wins}W</span>
                        <span className="mx-1">/</span>
                        <span className="text-red-500">{userItem.losses}L</span>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-text-secondary text-sm italic">
                        {!configured
                          ? 'The online leaderboard is off in local mode (no database configured).'
                          : error ?? 'No players registered yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 bg-bg-card border border-gray-200/80 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-text-secondary text-sm font-medium mb-4">
            🏆 Want to climb the leaderboard? Challenge players and win matches to boost your Elo rating!
          </p>
          <Link
            to="/game"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-8 rounded-xl text-sm transition-all shadow-sm shadow-accent/25 inline-block"
          >
            Play Now
          </Link>
        </div>
      </div>
    </div>
  );
};
