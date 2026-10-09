import React from 'react';
import { Link } from 'react-router-dom';
import { PUZZLES, THEMES, LEVELS, getPuzzlesByTheme } from '../data/puzzles';
import { useProgress } from '../lib/progress';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { useI18n, pick } from '../i18n/I18nProvider';

const DIFFICULTY_STYLE = {
  beginner: 'bg-green-500/10 text-green-700',
  intermediate: 'bg-amber-500/10 text-amber-700',
  advanced: 'bg-red-500/10 text-red-600',
} as const;

export const CoachThemes: React.FC = () => {
  const { t, lang } = useI18n();
  const progress = useProgress();
  const solvedIn = (themeId: string) => getPuzzlesByTheme(themeId as any).filter((p) => progress.solvedPuzzles.includes(p.id)).length;
  const themesCompleted = THEMES.filter((th) => solvedIn(th.id) === getPuzzlesByTheme(th.id).length).length;
  const accuracy = progress.puzzleAttempts > 0 ? Math.round((progress.puzzleFirstTry / progress.puzzleAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="layers" title={t('themes.title')} subtitle={t('themes.subtitle')} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {THEMES.map((theme) => {
            const total = getPuzzlesByTheme(theme.id).length;
            const solved = solvedIn(theme.id);
            const level = LEVELS.find((l) => l.id === theme.difficulty)!;
            return (
              <div key={theme.id} className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <span className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Icon name={theme.icon} className="w-6 h-6" />
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${DIFFICULTY_STYLE[theme.difficulty]}`}>{pick(level.label, lang)}</span>
                </div>
                <h2 className="font-bold text-text-primary text-lg mb-2">{pick(theme.name, lang)}</h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">{pick(theme.description, lang)}</p>
                <div className="w-full bg-bg-darker h-1.5 rounded-full overflow-hidden mb-3">
                  <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${(solved / total) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-text-secondary">{t('themes.solvedCount', { solved, total })}</span>
                  <Link to={`/coach/tactics?theme=${theme.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                    {t(solved === total ? 'themes.again' : solved > 0 ? 'themes.continue' : 'themes.start')}
                    <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-10 bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-text-primary text-lg mb-4">{t('common.yourProgress')}</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { v: `${themesCompleted}/${THEMES.length}`, l: t('themes.statThemes') },
              { v: `${progress.solvedPuzzles.length}/${PUZZLES.length}`, l: t('tactics.statSolved') },
              { v: `${accuracy}%`, l: t('tactics.statFirstTry') },
              { v: progress.streak, l: t('tactics.statStreak') },
            ].map((s) => (
              <div key={s.l}>
                <dd className="text-3xl font-bold text-accent mb-1">{s.v}</dd>
                <dt className="text-xs text-text-secondary">{s.l}</dt>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
};
