import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X, FileSearch, Puzzle, TrendingUp, Trophy, LogIn, UserRound, Languages } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n';

export const Logo = () => (
  <Link to="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity shrink-0">
    <img src="/chess-icon.svg" alt="" className="w-8 h-8" />
    <span className="text-lg sm:text-xl font-black text-text-primary">Chess Hub</span>
  </Link>
);

const LangToggle = ({ compact = false }: { compact?: boolean }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className="flex items-center rounded-full border border-gray-200 bg-bg-dark p-0.5 text-xs font-bold"
      role="group"
      aria-label={t('nav.language')}
    >
      {!compact && <Languages size={14} className="text-text-secondary mx-1.5" />}
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 rounded-full uppercase transition-colors ${
            lang === l ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

export const Navigation = () => {
  const { t } = useI18n();
  const location = useLocation();
  const { user } = useAuth();
  const online = isSupabaseConfigured();
  const [coachOpen, setCoachOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation and on outside click.
  useEffect(() => {
    setCoachOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCoachOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const coachLinks = [
    { to: '/coach/analyse', icon: FileSearch, label: t('coach.analyse') },
    { to: '/coach/puzzles', icon: Puzzle, label: t('coach.puzzles') },
    { to: '/coach/progress', icon: TrendingUp, label: t('coach.progress') },
  ];

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold transition-colors ${isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`;
  const mobileCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
      isActive ? 'text-accent bg-accent/10' : 'text-text-primary hover:bg-bg-darker'
    }`;
  const coachActive = location.pathname.startsWith('/coach');

  return (
    <nav className="bg-bg-card/95 backdrop-blur border-b border-gray-200/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/" end className={linkCls}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/game" className={linkCls}>
              {t('nav.play')}
            </NavLink>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setCoachOpen((o) => !o)}
                className={`text-sm font-semibold flex items-center gap-1 transition-colors ${
                  coachActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
                aria-expanded={coachOpen}
              >
                {t('nav.coach')}
                <ChevronDown size={16} className={`transition-transform ${coachOpen ? 'rotate-180' : ''}`} />
              </button>
              {coachOpen && (
                <div className="absolute top-full right-0 mt-3 w-60 bg-bg-card border border-gray-200/80 rounded-xl shadow-lg p-1.5 animate-fade-in">
                  <Link to="/coach" className="block px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-secondary hover:text-accent">
                    {t('nav.coachHome')}
                  </Link>
                  {coachLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          isActive ? 'text-accent bg-accent/10' : 'text-text-primary hover:bg-bg-darker'
                        }`
                      }
                    >
                      <l.icon size={16} className="text-accent" />
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
            {online && (
              <NavLink to="/leaderboard" className={linkCls}>
                {t('nav.leaderboard')}
              </NavLink>
            )}
            {online &&
              (user ? (
                <NavLink to="/profile" className={linkCls}>
                  {t('nav.profile')}
                </NavLink>
              ) : (
                <NavLink to="/login" className={linkCls}>
                  {t('nav.signIn')}
                </NavLink>
              ))}
            <LangToggle />
          </div>

          <div className="flex md:hidden items-center gap-2">
            <LangToggle compact />
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-bg-darker text-text-primary"
              aria-label={t('nav.menu')}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 pt-1 space-y-1 border-t border-gray-200/50 animate-fade-in">
            <NavLink to="/" end className={mobileCls}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/game" className={mobileCls}>
              {t('nav.play')}
            </NavLink>
            <NavLink to="/coach" end className={mobileCls}>
              {t('nav.coach')}
            </NavLink>
            <div className="pl-4 space-y-1">
              {coachLinks.map((l) => (
                <NavLink key={l.to} to={l.to} className={mobileCls}>
                  <l.icon size={16} className="text-accent" />
                  {l.label}
                </NavLink>
              ))}
            </div>
            {online && (
              <NavLink to="/leaderboard" className={mobileCls}>
                <Trophy size={16} className="text-accent" /> {t('nav.leaderboard')}
              </NavLink>
            )}
            {online &&
              (user ? (
                <NavLink to="/profile" className={mobileCls}>
                  <UserRound size={16} className="text-accent" /> {t('nav.profile')}
                </NavLink>
              ) : (
                <NavLink to="/login" className={mobileCls}>
                  <LogIn size={16} className="text-accent" /> {t('nav.signIn')}
                </NavLink>
              ))}
          </div>
        )}
      </div>
    </nav>
  );
};
