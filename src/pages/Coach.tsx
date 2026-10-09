import { Link } from 'react-router-dom';
import { PUZZLES, THEMES, getPuzzlesByTheme } from '../data/puzzles';
import { POSITIONS } from '../data/positions';
import { useProgress, resetProgress } from '../lib/progress';
import { PageHeader } from '../components/PageHeader';
import { Icon, type IconName } from '../components/Icon';
import { useI18n, pick, type MessageKey } from '../i18n/I18nProvider';
import { Sparkline } from '../components/Sparkline';
import { dueMistakes, suggestedLevel, weakThemes } from '../lib/adaptive';
import { LESSONS } from '../data/lessons';

const NEXT_LINK = 'inline-flex items-center justify-between gap-2 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors';

const SECTIONS: { path: string; icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { path: '/coach/tactics?mode=foryou', icon: 'sparkle', title: 'nav.forYou', text: 'coach.forYouText' },
  { path: '/coach/mistakes', icon: 'undo', title: 'nav.mistakes', text: 'coach.mistakesText' },
  { path: '/coach/elo', icon: 'chart', title: 'nav.elo', text: 'coach.eloText' },
  { path: '/coach/tactics', icon: 'puzzle', title: 'nav.tactics', text: 'coach.tacticsText' },
  { path: '/coach/themes', icon: 'layers', title: 'nav.themes', text: 'coach.themesText' },
  { path: '/coach/position', icon: 'target', title: 'nav.positions', text: 'coach.positionsText' },
];

export const Coach: React.FC = () => {
  const { t, lang } = useI18n();
  const progress = useProgress();
  const weak = weakThemes(progress);
  const due = dueMistakes(progress).length;
  const lastLevel = progress.levelHistory[progress.levelHistory.length - 1];
  const nextLesson = LESSONS.find((l) => !progress.lessonsDone.includes(l.id));
  const aiLevel = suggestedLevel(progress);
  const themesMastered = THEMES.filter((th) => getPuzzlesByTheme(th.id).every((p) => progress.solvedPuzzles.includes(p.id))).length;
  const stats = [
    { value: progress.gamesAnalyzed, label: t('coach.statGames') },
    { value: `${progress.solvedPuzzles.length}/${PUZZLES.length}`, label: t('tactics.statSolved') },
    { value: `${themesMastered}/${THEMES.length}`, label: t('themes.statThemes') },
    { value: `${progress.solvedPositions.length}/${POSITIONS.length}`, label: t('positions.statMastered') },
  ];

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-5xl mx-auto">
        <PageHeader icon="graduation" title={t('coach.title')} subtitle={t('coach.subtitle')} />

        <section className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Icon name="user" className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-text-primary text-lg leading-tight">{t('profile2.title')}</h2>
              <p className="text-xs text-text-secondary">{t('profile2.subtitle')}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-bg-dark/60 rounded-xl p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('profile2.level')}</dt>
              <dd className="text-2xl font-extrabold text-text-primary">{lastLevel ? lastLevel.elo : '—'}</dd>
              {progress.levelHistory.length > 1 ? (
                <Sparkline values={progress.levelHistory.map((l) => l.elo)} className="w-full h-8 mt-1" label={t('profile2.level')} />
              ) : (
                <Link to="/coach/elo" className="text-xs font-semibold text-accent hover:underline">{t('profile2.levelCta')}</Link>
              )}
            </div>
            <div className="bg-bg-dark/60 rounded-xl p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('adaptive.puzzleRating')}</dt>
              <dd className="text-2xl font-extrabold text-text-primary">{progress.puzzleRated ? progress.puzzleRating : '—'}</dd>
              {progress.puzzleHistory.length > 1 ? (
                <Sparkline values={progress.puzzleHistory} className="w-full h-8 mt-1" label={t('adaptive.puzzleRating')} />
              ) : (
                <Link to="/coach/tactics?mode=foryou" className="text-xs font-semibold text-accent hover:underline">{t('profile2.puzzleCta')}</Link>
              )}
            </div>
            <div className="bg-bg-dark/60 rounded-xl p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('elo.style')}</dt>
              <dd className="text-lg font-extrabold text-text-primary">{progress.style ? t(`elo.style.${progress.style}` as MessageKey) : '—'}</dd>
              <dd className="text-xs text-text-secondary leading-snug">{progress.style ? t(`elo.styleDesc.${progress.style}` as MessageKey) : t('profile2.styleUnknown')}</dd>
            </div>
            <div className="bg-bg-dark/60 rounded-xl p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('profile2.opponent')}</dt>
              <dd className="text-lg font-extrabold text-text-primary">{t('game.engineLevel', { n: aiLevel })}</dd>
              <dd className="text-xs text-text-secondary leading-snug">{t('profile2.opponentText', { games: progress.aiGames })}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">{t('profile2.weakTitle')}</h3>
              {weak.length ? (
                <ul className="space-y-2">
                  {weak.map((w) => {
                    const th = THEMES.find((x) => x.id === w.theme)!;
                    return (
                      <li key={w.theme}>
                        <Link to={`/coach/tactics?theme=${w.theme}`} className="flex items-center gap-3 group">
                          <Icon name={th.icon} className="w-4 h-4 text-accent shrink-0" />
                          <span className="flex-1 text-sm text-text-primary group-hover:text-accent">{pick(th.name, lang)}</span>
                          <span className="w-20 h-1.5 bg-bg-darker rounded-full overflow-hidden">
                            <span className="block h-full bg-orange-400 rounded-full" style={{ width: `${Math.round(w.rate * 100)}%` }} />
                          </span>
                          <span className="text-xs font-bold text-text-secondary w-9 text-right">{Math.round(w.rate * 100)}%</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t('profile2.weakUnknown')}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">{t('profile2.nextTitle')}</h3>
              <div className="flex flex-col gap-2">
                {nextLesson && progress.puzzleRating < 1200 && (
                  <Link to={`/learn/${nextLesson.id}`} className={NEXT_LINK}>
                    <span className="inline-flex items-center gap-2"><Icon name="graduation" className="w-4 h-4 text-accent" /> {t('profile2.nextLesson', { title: pick(nextLesson.title, lang) })}</span>
                    <Icon name="arrowRight" className="w-4 h-4 text-accent" />
                  </Link>
                )}
                {due > 0 && (
                  <Link to="/coach/mistakes" className={NEXT_LINK}>
                    <span className="inline-flex items-center gap-2"><Icon name="undo" className="w-4 h-4 text-accent" /> {t('profile2.nextMistakes', { n: due })}</span>
                    <Icon name="arrowRight" className="w-4 h-4 text-accent" />
                  </Link>
                )}
                <Link to="/coach/tactics?mode=foryou" className="inline-flex items-center justify-between gap-2 bg-accent hover:bg-accent-hover rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors">
                  <span className="inline-flex items-center gap-2"><Icon name="sparkle" className="w-4 h-4" /> {t('profile2.nextPuzzles')}</span>
                  <Icon name="arrowRight" className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SECTIONS.map((s) => (
            <Link
              key={s.path}
              to={s.path}
              className="group bg-bg-card border border-gray-200/80 rounded-2xl p-6 flex items-start gap-4 hover:border-accent/40 hover:shadow-md transition-all"
            >
              <span className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Icon name={s.icon} className="w-6 h-6" />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">{t(s.title)}</span>
                <span className="block text-sm text-text-secondary leading-relaxed">{t(s.text)}</span>
              </span>
              <Icon name="arrowRight" className="w-5 h-5 text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>

        <section className="mt-10 bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-text-primary text-lg mb-4">{t('common.yourProgress')}</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <dd className="text-3xl font-bold text-accent mb-1">{s.value}</dd>
                <dt className="text-xs text-text-secondary">{s.label}</dt>
              </div>
            ))}
          </dl>
          <button
            onClick={() => { if (window.confirm(t('coach.resetConfirm'))) resetProgress(); }}
            className="mt-5 text-[11px] text-text-secondary hover:text-danger underline"
          >
            {t('coach.reset')}
          </button>
        </section>
      </div>
    </div>
  );
};
