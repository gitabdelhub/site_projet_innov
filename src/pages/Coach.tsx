import { Link } from 'react-router-dom';
import { PUZZLES, THEMES, getPuzzlesByTheme } from '../data/puzzles';
import { POSITIONS } from '../data/positions';
import { useProgress, resetProgress } from '../lib/progress';
import { PageHeader } from '../components/PageHeader';
import { Icon, type IconName } from '../components/Icon';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';

const SECTIONS: { path: string; icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { path: '/coach/elo', icon: 'chart', title: 'nav.elo', text: 'coach.eloText' },
  { path: '/coach/tactics', icon: 'puzzle', title: 'nav.tactics', text: 'coach.tacticsText' },
  { path: '/coach/themes', icon: 'layers', title: 'nav.themes', text: 'coach.themesText' },
  { path: '/coach/position', icon: 'target', title: 'nav.positions', text: 'coach.positionsText' },
];

export const Coach: React.FC = () => {
  const { t } = useI18n();
  const progress = useProgress();
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
