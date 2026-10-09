import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nProvider';

interface Row {
  id: string;
  username: string;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
}

// Podium colours: gold, silver, bronze
const PODIUM = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

export const Leaderboard = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    // Without a database there is no real ranking to show: never display invented players
    if (!configured) {
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('id, username, elo_rating, wins, losses, draws')
      .order('elo_rating', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setFailed(true);
        setUsers((data as Row[]) || []);
        setLoading(false);
      });
  }, [configured]);

  const empty = !configured ? t('board.localMode') : failed ? t('board.failed') : t('board.empty');

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans text-text-primary">
      <div className="max-w-3xl mx-auto">
        <PageHeader icon="trophy" title={t('board.title')} subtitle={t('board.subtitle')} />

        <div className="bg-bg-card border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-secondary text-sm">{t('common.loading')}</p>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center py-12 px-6 text-text-secondary text-sm">{empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="bg-bg-darker/60 text-left border-b border-gray-200/50 text-xs font-bold text-text-secondary">
                    <th className="px-5 py-3 w-16">{t('board.rank')}</th>
                    <th className="px-5 py-3">{t('board.player')}</th>
                    <th className="px-5 py-3 text-right">{t('board.rating')}</th>
                    <th className="px-5 py-3 text-right w-36">{t('board.record')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row, i) => (
                    <tr key={row.id} className={`border-b border-gray-100 last:border-0 ${row.id === user?.id ? 'bg-accent/5' : ''}`}>
                      <td className="px-5 py-3">
                        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-xs font-extrabold ${PODIUM[i] ?? 'text-text-secondary'}`}>{i + 1}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent font-extrabold text-xs uppercase">{row.username.slice(0, 2)}</span>
                          <span className="font-bold text-sm">{row.username}</span>
                          {row.id === user?.id && <span className="text-[10px] font-bold text-accent">{t('board.you')}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-sm">{row.elo_rating}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold">
                        <span className="text-green-600">{row.wins}</span>
                        <span className="text-text-secondary"> / {row.draws} / </span>
                        <span className="text-red-500">{row.losses}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 bg-bg-card border border-gray-200/80 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-text-secondary text-sm mb-4">{t('board.cta')}</p>
          <Link to="/game" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors">
            <Icon name="board" className="w-4 h-4" /> {t('home.ctaPlay')}
          </Link>
        </div>
      </div>
    </div>
  );
};
