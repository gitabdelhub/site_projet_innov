import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Icon, type IconName } from '../components/Icon';
import { SignInGate, Notice, ErrorText, ShareBox, Spinner } from '../components/TogetherParts';
import { LEVELS, PUZZLES, type LevelId } from '../data/puzzles';
import { loadProgress } from '../lib/progress';
import { puzzleDifficulty } from '../lib/adaptive';
import {
  acceptInvite, cancelInvite, createDuel, createInvite, createStudy, inviteInfo, normalizeCode, resolveCode, shareLink, type InviteInfo,
} from '../lib/together';
import { useI18n, pick } from '../i18n/I18nProvider';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TIME_CONTROLS = [[3, 2], [5, 3], [10, 0], [15, 10], [30, 0]] as const;
const DUEL_SIZE = 5;

const field = 'w-full bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-3 py-2 text-sm font-semibold focus:border-accent focus:outline-none';
const label = 'block text-[11px] font-bold text-text-secondary uppercase mb-1.5';
const primary = 'w-full inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors disabled:opacity-50';

const Card: React.FC<{ icon: IconName; title: string; text: string; children: React.ReactNode }> = ({ icon, title, text, children }) => (
  <section className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
    <span className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3">
      <Icon name={icon} className="w-5 h-5" />
    </span>
    <h2 className="text-lg font-bold text-text-primary mb-1">{title}</h2>
    <p className="text-sm text-text-secondary leading-relaxed mb-4 flex-1">{text}</p>
    <div className="space-y-3">{children}</div>
  </section>
);

// Random puzzles of a level, for a duel (both players get the same ones)
const duelPuzzles = (level: LevelId | 'mine') => {
  const target = loadProgress().puzzleRating;
  const range = LEVELS.find((l) => l.id === level);
  let pool = PUZZLES.filter((p) =>
    level === 'mine' ? Math.abs(puzzleDifficulty(p) - target) <= 200 : puzzleDifficulty(p) >= range!.min && puzzleDifficulty(p) < range!.max
  );
  if (pool.length < DUEL_SIZE) pool = PUZZLES;
  const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, DUEL_SIZE);
  return picked.sort((a, b) => puzzleDifficulty(a) - puzzleDifficulty(b)).map((p) => p.id);
};

// ---------- Hub: create a session or join one with a code ----------

export const Together: React.FC = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'friend' | 'training'>('friend');
  const [tc, setTc] = useState(2);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('random');
  const [duelLevel, setDuelLevel] = useState<LevelId | 'mine'>('mine');
  const [studyFen, setStudyFen] = useState('');
  const [code, setCode] = useState('');

  const run = async (what: string, action: () => Promise<{ data?: string | null; error?: string }>, path: (c: string) => string) => {
    setBusy(what);
    setError(null);
    const res = await action();
    setBusy(null);
    if (res.error || !res.data) setError(res.error ?? 'together.errNotFound');
    else navigate(path(res.data));
  };

  const join = () =>
    run('join', async () => {
      const c = normalizeCode(code);
      const res = await resolveCode(c);
      if (res.error !== undefined) return res;
      return res.data ? { data: `${res.data}/${c}` } : { error: 'together.errNotFound' };
    }, (p) => `/${p}`);

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="users" title={t('together.title')} subtitle={t('together.subtitle')} />
        <SignInGate>
          <div className="max-w-xl mx-auto mb-6 bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <form onSubmit={(e) => { e.preventDefault(); join(); }} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                placeholder={t('together.codePlaceholder')}
                aria-label={t('together.code')}
                className={`${field} font-mono tracking-widest uppercase`}
              />
              <button type="submit" disabled={code.length !== 6 || !!busy} className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary hover:bg-black text-white font-bold px-4 rounded-xl text-sm disabled:opacity-40 transition-colors">
                {busy === 'join' ? <Spinner /> : <Icon name="arrowRight" className="w-4 h-4" />} {t('together.join')}
              </button>
            </form>
          </div>
          <div className="max-w-xl mx-auto mb-6"><ErrorText error={error} /></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card icon="swords" title={t('together.friendTitle')} text={t('together.friendText')}>
              <div>
                <span className={label}>{t('together.gameType')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['friend', 'training'] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-xl text-xs font-bold border transition-colors ${mode === m ? 'bg-accent text-white border-accent' : 'bg-bg-dark border-gray-200 text-text-primary hover:bg-bg-darker'}`}>
                      {t(m === 'friend' ? 'together.casual' : 'together.training')}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-text-secondary mt-1.5">{t(mode === 'friend' ? 'together.casualHint' : 'together.trainingHint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={label}>{t('together.time')}</span>
                  <select value={tc} onChange={(e) => setTc(Number(e.target.value))} className={field}>
                    {TIME_CONTROLS.map(([m, s], i) => <option key={i} value={i}>{m} min + {s} s</option>)}
                  </select>
                </label>
                <label>
                  <span className={label}>{t('together.color')}</span>
                  <select value={color} onChange={(e) => setColor(e.target.value as typeof color)} className={field}>
                    <option value="random">{t('together.colorRandom')}</option>
                    <option value="w">{t('common.white')}</option>
                    <option value="b">{t('common.black')}</option>
                  </select>
                </label>
              </div>
              <button
                disabled={!!busy}
                onClick={() => run('invite', () => createInvite(mode, TIME_CONTROLS[tc][0], TIME_CONTROLS[tc][1], color), (c) => `/invite/${c}`)}
                className={primary}
              >
                {busy === 'invite' ? <Spinner /> : <Icon name="link" className="w-4 h-4" />} {t('together.createInvite')}
              </button>
            </Card>

            <Card icon="puzzle" title={t('together.duelTitle')} text={t('together.duelText', { n: DUEL_SIZE })}>
              <label className="block">
                <span className={label}>{t('together.duelLevel')}</span>
                <select value={duelLevel} onChange={(e) => setDuelLevel(e.target.value as typeof duelLevel)} className={field}>
                  <option value="mine">{t('together.duelMine', { rating: loadProgress().puzzleRating })}</option>
                  {LEVELS.map((l) => <option key={l.id} value={l.id}>{pick(l.label, lang)} ({l.range})</option>)}
                </select>
              </label>
              <button disabled={!!busy} onClick={() => run('duel', () => createDuel(duelPuzzles(duelLevel)), (c) => `/duel/${c}`)} className={primary}>
                {busy === 'duel' ? <Spinner /> : <Icon name="flame" className="w-4 h-4" />} {t('together.createDuel')}
              </button>
            </Card>

            <Card icon="book" title={t('together.studyTitle')} text={t('together.studyText')}>
              <label className="block">
                <span className={label}>{t('together.studyFen')}</span>
                <input value={studyFen} onChange={(e) => setStudyFen(e.target.value)} placeholder={t('together.studyFenPlaceholder')} className={`${field} font-mono text-xs`} />
              </label>
              <button disabled={!!busy} onClick={() => run('study', () => createStudy(studyFen.trim() || START_FEN), (c) => `/study/${c}`)} className={primary}>
                {busy === 'study' ? <Spinner /> : <Icon name="layers" className="w-4 h-4" />} {t('together.createStudy')}
              </button>
            </Card>
          </div>
        </SignInGate>
      </div>
    </div>
  );
};

// ---------- Friend invitation: the host waits, the friend accepts ----------

export const InvitePage: React.FC = () => {
  const { code: raw = '' } = useParams();
  const code = normalizeCode(raw);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans">
      <div className="max-w-xl mx-auto">
        <PageHeader icon="swords" title={t('together.inviteTitle')} />
        <SignInGate>
          <InviteBody code={code} info={info} setInfo={setInfo} error={error} setError={setError} busy={busy} setBusy={setBusy} navigate={navigate} />
        </SignInGate>
      </div>
    </div>
  );
};

const InviteBody: React.FC<{
  code: string;
  info: InviteInfo | null | undefined;
  setInfo: (i: InviteInfo | null) => void;
  error: string | null;
  setError: (e: string | null) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ code, info, setInfo, error, setError, busy, setBusy, navigate }) => {
  const { t } = useI18n();

  // Load the invitation; the host keeps checking until the friend has accepted
  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await inviteInfo(code);
      if (!active) return;
      if (res.error !== undefined) return setError(res.error);
      setInfo(res.data);
      if (res.data?.is_host && res.data.game_id) navigate(`/game?game=${res.data.game_id}`);
    };
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && info === undefined) return <ErrorText error={error} />;
  if (info === undefined) return <div className="text-center py-10"><Spinner /></div>;
  if (!info || info.expired) {
    return (
      <Notice icon="close" text={t('together.errNotFound')}>
        <Link to="/together" className="text-accent font-bold hover:underline">{t('together.backHub')}</Link>
      </Notice>
    );
  }

  const settings = t('together.settings', {
    type: t(info.mode === 'friend' ? 'together.casual' : 'together.training'),
    minutes: info.minutes,
    inc: info.increment_s,
  });

  if (info.is_host) {
    return (
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <p className="text-sm text-text-primary text-center">{t('together.inviteShare')}</p>
        <ShareBox code={code} link={shareLink(`/invite/${code}`)} />
        <p className="text-sm text-text-secondary text-center">{settings}</p>
        <p className="text-sm font-semibold text-text-primary text-center inline-flex items-center justify-center gap-2 w-full">
          <Spinner /> {t('together.waitingFriend')}
        </p>
        <button
          onClick={async () => { await cancelInvite(code); navigate('/together'); }}
          className="w-full text-xs font-bold text-text-secondary hover:text-red-600 py-2"
        >
          {t('together.cancel')}
        </button>
      </div>
    );
  }

  const yourColor = info.host_color === 'random' ? t('together.colorRandom').toLowerCase() : t(info.host_color === 'w' ? 'common.black' : 'common.white');
  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4 text-center">
      <p className="text-lg font-bold text-text-primary">{t('together.challenged', { name: info.host_username })}</p>
      <p className="text-sm text-text-secondary">{settings}</p>
      <p className="text-sm text-text-secondary">{t('together.youPlay', { color: yourColor })}</p>
      <ErrorText error={error} />
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await acceptInvite(code);
          setBusy(false);
          if (res.error !== undefined) setError(res.error);
          else navigate(`/game?game=${res.data}`);
        }}
        className={primary}
      >
        {busy ? <Spinner /> : <Icon name="play" className="w-4 h-4" />} {t('together.accept')}
      </button>
    </div>
  );
};
