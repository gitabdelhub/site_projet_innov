import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Dices, Link2, Loader2, Play, Swords, Timer, WifiOff, Zap } from 'lucide-react';
import { useAuth } from '../online/auth';
import {
  api,
  colorOf,
  ONLINE_TIME_CONTROLS,
  onlineAvailable,
  tcLabel,
  tcMs,
  type OnlineGame,
  type TimeControl,
} from '../online/api';
import { playSound } from '../online/sounds';
import { AuthCard } from '../components/online/AuthCard';
import { pieceSrc } from '../components/board/Board';
import { outcomeFor, type Color } from '../lib/chessGame';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';

/** Online availability: null while checking. */
export const useOnlineAvailable = () => {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    onlineAvailable().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
};

export const OnlineUnavailable = () => {
  const { t } = useI18n();
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-bg-darker text-text-secondary flex items-center justify-center">
        <WifiOff size={28} />
      </div>
      <h1 className="text-2xl font-black text-text-primary mb-2">{t('online.unavailable')}</h1>
      <p className="text-text-secondary mb-6">{t('online.unavailableDesc')}</p>
      <Link
        to="/play"
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-bold px-5 py-3 rounded-xl"
      >
        <Bot size={18} /> {t('online.playEngine')}
      </Link>
    </div>
  );
};

export const OnlineChecking = () => {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-text-secondary">
      <Loader2 size={20} className="animate-spin" /> {t('online.checking')}
    </div>
  );
};

const fmtWait = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const KIND_ICON = { bullet: Zap, blitz: Zap, rapid: Timer, classical: Timer } as const;

const GameRow = ({ g, me }: { g: OnlineGame; me: string }) => {
  const { t } = useI18n();
  const color = colorOf(g, me) as Color;
  const opp = color === 'w' ? g.black_name : g.white_name;
  const oppRating = color === 'w' ? g.black_rating : g.white_rating;
  const delta = color === 'w' ? g.white_delta : g.black_delta;
  const outcome = g.result ? outcomeFor(g.result, color) : null;
  return (
    <Link
      to={`/online/${g.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-darker transition-colors"
    >
      <img src={pieceSrc(color, 'k')} alt="" className="w-6 h-6" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">
          {t('online.vs')} {opp ?? '?'} <span className="font-mono text-xs text-text-secondary">{oppRating}</span>
        </p>
        <p className="text-[11px] text-text-secondary">
          {tcLabel(g.initial_ms, g.increment_ms)} · {g.rated ? t('online.rated') : t('online.casual')} ·{' '}
          {new Date(g.created_at).toLocaleDateString()}
        </p>
      </div>
      {g.status === 'active' ? (
        <span className="text-xs font-bold text-accent bg-accent/10 rounded-full px-2 py-1">{t('online.live')}</span>
      ) : (
        <div className="text-right">
          <span
            className={`text-xs font-bold rounded-full px-2 py-1 ${
              outcome === 'win'
                ? 'bg-emerald-100 text-emerald-800'
                : outcome === 'loss'
                  ? 'bg-red-100 text-danger'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {g.result}
          </span>
          {delta !== null && (
            <p className={`text-[11px] font-mono mt-0.5 ${delta >= 0 ? 'text-emerald-700' : 'text-danger'}`}>
              {delta >= 0 ? `+${delta}` : delta}
            </p>
          )}
        </div>
      )}
    </Link>
  );
};

export const OnlineLobby = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const available = useOnlineAvailable();
  const { user, loading } = useAuth();
  const [searching, setSearching] = useState<TimeControl | null>(null);
  const [searchStart, setSearchStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [recent, setRecent] = useState<OnlineGame[] | null>(null);
  const [friendTc, setFriendTc] = useState('5+0');
  const [friendColor, setFriendColor] = useState<Color | 'random'>('random');
  const [rated, setRated] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<TimeControl | null>(null);

  // Current game and recent games.
  useEffect(() => {
    if (!available || !user) return;
    api.currentGame().then(setCurrent).catch(() => undefined);
    api.recentGames(user.id, 10).then(setRecent).catch(() => setRecent([]));
  }, [available, user]);

  // Players searching, per time control.
  useEffect(() => {
    if (!available) return;
    const load = () =>
      api
        .lobbyCounts()
        .then((rows) => {
          const c: Record<string, number> = {};
          for (const r of rows ?? []) c[tcLabel(r.initial_ms, r.increment_ms)] = Number(r.players);
          setCounts(c);
        })
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [available]);

  // Matchmaking loop: the server pairs players atomically; we poll every 1.5 s.
  useEffect(() => {
    searchRef.current = searching;
    if (!searching) return;
    let stop = false;
    const { initial, increment } = tcMs(searching);
    const tick = async () => {
      if (stop || searchRef.current !== searching) return;
      try {
        const id = await api.findMatch(initial, increment);
        if (stop || searchRef.current !== searching) return;
        if (id) {
          playSound('notify');
          setSearching(null);
          navigate(`/online/${id}`);
          return;
        }
      } catch {
        setError(t('og.err.network'));
      }
      if (!stop) timer = setTimeout(tick, 1500);
    };
    let timer = setTimeout(tick, 0);
    const clock = setInterval(() => setNow(Date.now()), 500);
    const leave = () => void api.cancelSeek().catch(() => undefined);
    window.addEventListener('pagehide', leave);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(clock);
      window.removeEventListener('pagehide', leave);
    };
  }, [searching, navigate, t]);

  // Leaving the page cancels the search.
  useEffect(
    () => () => {
      if (searchRef.current) void api.cancelSeek().catch(() => undefined);
    },
    [],
  );

  if (available === null || loading) return <OnlineChecking />;
  if (!available) return <OnlineUnavailable />;

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">{t('online.title')}</h1>
            <p className="text-text-secondary mb-6">{t('online.subtitle')}</p>
            <ul className="space-y-3 text-sm text-text-primary">
              {[t('online.quickDesc'), t('online.friendDesc'), t('online.ratedHint')].map((s) => (
                <li key={s} className="flex gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <AuthCard />
          </div>
        </div>
      </div>
    );
  }

  const startSearch = (tc: TimeControl) => {
    setError(null);
    setSearchStart(Date.now());
    setNow(Date.now());
    setSearching(tc);
  };
  const cancelSearch = () => {
    setSearching(null);
    void api.cancelSeek().catch(() => undefined);
  };

  const createChallenge = async () => {
    const tc = ONLINE_TIME_CONTROLS.find((x) => x.id === friendTc) ?? ONLINE_TIME_CONTROLS[4];
    const { initial, increment } = tcMs(tc);
    setCreating(true);
    setError(null);
    try {
      const g = await api.createChallenge(initial, increment, friendColor, rated);
      navigate(`/online/${g.id}`);
    } catch {
      setError(t('og.err.network'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-text-primary">{t('online.title')}</h1>
          <p className="text-text-secondary">{t('online.subtitle')}</p>
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-3 bg-bg-card border border-gray-200/80 rounded-xl px-3 py-2 hover:border-accent/50"
        >
          <span className="w-9 h-9 rounded-lg bg-accent text-white font-black flex items-center justify-center">
            {user.username[0]?.toUpperCase()}
          </span>
          <span>
            <span className="block text-sm font-bold text-text-primary">{user.username}</span>
            <span className="block text-xs font-mono text-text-secondary">
              {t('online.rating')} {user.elo_rating}
            </span>
          </span>
        </Link>
      </div>

      {current && (
        <Link
          to={`/online/${current}`}
          className="flex items-center justify-between gap-3 mb-5 bg-accent/10 border border-accent/40 rounded-2xl px-4 py-3 hover:bg-accent/15"
        >
          <span className="font-bold text-text-primary">{t('online.resume')}</span>
          <span className="flex items-center gap-1.5 bg-accent text-white font-bold text-sm px-3 py-1.5 rounded-lg">
            <Play size={16} /> {t('online.resumeGo')}
          </span>
        </Link>
      )}
      {error && <p className="mb-4 text-sm text-danger bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 shadow-sm relative">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Swords size={20} className="text-accent" /> {t('online.quick')}
          </h2>
          <p className="text-sm text-text-secondary mb-4">{t('online.quickDesc')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {ONLINE_TIME_CONTROLS.map((tc) => {
              const Icon = KIND_ICON[tc.kind];
              const n = counts[tc.id] ?? 0;
              return (
                <button
                  key={tc.id}
                  onClick={() => startSearch(tc)}
                  aria-label={`${tc.id} ${t(`online.kind.${tc.kind}` as MessageKey)}`}
                  disabled={!!searching || !!current}
                  className="group rounded-xl border border-gray-200 bg-bg-dark hover:border-accent hover:bg-accent/5 disabled:opacity-50 px-2 py-4 text-center transition-all"
                >
                  <span className="block text-2xl font-black text-text-primary font-mono">{tc.id}</span>
                  <span className="flex items-center justify-center gap-1 text-xs text-text-secondary mt-1">
                    <Icon size={12} /> {t(`online.kind.${tc.kind}` as MessageKey)}
                  </span>
                  <span className="block text-[10px] mt-1 h-3 text-accent font-bold">
                    {n > 0 && t('online.playersSearching', { n })}
                  </span>
                </button>
              );
            })}
          </div>

          {searching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-card/90 backdrop-blur-sm rounded-2xl p-4 animate-fade-in">
              <div className="text-center max-w-sm">
                <Loader2 size={40} className="mx-auto mb-3 animate-spin text-accent" />
                <p className="text-xl font-black text-text-primary">{t('online.searching')}</p>
                <p className="text-sm text-text-secondary">
                  {t('online.searchingIn', { tc: searching.id })} · {fmtWait(now - searchStart)}
                </p>
                <p className="text-xs text-text-secondary mt-2 mb-4">{t('online.searchingHint')}</p>
                <button
                  onClick={cancelSearch}
                  className="px-5 py-2.5 rounded-xl bg-bg-darker hover:bg-gray-200 text-sm font-bold text-text-primary"
                >
                  {t('online.cancelSearch')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Link2 size={20} className="text-accent" /> {t('online.friend')}
            </h2>
            <p className="text-sm text-text-secondary mb-4">{t('online.friendDesc')}</p>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {ONLINE_TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => setFriendTc(tc.id)}
                  className={`rounded-lg border py-1.5 text-xs font-bold font-mono transition-all ${
                    friendTc === tc.id ? 'border-accent bg-accent/10 ring-1 ring-accent text-text-primary' : 'border-gray-200 bg-bg-dark text-text-secondary'
                  }`}
                >
                  {tc.id}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['w', 'random', 'b'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFriendColor(c)}
                  aria-label={c === 'w' ? t('common.white') : c === 'b' ? t('common.black') : t('play.random')}
                  className={`flex items-center justify-center rounded-xl border py-2 transition-all ${
                    friendColor === c ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-gray-200 bg-bg-dark'
                  }`}
                >
                  {c === 'random' ? (
                    <Dices size={24} className="text-text-secondary" />
                  ) : (
                    <img src={pieceSrc(c, 'k')} alt="" className="w-7 h-7" />
                  )}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-bg-darker rounded-xl mb-4">
              {[true, false].map((r) => (
                <button
                  key={String(r)}
                  onClick={() => setRated(r)}
                  className={`py-1.5 rounded-lg text-xs font-bold ${rated === r ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-secondary'}`}
                >
                  {r ? t('online.rated') : t('online.casual')}
                </button>
              ))}
            </div>
            <button
              onClick={createChallenge}
              disabled={creating || !!current}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-bold py-3 rounded-xl"
            >
              {creating && <Loader2 size={18} className="animate-spin" />} {t('online.create')}
            </button>
          </div>

          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-1 px-2 pt-1">{t('online.myGames')}</p>
            {recent === null ? (
              <div className="flex justify-center py-6">
                <Loader2 size={18} className="animate-spin text-text-secondary" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-text-secondary px-2 py-4">{t('online.noGames')}</p>
            ) : (
              recent.map((g) => <GameRow key={g.id} g={g} me={user.id} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
