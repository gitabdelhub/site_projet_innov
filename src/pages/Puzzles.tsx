import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { CheckCircle2, XCircle, Lightbulb, Eye, SkipForward, RotateCcw, Flame, Target, Brain } from 'lucide-react';
import { Board, type Arrow } from '../components/board/Board';
import { pickPuzzle, THEME_FILTERS, updatePuzzleRating, type Puzzle } from '../puzzles/puzzles';
import { fromUci, type Color } from '../lib/chessGame';
import { latestElo, updateProgress, useProgress } from '../lib/storage';
import { soundEffects } from '../utils/soundEffects';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';

type Status = 'loading' | 'opponent' | 'play' | 'wrong' | 'solved' | 'empty';

export const Puzzles = () => {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const progress = useProgress();
  const predicted = latestElo(progress);
  const paramElo = Number(params.get('elo')) || null;

  // Target: explicit Elo from a prediction, else the last predicted Elo, else the puzzle rating.
  const [target, setTarget] = useState<number>(() => paramElo ?? predicted ?? (progress.puzzleRating || 1000));
  const targetSource: MessageKey =
    paramElo || predicted ? 'puzzles.fromPrediction' : progress.puzzleRating ? 'puzzles.fromRating' : 'puzzles.fromDefault';

  const [theme, setTheme] = useState(() => params.get('theme') ?? 'all');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState('');
  const [step, setStep] = useState(0); // number of puzzle moves already played
  const [status, setStatus] = useState<Status>('loading');
  const [hint, setHint] = useState<Arrow[]>([]);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const recorded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const solvedIds = useMemo(() => new Set(progress.puzzles.filter((p) => p.solved).map((p) => p.id)), [progress.puzzles]);

  const playOpponent = useCallback((p: Puzzle, fenBefore: string, index: number) => {
    setStatus('opponent');
    timer.current = setTimeout(() => {
      const c = new Chess(fenBefore);
      const m = c.move(fromUci(p.moves[index]));
      soundEffects.playMove();
      setFen(c.fen());
      setLastMove({ from: m.from, to: m.to });
      setStep(index + 1);
      setStatus('play');
    }, 550);
  }, []);

  const next = useCallback(async () => {
    clearTimeout(timer.current);
    setStatus('loading');
    setHint([]);
    setHintSquare(null);
    setLastMove(null);
    recorded.current = false;
    const p = await pickPuzzle(target, theme, solvedIds);
    if (!p) {
      setPuzzle(null);
      setStatus('empty');
      return;
    }
    setPuzzle(p);
    setFen(p.fen);
    setStep(0);
    playOpponent(p, p.fen, 0);
    // solvedIds intentionally read at call time only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, theme, playOpponent]);

  useEffect(() => {
    void next();
    return () => clearTimeout(timer.current);
  }, [next]);

  const record = (solved: boolean) => {
    if (!puzzle || recorded.current) return;
    recorded.current = true;
    updateProgress((p) => {
      const rating = updatePuzzleRating(p.puzzleRating || target, puzzle.rating, solved, p.puzzles.length);
      return {
        ...p,
        puzzleRating: rating,
        puzzles: [
          { id: puzzle.id, rating: puzzle.rating, solved, date: new Date().toISOString(), themes: puzzle.themes },
          ...p.puzzles,
        ].slice(0, 500),
      };
    });
  };

  const onMove = (from: string, to: string, promotion?: string) => {
    if (!puzzle || status !== 'play') return false;
    const c = new Chess(fen);
    let mv;
    try {
      mv = c.move({ from, to, promotion });
    } catch {
      return false;
    }
    const expected = puzzle.moves[step];
    const isLast = step === puzzle.moves.length - 1;
    const ok = `${from}${to}${promotion ?? ''}` === expected || (isLast && c.isCheckmate());
    setFen(c.fen());
    setLastMove({ from: mv.from, to: mv.to });
    setHint([]);
    setHintSquare(null);
    if (!ok) {
      soundEffects.playError();
      setStatus('wrong');
      setStreak(0);
      record(false);
      return true;
    }
    if (isLast || step + 1 >= puzzle.moves.length) {
      soundEffects.playSuccess();
      setStatus('solved');
      setStreak((s) => s + 1);
      record(true);
      return true;
    }
    soundEffects.playMove();
    playOpponent(puzzle, c.fen(), step + 1);
    return true;
  };

  const retry = () => {
    if (!puzzle) return;
    // Back to the position before the wrong move.
    const c = new Chess(puzzle.fen);
    for (let i = 0; i < step; i++) c.move(fromUci(puzzle.moves[i]));
    const prev = puzzle.moves[step - 1];
    setFen(c.fen());
    setLastMove(prev ? fromUci(prev) : null);
    setStatus('play');
  };

  const showSolution = () => {
    if (!puzzle) return;
    record(false);
    setStreak(0);
    const c = new Chess(puzzle.fen);
    for (let i = 0; i < step; i++) c.move(fromUci(puzzle.moves[i]));
    const m = fromUci(puzzle.moves[step]);
    setFen(c.fen());
    setHint([{ from: m.from, to: m.to, color: '#15803d' }]);
    setStatus('play');
  };

  const giveHint = () => {
    if (!puzzle) return;
    const m = fromUci(puzzle.moves[step]);
    setHintSquare(m.from);
  };

  const playerColor: Color = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w';
  const solvedCount = progress.puzzles.filter((p) => p.solved).length;
  const tried = progress.puzzles.length;

  const banner = () => {
    switch (status) {
      case 'loading':
        return <p className="text-sm text-text-secondary">{t('puzzles.loading')}</p>;
      case 'empty':
        return <p className="text-sm text-danger">{t('puzzles.empty')}</p>;
      case 'opponent':
      case 'play':
        return (
          <p className="text-base font-bold text-text-primary flex items-center gap-2">
            <img src={`/pieces/${playerColor}K.svg`} alt="" className="w-6 h-6" />
            {playerColor === 'w' ? t('puzzles.whiteToPlay') : t('puzzles.blackToPlay')}
          </p>
        );
      case 'wrong':
        return (
          <p className="text-base font-bold text-danger flex items-center gap-2">
            <XCircle size={20} /> {t('puzzles.wrong')}
          </p>
        );
      case 'solved':
        return (
          <p className="text-base font-bold text-green-600 flex items-center gap-2">
            <CheckCircle2 size={20} /> {t('puzzles.solved')}
          </p>
        );
    }
  };

  const btn = 'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 lg:gap-6 items-start">
        <div className="w-full max-w-[min(100%,calc(100vh-150px))] lg:max-w-[min(640px,calc(100vh-150px))] mx-auto">
          {fen ? (
            <Board
              fen={fen}
              orientation={playerColor}
              movable={status === 'play' ? playerColor : null}
              onMove={onMove}
              lastMove={lastMove}
              arrows={hint}
              highlights={hintSquare ? [hintSquare] : []}
            />
          ) : (
            <div className="aspect-square w-full rounded-lg bg-bg-darker animate-pulse" />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-black text-text-primary">{t('puzzles.title')}</h1>
              {puzzle && <span className="text-xs font-mono text-text-secondary">#{puzzle.id} · {puzzle.rating}</span>}
            </div>
            <div className="min-h-[32px] mb-3">{banner()}</div>

            {status === 'play' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={giveHint} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <Lightbulb size={16} /> {t('puzzles.hint')}
                </button>
                <button onClick={showSolution} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <Eye size={16} /> {t('puzzles.solution')}
                </button>
              </div>
            )}
            {status === 'wrong' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={retry} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <RotateCcw size={16} /> {t('puzzles.retry')}
                </button>
                <button onClick={showSolution} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <Eye size={16} /> {t('puzzles.solution')}
                </button>
              </div>
            )}
            {(status === 'solved' || status === 'wrong' || status === 'empty') && (
              <button onClick={() => void next()} className={`${btn} w-full mt-2 bg-accent hover:bg-accent-hover text-white font-bold`}>
                <SkipForward size={16} /> {t('puzzles.next')}
              </button>
            )}
            {status === 'play' && (
              <button onClick={() => void next()} className="w-full mt-2 text-xs text-text-secondary hover:text-text-primary underline">
                {t('puzzles.skip')}
              </button>
            )}
          </div>

          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-accent" />
              <p className="text-sm font-bold text-text-primary">{t('puzzles.level')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-accent">{target}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTarget((x) => Math.max(400, x - 100))}
                  className="w-8 h-8 rounded-lg bg-bg-darker hover:bg-gray-200 font-bold"
                  aria-label="-100"
                >
                  -
                </button>
                <button
                  onClick={() => setTarget((x) => Math.min(2800, x + 100))}
                  className="w-8 h-8 rounded-lg bg-bg-darker hover:bg-gray-200 font-bold"
                  aria-label="+100"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[11px] text-text-secondary mt-1 flex items-center gap-1">
              <Brain size={12} /> {t(targetSource)}
            </p>
            {!predicted && (
              <Link to="/game" className="block text-xs text-accent font-semibold mt-2 hover:underline">
                {t('puzzles.getPredicted')}
              </Link>
            )}
          </div>

          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">{t('puzzles.theme')}</p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTheme(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    theme === f.id ? 'bg-accent text-white border-accent' : 'bg-bg-dark border-gray-200 text-text-primary hover:border-accent/50'
                  }`}
                >
                  {t(`theme.${f.id}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bg-card border border-gray-200/80 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-text-primary flex items-center justify-center gap-1">
                <Flame size={16} className="text-orange-500" />
                {streak}
              </p>
              <p className="text-[11px] text-text-secondary">{t('puzzles.streak')}</p>
            </div>
            <div className="bg-bg-card border border-gray-200/80 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-text-primary">{solvedCount}</p>
              <p className="text-[11px] text-text-secondary">{t('puzzles.solvedCount')}</p>
            </div>
            <div className="bg-bg-card border border-gray-200/80 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-text-primary">{tried ? Math.round((solvedCount / tried) * 100) : 0}%</p>
              <p className="text-[11px] text-text-secondary">{t('puzzles.successRate')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
