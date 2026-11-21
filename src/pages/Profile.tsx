import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../online/auth';
import { api, colorOf, tcLabel, OnlineError, type OnlineGame } from '../online/api';
import { outcomeFor, type Color } from '../lib/chessGame';
import { pieceSrc } from '../components/board/Board';
import { OnlineChecking, OnlineUnavailable, useOnlineAvailable } from './OnlineLobby';
import { useI18n } from '../i18n';

export const Profile = () => {
  const { t } = useI18n();
  const available = useOnlineAvailable();
  const { user, loading, signOut, refreshProfile } = useAuth();
  const [games, setGames] = useState<OnlineGame[] | null>(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setName(user.username);
  }, [user]);
  useEffect(() => {
    if (available && user) api.recentGames(user.id, 30).then(setGames).catch(() => setGames([]));
  }, [available, user]);

  if (available === null || loading) return <OnlineChecking />;
  if (!available) return <OnlineUnavailable />;
  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary mb-4">{t('profile.signInFirst')}</p>
        <Link to="/login?next=/profile" className="bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-5 rounded-xl">
          {t('auth.signIn')}
        </Link>
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(name.trim())) {
      setMsg({ ok: false, text: t('profile.badUsername') });
      return;
    }
    setSaving(true);
    try {
      await api.setUsername(name.trim());
      await refreshProfile();
      setMsg({ ok: true, text: t('profile.saved') });
    } catch (err) {
      const code = err instanceof OnlineError ? err.code : 'network';
      setMsg({ ok: false, text: code === 'username_taken' ? t('profile.taken') : code === 'bad_username' ? t('profile.badUsername') : t('og.err.network') });
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: t('profile.rating'), value: user.elo_rating, cls: 'text-accent' },
    { label: t('profile.games'), value: user.games_played, cls: 'text-text-primary' },
    { label: t('profile.wins'), value: user.wins, cls: 'text-emerald-700' },
    { label: t('profile.draws'), value: user.draws, cls: 'text-text-secondary' },
    { label: t('profile.losses'), value: user.losses, cls: 'text-danger' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-2xl bg-accent text-white text-3xl font-black flex items-center justify-center">
            {user.username[0]?.toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary">{user.username}</h1>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-bg-card text-sm font-semibold text-text-primary hover:bg-bg-darker"
        >
          <LogOut size={16} /> {t('auth.signOut')}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 text-center shadow-sm">
            <p className={`text-2xl sm:text-3xl font-black font-mono ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-text-secondary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-1 px-2 pt-1">{t('online.myGames')}</p>
          {games === null ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-text-secondary" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-sm text-text-secondary px-2 py-4">{t('online.noGames')}</p>
          ) : (
            games.map((g) => {
              const c = colorOf(g, user.id) as Color;
              const outcome = g.result ? outcomeFor(g.result, c) : null;
              const delta = c === 'w' ? g.white_delta : g.black_delta;
              return (
                <Link key={g.id} to={`/online/${g.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-darker">
                  <img src={pieceSrc(c, 'k')} alt="" className="w-6 h-6" />
                  <span className="flex-1 min-w-0 text-sm font-bold text-text-primary truncate">
                    {t('online.vs')} {c === 'w' ? g.black_name : g.white_name}
                    <span className="ml-2 text-xs font-normal text-text-secondary">
                      {tcLabel(g.initial_ms, g.increment_ms)} · {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-bold rounded-full px-2 py-1 ${
                      outcome === 'win' ? 'bg-emerald-100 text-emerald-800' : outcome === 'loss' ? 'bg-red-100 text-danger' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {g.result ?? t('online.live')}
                  </span>
                  {delta !== null && (
                    <span className={`w-10 text-right text-xs font-mono ${delta >= 0 ? 'text-emerald-700' : 'text-danger'}`}>
                      {delta >= 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>

        <form onSubmit={save} className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
          <label className="block text-xs font-bold text-text-secondary mb-1">{t('profile.username')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="w-full bg-bg-dark rounded-xl px-3 py-2.5 border border-gray-200 focus:border-accent focus:outline-none mb-2"
          />
          <p className="text-[11px] text-text-secondary mb-3">{t('auth.usernameHint')}</p>
          {msg && <p className={`text-xs rounded-lg px-2 py-1.5 mb-3 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-danger'}`}>{msg.text}</p>}
          <button
            type="submit"
            disabled={saving || name.trim() === user.username}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            {t('profile.save')}
          </button>
        </form>
      </div>
    </div>
  );
};
