import { Link } from 'react-router-dom';
import { Brain, Swords, Puzzle, Target, TrendingDown, FileSearch, Trash2 } from 'lucide-react';
import { latestElo, updateProgress, useProgress } from '../lib/storage';
import { outcomeFor } from '../lib/chessGame';
import { THEME_FILTERS } from '../puzzles/puzzles';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';

const EloChart = ({ values }: { values: number[] }) => {
  if (values.length < 2) return null;
  const W = 600;
  const H = 120;
  const min = Math.min(...values) - 50;
  const max = Math.max(...values) + 50;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-28" role="img">
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill="#3273f5" opacity={0.08} />
      <polyline points={pts} fill="none" stroke="#3273f5" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#3273f5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
};

export const Progress = () => {
  const { t } = useI18n();
  const p = useProgress();
  const elo = latestElo(p);
  const history = [...p.predictions].reverse().map((e) => e.elo);
  const solved = p.puzzles.filter((x) => x.solved).length;
  const results = p.games.map((g) => outcomeFor(g.result, g.playerColor));
  const wins = results.filter((r) => r === 'win').length;
  const draws = results.filter((r) => r === 'draw').length;
  const losses = results.length - wins - draws;
  const accs = p.games.map((g) => g.accuracy).filter((a): a is number => typeof a === 'number');
  const avgAcc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;

  // Weakest themes: lowest success rate with at least 3 attempts.
  const themeStats = THEME_FILTERS.filter((f) => f.id !== 'all')
    .map((f) => {
      const attempts = p.puzzles.filter((x) => x.themes.some((th) => f.match.includes(th)));
      return { id: f.id, n: attempts.length, rate: attempts.length ? attempts.filter((x) => x.solved).length / attempts.length : 0 };
    })
    .filter((s) => s.n >= 3)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  const stat = (icon: typeof Brain, value: string | number, label: string) => {
    const Icon = icon;
    return (
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
        <Icon size={18} className="text-accent mb-2" />
        <p className="text-2xl sm:text-3xl font-black text-text-primary">{value}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    );
  };

  const empty = p.games.length === 0 && p.puzzles.length === 0 && p.predictions.length === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-text-primary mb-1">{t('progress.title')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('progress.subtitle')}</p>

      {empty ? (
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 text-center">
          <p className="text-text-secondary mb-4">{t('progress.empty')}</p>
          <Link to="/game" className="inline-block bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl">
            {t('progress.startCta')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {stat(Brain, elo ?? '?', t('stats.predictedElo'))}
            {stat(Swords, `${wins}/${draws}/${losses}`, t('progress.wdl'))}
            {stat(Target, avgAcc !== null ? `${avgAcc}%` : '?', t('progress.avgAccuracy'))}
            {stat(Puzzle, `${solved} · ${p.puzzleRating || '?'}`, t('progress.puzzles'))}
          </div>

          {history.length >= 2 && (
            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-sm font-bold text-text-primary mb-2">{t('progress.eloHistory')}</p>
              <EloChart values={history.slice(-20)} />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                <TrendingDown size={16} className="text-danger" /> {t('progress.weakThemes')}
              </p>
              {themeStats.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('progress.weakThemesEmpty')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {themeStats.map((s) => (
                    <Link
                      key={s.id}
                      to={`/coach/puzzles?theme=${s.id}${elo ? `&elo=${elo}` : ''}`}
                      className="flex items-center justify-between rounded-xl bg-bg-dark hover:bg-bg-darker px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-text-primary">{t(`theme.${s.id}` as MessageKey)}</span>
                      <span className="text-xs text-text-secondary">
                        {Math.round(s.rate * 100)}% · {s.n} {t('progress.tries')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-text-primary mb-3">{t('progress.recentGames')}</p>
              {p.games.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('progress.noGames')}</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {p.games.slice(0, 6).map((g) => {
                    const o = outcomeFor(g.result, g.playerColor);
                    return (
                      <Link key={g.id} to={`/coach/analyse?game=${g.id}`} className="flex items-center justify-between py-2 hover:bg-bg-darker rounded-lg px-1">
                        <span className="text-sm text-text-primary flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${o === 'win' ? 'bg-green-500' : o === 'draw' ? 'bg-gray-400' : 'bg-danger'}`} />
                          Stockfish ~{g.engineElo}
                          {g.predictedElo ? <span className="text-xs text-accent font-semibold">· {g.predictedElo}</span> : null}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          {new Date(g.date).toLocaleDateString()} <FileSearch size={14} />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              if (window.confirm(t('progress.resetConfirm'))) updateProgress(() => ({ games: [], predictions: [], puzzles: [], puzzleRating: 0 }));
            }}
            className="mt-6 flex items-center gap-1.5 text-xs text-text-secondary hover:text-danger"
          >
            <Trash2 size={14} /> {t('progress.reset')}
          </button>
        </>
      )}
    </div>
  );
};
