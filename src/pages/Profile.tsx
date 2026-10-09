import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nProvider';

export const Profile = () => {
  const { user, signOut } = useAuth();
  const { t } = useI18n();

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-secondary mb-4">{t('profile.signInFirst')}</p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-5 rounded-xl">
            <Icon name="user" className="w-4 h-4" /> {t('nav.signIn')}
          </Link>
        </div>
      </div>
    );
  }

  const winRate = user.games_played > 0 ? Math.round((user.wins / user.games_played) * 100) : 0;
  const stats = [
    { value: user.elo_rating, label: t('profile.rating'), tone: 'text-accent' },
    { value: user.games_played, label: t('profile.games'), tone: 'text-text-primary' },
    { value: `${user.wins} / ${user.draws} / ${user.losses}`, label: t('profile.record'), tone: 'text-text-primary' },
    { value: `${winRate}%`, label: t('profile.winRate'), tone: 'text-text-primary' },
  ];

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="bg-bg-card border border-gray-200/80 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-5 mb-8">
            <span className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl uppercase">
              {user.username.slice(0, 2)}
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-text-primary">{user.username}</h1>
              <p className="text-text-secondary text-sm">{user.email}</p>
              <p className="text-text-secondary text-xs mt-1">{t(isSupabaseConfigured() ? 'profile.online' : 'profile.local')}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-bg-dark border border-gray-200/60 rounded-xl p-4 text-center">
                <dd className={`text-2xl font-bold ${s.tone}`}>{s.value}</dd>
                <dt className="text-text-secondary text-xs mt-1">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-bg-card border border-gray-200/80 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">{t('profile.account')}</h2>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 bg-danger/10 hover:bg-danger/15 text-danger font-bold py-2.5 px-4 rounded-xl border border-danger/20 transition-colors"
          >
            <Icon name="logout" className="w-4 h-4" /> {t('profile.signOut')}
          </button>
        </section>
      </div>
    </div>
  );
};
