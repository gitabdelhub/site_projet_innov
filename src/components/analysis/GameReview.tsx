import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, Lightbulb, RefreshCw } from 'lucide-react';
import { Board, type Arrow } from '../board/Board';
import { EvalBar } from '../board/EvalBar';
import { MoveList } from '../board/MoveList';
import { EvalGraph } from './EvalGraph';
import {
  analyseGame,
  cancelAnalysis,
  CLASS_BADGE,
  CLASS_COLORS,
  type GameAnalysis,
  type MoveClass,
  type PlayerSummary,
} from '../../engine/analysis';
import { formatScore } from '../../engine/engine';
import { fromUci, type Color, type PlayedMove } from '../../lib/chessGame';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/messages';

interface GameReviewProps {
  startFen: string;
  moves: PlayedMove[];
  orientation?: Color;
  /** Side of the user, highlighted in the summary. */
  playerColor?: Color | null;
  whiteName?: string;
  blackName?: string;
  depth?: number;
  onAnalysed?: (a: GameAnalysis) => void;
  /** Extra content shown under the summary (e.g. Elo prediction). */
  aside?: ReactNode;
}

const CLASS_LABEL: Record<MoveClass, MessageKey> = {
  best: 'review.cls.best',
  good: 'review.cls.good',
  book: 'review.cls.book',
  inaccuracy: 'review.cls.inaccuracy',
  mistake: 'review.cls.mistake',
  blunder: 'review.cls.blunder',
};

const SummaryCard = ({
  name,
  color,
  s,
  highlight,
}: {
  name: string;
  color: Color;
  s: PlayerSummary;
  highlight: boolean;
}) => {
  const { t } = useI18n();
  const items: [MoveClass, number][] = [
    ['inaccuracy', s.inaccuracy],
    ['mistake', s.mistake],
    ['blunder', s.blunder],
  ];
  return (
    <div className={`flex-1 rounded-xl border p-3 ${highlight ? 'border-accent/40 bg-accent/5' : 'border-gray-200 bg-bg-card'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-3 h-3 rounded-sm border border-gray-400 ${color === 'w' ? 'bg-white' : 'bg-[#262626]'}`} />
        <span className="text-xs font-semibold text-text-secondary truncate">{name}</span>
      </div>
      <div className="text-2xl font-black text-text-primary">
        {s.accuracy.toFixed(1)}
        <span className="text-sm font-semibold text-text-secondary">%</span>
      </div>
      <div className="text-[11px] text-text-secondary mb-2">{t('review.accuracy')}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(([c, n]) => (
          <span key={c} className="text-[11px] font-semibold" style={{ color: CLASS_COLORS[c] }}>
            {n} {t(CLASS_LABEL[c]).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
};

export const GameReview = ({
  startFen,
  moves,
  orientation = 'w',
  playerColor = null,
  whiteName,
  blackName,
  depth = 14,
  onAnalysed,
  aside,
}: GameReviewProps) => {
  const { t } = useI18n();
  const [index, setIndex] = useState(moves.length);
  const [autoplay, setAutoplay] = useState(false);
  const [flipped, setFlipped] = useState(orientation === 'b');
  const [showBest, setShowBest] = useState(false);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const movesKey = moves.map((m) => m.uci).join(' ');

  useEffect(() => {
    let alive = true;
    setAnalysis(null);
    setFailed(false);
    setProgress(0);
    setIndex(moves.length);
    analyseGame(startFen, moves, { depth, onProgress: (d, n) => alive && setProgress(d / n) })
      .then((a) => {
        if (!alive || !a) return;
        setAnalysis(a);
        onAnalysed?.(a);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      cancelAnalysis();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFen, movesKey, depth]);

  // Autoplay with a cleaned-up interval.
  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= moves.length) {
          setAutoplay(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [autoplay, moves.length]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(moves.length, i + 1));
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(moves.length);
      else return;
      e.preventDefault();
      setAutoplay(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const fen = index === 0 ? startFen : moves[index - 1].fenAfter;
  const pos = analysis?.positions[index];
  const current = index > 0 ? analysis?.moves[index - 1] : undefined;
  const lastMove = index > 0 ? { from: moves[index - 1].from, to: moves[index - 1].to } : null;

  const arrows: Arrow[] = useMemo(() => {
    const list: Arrow[] = [];
    if (showBest && pos?.bestUci) {
      const { from, to } = fromUci(pos.bestUci);
      list.push({ from, to, color: '#15803d' });
    }
    return list;
  }, [showBest, pos?.bestUci]);

  const mark =
    current && index > 0
      ? { square: moves[index - 1].to, badge: CLASS_BADGE[current.cls], color: CLASS_COLORS[current.cls] }
      : null;

  const go = (i: number) => {
    setAutoplay(false);
    setIndex(Math.max(0, Math.min(moves.length, i)));
  };

  const comment = () => {
    if (!analysis) return null;
    if (!current) return <p className="text-sm text-text-secondary">{t('review.startHint')}</p>;
    const moveNo = `${Math.ceil(current.ply / 2)}${current.color === 'w' ? '.' : '...'}`;
    const better = current.cls !== 'best' && current.bestSan && current.bestSan !== current.san;
    return (
      <div>
        <p className="text-sm font-bold" style={{ color: CLASS_COLORS[current.cls] }}>
          {moveNo} {current.san} : {t(CLASS_LABEL[current.cls])}
        </p>
        {better && (current.cls === 'inaccuracy' || current.cls === 'mistake' || current.cls === 'blunder') && (
          <p className="text-sm text-text-secondary mt-1">
            {t('review.betterWas')} <span className="font-mono font-bold text-text-primary">{current.bestSan}</span>
          </p>
        )}
        <p className="text-xs text-text-secondary mt-1">
          {t('review.evalAfter')} <span className="font-mono font-semibold">{formatScore(pos?.score)}</span>
        </p>
      </div>
    );
  };

  const navBtn = 'p-2.5 rounded-lg bg-bg-darker hover:bg-accent/10 disabled:opacity-40 text-text-primary transition-colors';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex gap-2 items-stretch">
          <EvalBar score={pos?.score ?? null} cp={pos?.cp ?? 0} orientation={flipped ? 'b' : 'w'} loading={!analysis} />
          <div className="flex-1 min-w-0">
            <Board fen={fen} orientation={flipped ? 'b' : 'w'} lastMove={lastMove} arrows={arrows} mark={mark} />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button className={navBtn} onClick={() => go(0)} disabled={index === 0} aria-label={t('review.first')}>
            <ChevronFirst size={18} />
          </button>
          <button className={navBtn} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('review.prev')}>
            <ChevronLeft size={18} />
          </button>
          <button
            className={`${navBtn} px-4`}
            onClick={() => {
              if (index >= moves.length) setIndex(0);
              setAutoplay((a) => !a);
            }}
            aria-label={autoplay ? t('review.pause') : t('review.play')}
          >
            {autoplay ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className={navBtn} onClick={() => go(index + 1)} disabled={index >= moves.length} aria-label={t('review.next')}>
            <ChevronRight size={18} />
          </button>
          <button className={navBtn} onClick={() => go(moves.length)} disabled={index >= moves.length} aria-label={t('review.last')}>
            <ChevronLast size={18} />
          </button>
          <button className={navBtn} onClick={() => setFlipped((f) => !f)} aria-label={t('game.flip')}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        {!analysis && !failed && (
          <div className="bg-bg-card border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-text-primary mb-2">
              {t('review.analysing', { pct: Math.round(progress * 100) })}
            </p>
            <div className="h-2 bg-bg-darker rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
        {failed && <p className="text-sm text-danger">{t('review.failed')}</p>}

        {analysis && (
          <>
            <div className="flex gap-2">
              <SummaryCard name={whiteName ?? t('common.white')} color="w" s={analysis.white} highlight={playerColor === 'w'} />
              <SummaryCard name={blackName ?? t('common.black')} color="b" s={analysis.black} highlight={playerColor === 'b'} />
            </div>
            <EvalGraph analysis={analysis} index={index} onSelect={go} />
          </>
        )}

        {aside}

        <div className="bg-bg-card border border-gray-200 rounded-xl p-4 min-h-[88px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">{comment()}</div>
            {analysis && pos?.bestUci && (
              <button
                onClick={() => setShowBest((s) => !s)}
                className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  showBest ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Lightbulb size={14} />
                {t('review.showBest')}
              </button>
            )}
          </div>
        </div>

        <div className="bg-bg-card border border-gray-200 rounded-xl p-2">
          <MoveList
            sans={moves.map((m) => m.san)}
            current={index}
            onSelect={go}
            classes={analysis?.moves.map((m) => m.cls)}
            startsWithBlack={startFen.split(' ')[1] === 'b'}
            className="max-h-64"
          />
        </div>
      </div>
    </div>
  );
};
