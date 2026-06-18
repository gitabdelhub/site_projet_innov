import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types/auth';

export const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();

    // Real-time subscription for leaderboard updates
    const channel = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('elo_rating', { ascending: false })
        .limit(10);

      if (error) throw error;

      setUsers(data as User[]);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-bg-card rounded-lg p-4">
        <h3 className="text-text-primary font-bold mb-3">Leaderboard</h3>
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-lg p-4">
      <h3 className="text-text-primary font-bold mb-3">Leaderboard</h3>
      <div className="space-y-2">
        {users.map((user, index) => (
          <div
            key={user.id}
            className="flex items-center justify-between bg-bg-darker rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-text-secondary font-bold w-6">
                {index + 1}
              </span>
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white font-bold text-sm">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-text-primary font-medium">{user.username}</span>
            </div>
            <span className="text-accent font-bold">{user.elo_rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
