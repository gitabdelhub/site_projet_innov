import { Link } from 'react-router-dom';
import { FileSearch, Puzzle, TrendingUp, Swords, Brain, ArrowRight, ChevronRight } from 'lucide-react';
import { latestElo, useProgress } from '../lib/storage';
import { useI18n } from '../i18n';

export const Coach = () => {
  const { t } = useI18n();
  const progress = useProgress();
  const elo = latestElo(progress);
  const solved = progress.puzzles.filter((p) => p.solved).length;

  const cards = [
    { to: '/coach/analyse', icon: FileSearch, title: t('coach.analyse'), desc: t('coach.analyseDesc'), tint: 'bg-blue-50 border-blue-200 text-blue-600' },
    {
      to: elo ? `/coach/puzzles?elo=${elo}` : '/coach/puzzles',
      icon: Puzzle,
      title: t('coach.puzzles'),
      desc: t('coach.puzzlesDesc'),
      tint: 'bg-rose-50 border-rose-200 text-rose-600',
    },
    { to: '/coach/progress', icon: TrendingUp, title: t('coach.progress'), desc: t('coach.progressDesc'), tint: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
  ];

  const loop = [
    { icon: Swords, label: t('coach.loop1') },
    { icon: Brain, label: t('coach.loop2') },
    { icon: Puzzle, label: t('coach.loop3') },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-5xl font-black text-text-primary mb-3">{t('coach.title')}</h1>
        <p className="text-text-secondary max-w-2xl mx-auto">{t('coach.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10">
        {loop.map((s, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-bg-card border border-gray-200 rounded-full px-3 sm:px-4 py-2 shadow-sm">
              <s.icon size={16} className="text-accent" />
              <span className="text-xs sm:text-sm font-semibold text-text-primary">{s.label}</span>
            </div>
            {i < loop.length - 1 && <ArrowRight size={16} className="text-text-secondary" />}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${c.tint}`}>
              <c.icon size={24} />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-1 flex items-center justify-between">
              {c.title}
              <ChevronRight size={18} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" /> {t('coach.yourProgress')}
          </h3>
          <Link to="/coach/progress" className="text-sm font-semibold text-accent hover:underline">
            {t('coach.seeAll')}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { v: elo ?? '?', l: t('stats.predictedElo') },
            { v: progress.games.length, l: t('stats.games') },
            { v: solved, l: t('stats.puzzlesSolved') },
            { v: progress.puzzleRating || '?', l: t('stats.puzzleRating') },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl font-black text-accent">{s.v}</p>
              <p className="text-xs text-text-secondary">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
