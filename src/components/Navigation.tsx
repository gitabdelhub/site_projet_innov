import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { Icon, type IconName } from './Icon';

const COACH_LINKS: { to: string; label: MessageKey; hint: MessageKey; icon: IconName }[] = [
  { to: '/coach/elo', label: 'nav.elo', hint: 'nav.eloHint', icon: 'chart' },
  { to: '/coach/tactics', label: 'nav.tactics', hint: 'nav.tacticsHint', icon: 'puzzle' },
  { to: '/coach/themes', label: 'nav.themes', hint: 'nav.themesHint', icon: 'layers' },
  { to: '/coach/position', label: 'nav.positions', hint: 'nav.positionsHint', icon: 'target' },
];

const LangSwitch = () => {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('nav.language')} className="flex items-center bg-bg-darker rounded-lg p-0.5 text-xs font-bold">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1.5 rounded-md uppercase transition-colors ${lang === l ? 'bg-bg-card text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

export const Navigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const [coachOpen, setCoachOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const coachRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  // Close menus when the page changes or when clicking elsewhere
  useEffect(() => {
    setCoachOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!coachOpen) return;
    const close = (e: MouseEvent) => {
      if (coachRef.current && !coachRef.current.contains(e.target as Node)) setCoachOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [coachOpen]);

  const linkClass = (path: string) =>
    `text-sm font-semibold transition-colors ${isActive(path) ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`;
  const accountLink = user
    ? { to: '/profile', label: t('nav.profile') }
    : { to: '/login', label: t('nav.signIn') };

  return (
    <nav className="bg-bg-card/95 backdrop-blur border-b border-gray-200/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
            <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center text-xl leading-none">♞</span>
            <span className="text-lg font-extrabold text-text-primary tracking-tight">Chess Hub</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            <Link to="/" className={linkClass('/')}>{t('nav.home')}</Link>
            <Link to="/game" className={linkClass('/game')}>{t('nav.play')}</Link>
            <div className="relative" ref={coachRef}>
              <button
                onClick={() => setCoachOpen((o) => !o)}
                aria-expanded={coachOpen}
                className={`${linkClass('/coach')} flex items-center gap-1`}
              >
                {t('nav.coach')}
                <Icon name="chevronDown" className={`w-4 h-4 transition-transform ${coachOpen ? 'rotate-180' : ''}`} />
              </button>
              {coachOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-bg-card border border-gray-200/80 rounded-2xl shadow-lg p-2 z-50">
                  {COACH_LINKS.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive(l.to) ? 'bg-accent/10' : 'hover:bg-bg-darker'}`}
                    >
                      <span className="mt-0.5 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Icon name={l.icon} className="w-[18px] h-[18px]" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-text-primary">{t(l.label)}</span>
                        <span className="block text-xs text-text-secondary leading-snug">{t(l.hint)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/leaderboard" className={linkClass('/leaderboard')}>{t('nav.leaderboard')}</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LangSwitch />
            <Link
              to={accountLink.to}
              className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                user ? 'text-text-primary hover:bg-bg-darker' : 'bg-text-primary text-white hover:bg-black'
              }`}
            >
              {user ? (
                <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-xs font-extrabold uppercase">
                  {user.username.slice(0, 2)}
                </span>
              ) : (
                <Icon name="user" className="w-4 h-4" />
              )}
              {user ? user.username : accountLink.label}
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={t('nav.menu')}
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-lg hover:bg-bg-darker transition-colors text-text-primary"
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} className="w-6 h-6" />
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1 border-t border-gray-200/50 pt-3">
            {[
              { to: '/', label: t('nav.home'), icon: 'home' as IconName },
              { to: '/game', label: t('nav.play'), icon: 'board' as IconName },
              ...COACH_LINKS.map((l) => ({ to: l.to, label: t(l.label), icon: l.icon })),
              { to: '/leaderboard', label: t('nav.leaderboard'), icon: 'trophy' as IconName },
              { to: accountLink.to, label: accountLink.label, icon: 'user' as IconName },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive(l.to) ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-darker'
                }`}
              >
                <Icon name={l.icon} className="w-[18px] h-[18px]" />
                {l.label}
              </Link>
            ))}
            <div className="px-3 pt-2"><LangSwitch /></div>
          </div>
        )}
      </div>
    </nav>
  );
};
