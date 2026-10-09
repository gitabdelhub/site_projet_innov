import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Move } from '../types/chess';
import { evaluatePositions, judgeMoves, formatEval, type AnalyzedMove, type MoveCategory } from '../lib/analysis';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';
import { explainMove } from '../lib/explain';
import { Icon } from './Icon';

type Category = MoveCategory;

interface GameRewinderProps {
  moves: Move[];
  initialFen: string;
  playerColor: 'w' | 'b';
  rewindIndex: number | null;
  setRewindIndex: (index: number | null) => void;
  isRewindMode: boolean;
  setIsRewindMode: (mode: boolean) => void;
  totalMoves: number;
}

const COMMENTS: Record<Category, MessageKey> = {
  best: 'review.comment.best',
  good: 'review.comment.good',
  inaccuracy: 'review.comment.inaccuracy',
  mistake: 'review.comment.mistake',
  blunder: 'review.comment.blunder',
};

const LABELS: Record<Category, MessageKey> = {
  best: 'review.cat.best',
  good: 'review.cat.good',
  inaccuracy: 'review.cat.inaccuracy',
  mistake: 'review.cat.mistake',
  blunder: 'review.cat.blunder',
};

const COLORS: Record<Category, string> = {
  best: 'text-green-500',
  good: 'text-blue-500',
  inaccuracy: 'text-yellow-500',
  mistake: 'text-orange-500',
  blunder: 'text-red-500',
};

const ICONS: Record<Category, string> = { best: '★', good: '✓', inaccuracy: '?!', mistake: '?', blunder: '??' };

export const GameRewinder: React.FC<GameRewinderProps> = ({
  moves,
  initialFen,
  playerColor,
  rewindIndex,
  setRewindIndex,
  isRewindMode,
  setIsRewindMode,
  totalMoves,
}) => {
  const { t, lang } = useI18n();
  const [analysis, setAnalysis] = useState<AnalyzedMove[] | null>(null);
  // Positions before each move and the engine's choice there, for the explanations
  const [positions, setPositions] = useState<{ fens: string[]; best: (string | null)[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const analyzedKeyRef = useRef<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  const movesKey = moves.map((m) => m.san).join(' ');

  // Run the engine analysis once per game, when the user enters review mode
  useEffect(() => {
    if (!isRewindMode || moves.length === 0 || analyzedKeyRef.current === movesKey) return;

    const chess = new Chess(initialFen);
    const fens = [chess.fen()];
    for (const m of moves) {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
      fens.push(chess.fen());
    }

    setAnalysis(null);
    setProgress(0);
    const job = evaluatePositions(fens, setProgress);
    job.promise.then((evals) => {
      if (evals.length !== fens.length) return;
      analyzedKeyRef.current = movesKey;
      setPositions({ fens, best: [...job.bestMoves] });
      setAnalysis(judgeMoves(moves.map((m) => m.san), evals));
    });
    return job.cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRewindMode, movesKey, initialFen]);

  // Auto-play: one move every 800ms, pausable
  useEffect(() => {
    if (!isAutoPlaying) return;
    if (rewindIndex === null || rewindIndex >= totalMoves) {
      setIsAutoPlaying(false);
      return;
    }
    const t = setTimeout(() => setRewindIndex(rewindIndex + 1), 800);
    return () => clearTimeout(t);
  }, [isAutoPlaying, rewindIndex, totalMoves, setRewindIndex]);

  // Keyboard shortcuts: ← → Home End Space Escape
  useEffect(() => {
    if (!isRewindMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const idx = rewindIndex ?? 0;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIsAutoPlaying(false); setRewindIndex(Math.max(0, idx - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIsAutoPlaying(false); setRewindIndex(Math.min(totalMoves, idx + 1)); }
      else if (e.key === 'Home') { e.preventDefault(); setIsAutoPlaying(false); setRewindIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); setIsAutoPlaying(false); setRewindIndex(totalMoves); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Escape') { e.preventDefault(); exitRewind(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Keep the current move visible in the list
  useEffect(() => {
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [rewindIndex]);

  const startRewind = () => {
    setIsRewindMode(true);
    setRewindIndex(0);
  };

  const exitRewind = () => {
    setIsAutoPlaying(false);
    setIsRewindMode(false);
    setRewindIndex(null);
  };

  const togglePlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      return;
    }
    if (rewindIndex === null || rewindIndex >= totalMoves) setRewindIndex(0);
    setIsAutoPlaying(true);
  };

  const goTo = (index: number) => {
    setIsAutoPlaying(false);
    setRewindIndex(Math.max(0, Math.min(totalMoves, index)));
  };

  const current = rewindIndex !== null && rewindIndex > 0 && analysis ? analysis[rewindIndex - 1] : null;
  const explanation = useMemo(
    () => (current && positions && rewindIndex ? explainMove(positions.fens[rewindIndex - 1], current, positions.best[rewindIndex - 1] ?? null, t) : null),
    [current, positions, rewindIndex, t]
  );
  const countFor = (color: 'w' | 'b', cat: Category) =>
    analysis ? analysis.filter((a, i) => (i % 2 === 0 ? 'w' : 'b') === color && a.category === cat).length : 0;
  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  const btn = 'w-8 h-8 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs';

  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-bold text-sm">{t('review.title')}</h3>
        {!isRewindMode && moves.length > 0 && (
          <button onClick={startRewind} className="text-xs font-semibold text-accent hover:underline">
            {t('review.start')}
          </button>
        )}
      </div>

      {isRewindMode ? (
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* Controls */}
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => goTo(0)} disabled={rewindIndex === 0} className={btn} title={t('review.first')} aria-label={t('review.first')}><Icon name="skipBack" className="w-3.5 h-3.5" /></button>
            <button onClick={() => goTo((rewindIndex ?? 0) - 1)} disabled={rewindIndex === 0} className={btn} title={t('review.prev')} aria-label={t('review.prev')}><Icon name="stepBack" className="w-4 h-4" /></button>
            <button
              onClick={togglePlay}
              className="w-8 h-8 bg-accent hover:bg-accent-hover rounded-lg flex items-center justify-center text-white text-xs transition-colors"
              title={t('review.playPause')}
              aria-label={t('review.playPause')}
            >
              <Icon name={isAutoPlaying ? 'pause' : 'play'} className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => goTo((rewindIndex ?? 0) + 1)} disabled={rewindIndex === totalMoves} className={btn} title={t('review.next')} aria-label={t('review.next')}><Icon name="stepForward" className="w-4 h-4" /></button>
            <button onClick={() => goTo(totalMoves)} disabled={rewindIndex === totalMoves} className={btn} title={t('review.last')} aria-label={t('review.last')}><Icon name="skipForward" className="w-3.5 h-3.5" /></button>
            <div className="text-center pl-2">
              <div className="text-[10px] font-bold text-text-secondary uppercase">{t('review.move')}</div>
              <div className="text-sm font-bold text-text-primary font-mono">{rewindIndex}/{totalMoves}</div>
            </div>
          </div>

          {/* Current move analysis */}
          {!analysis ? (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-text-secondary mb-2">{t('review.analysing', { done: progress, total: totalMoves + 1 })}</p>
              <div className="w-full h-1.5 bg-bg-darker rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${(progress / (totalMoves + 1)) * 100}%` }} />
              </div>
            </div>
          ) : current ? (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase ${COLORS[current.category]}`}>
                  {ICONS[current.category]} {localSan(moves[(rewindIndex ?? 1) - 1]?.san ?? '', lang)} · {t(LABELS[current.category])}
                </span>
                <span className={`text-xs font-bold font-mono ${current.evalAfter >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatEval(current.evalAfter)}
                </span>
              </div>
              {explanation ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-text-primary leading-relaxed">{explanation.facts.join(' ')}</p>
                  <p className="text-xs font-semibold text-text-primary leading-relaxed">{explanation.verdict}</p>
                  {explanation.better && (
                    <p className="text-xs text-text-primary leading-relaxed bg-green-500/5 border border-green-500/20 rounded-lg px-2 py-1.5">
                      <span className="font-bold text-green-700">{t('explain.better', { move: localSan(explanation.better.san, lang) })}</span>{' '}
                      {explanation.better.why.join(' ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-primary leading-relaxed">{t(COMMENTS[current.category])}</p>
              )}
            </div>
          ) : (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3 text-xs text-text-secondary">
              {t('review.startPosition')}
            </div>
          )}

          {/* Clickable move list */}
          <div ref={listRef} className="flex-1 min-h-[80px] max-h-48 overflow-y-auto custom-scrollbar border border-gray-100 rounded-lg p-1">
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 text-xs font-mono">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, row) => (
                <React.Fragment key={row}>
                  <span className="text-text-secondary py-1 pl-1">{row + 1}.</span>
                  {[row * 2, row * 2 + 1].map((i) =>
                    i < moves.length ? (
                      <button
                        key={i}
                        data-current={rewindIndex === i + 1}
                        onClick={() => goTo(i + 1)}
                        className={`text-left px-1.5 py-1 rounded font-semibold transition-colors ${
                          rewindIndex === i + 1 ? 'bg-accent text-white' : 'text-text-primary hover:bg-bg-darker'
                        }`}
                      >
                        {localSan(moves[i].san, lang)}
                        {analysis && analysis[i].category !== 'best' && analysis[i].category !== 'good' && (
                          <span className={`ml-0.5 ${rewindIndex === i + 1 ? 'text-white' : COLORS[analysis[i].category]}`}>
                            {ICONS[analysis[i].category]}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span key={i} />
                    )
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Summary */}
          {analysis && (
            <div className="grid grid-cols-2 gap-2">
              {[{ label: t('review.yourMoves'), color: playerColor }, { label: t('review.opponent'), color: opponentColor }].map(({ label, color }) => (
                <div key={label} className="bg-bg-dark/50 rounded-lg p-2 text-center text-[11px] font-bold">
                  <div className="text-[10px] text-text-secondary uppercase mb-1">{label}</div>
                  <div className="text-green-600">{countFor(color as 'w' | 'b', 'best')} {t('review.cat.best')}</div>
                  <div className="text-yellow-600">{countFor(color as 'w' | 'b', 'inaccuracy')} {t('review.inaccuracies')}</div>
                  <div className="text-orange-500">{countFor(color as 'w' | 'b', 'mistake')} {t('review.mistakes')}</div>
                  <div className="text-red-500">{countFor(color as 'w' | 'b', 'blunder')} {t('review.blunders')}</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={exitRewind}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors"
          >
            {t('review.exit')}
          </button>
        </div>
      ) : (
        <div className="text-center py-4 flex-1 flex items-center justify-center">
          <p className="text-text-secondary text-xs">
            {moves.length === 0 ? t('review.empty') : t('review.intro')}
          </p>
        </div>
      )}
    </div>
  );
};
