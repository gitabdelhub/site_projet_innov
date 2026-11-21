import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../online/auth';
import { OnlineChecking, OnlineUnavailable, useOnlineAvailable } from './OnlineLobby';
import { useI18n } from '../i18n';

interface Row {
  id: string;
  username: string;
  elo_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

const MEDAL = ['bg-yellow-400 text-white', 'bg-gray-300 text-white', 'bg-amber-600 text-white'];

export const Leaderboard = () => {
  const { t } = useI18n();
  const available = useOnlineAvailable();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!available) return;
    supabase
      .from('profiles')
      .select('id, username, elo_rating, games_played, wins, losses, draws')
      .gt('games_played', 0)
      .order('elo_rating', { ascending: false })
      .order('games_played', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [available]);

  if (available === null) return <OnlineChecking />;
  if (!available) return <OnlineUnavailable />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-2 flex items-center justify-center gap-3">
          <Trophy className="text-accent" /> {t('lb.title')}
        </h1>
        <p className="text-text-secondary">{t('lb.subtitle')}</p>
      </div>
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
        {rows === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-text-secondary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-text-secondary mb-4">{t('lb.empty')}</p>
            <Link to="/online" className="inline-block bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 rounded-xl">
              {t('online.title')}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-darker text-text-secondary text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 w-14">#</th>
                <th className="text-left px-2 py-3">{t('lb.player')}</th>
                <th className="text-right px-2 py-3">{t('online.rating')}</th>
                <th className="text-right px-2 py-3 hidden sm:table-cell">{t('lb.games')}</th>
                <th className="text-right px-4 py-3">{t('lb.record')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-gray-100 ${r.id === user?.id ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-black ${
                        MEDAL[i] ?? 'text-text-secondary'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-bold text-text-primary">
                    {r.username}
                    {r.id === user?.id && <span className="ml-1 text-xs font-semibold text-accent">({t('lb.you')})</span>}
                  </td>
                  <td className="px-2 py-3 text-right font-mono font-bold text-text-primary">{r.elo_rating}</td>
                  <td className="px-2 py-3 text-right text-text-secondary hidden sm:table-cell">{r.games_played}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <span className="text-emerald-700">{r.wins}</span> / <span className="text-text-secondary">{r.draws}</span> /{' '}
                    <span className="text-danger">{r.losses}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
