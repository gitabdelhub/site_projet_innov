import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move } from '../types/chess';

type Category = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

interface MoveAnalysis {
  evalAfter: number; // centipawns, from White's point of view
  loss: number; // centipawns lost by the side that moved
  category: Category;
}

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

const ANALYSIS_DEPTH = 10;
const MATE_SCORE = 10000;

const categorize = (loss: number): Category => {
  if (loss >= 300) return 'blunder';
  if (loss >= 150) return 'mistake';
  if (loss >= 60) return 'inaccuracy';
  if (loss <= 15) return 'best';
  return 'good';
};

const COMMENTS: Record<Category, string> = {
  best: 'Excellent — this is the engine\'s choice or equivalent.',
  good: 'Good move, the position stays balanced.',
  inaccuracy: 'Inaccuracy — a slightly better move was available.',
  mistake: 'Mistake — this gives away a significant advantage.',
  blunder: 'Blunder! This loses material or the game.',
};

const COLORS: Record<Category, string> = {
  best: 'text-green-500',
  good: 'text-blue-500',
  inaccuracy: 'text-yellow-500',
  mistake: 'text-orange-500',
  blunder: 'text-red-500',
};

const ICONS: Record<Category, string> = { best: '★', good: '✓', inaccuracy: '?!', mistake: '?', blunder: '??' };

// Evaluate every position of the game with a dedicated Stockfish worker
const analyzeGame = (fens: string[], onProgress: (done: number) => void): { promise: Promise<number[]>; cancel: () => void } => {
  const worker = new Worker('/stockfish.js');
  let cancelled = false;

  const evaluate = (fen: string) =>
    new Promise<number>((resolve) => {
      let score = 0;
      const whiteToMove = fen.split(' ')[1] === 'w';
      worker.onmessage = (e) => {
        const line = String(e.data);
        const cp = line.match(/score cp (-?\d+)/);
        const mate = line.match(/score mate (-?\d+)/);
        if (cp) score = parseInt(cp[1], 10);
        if (mate) {
          const n = parseInt(mate[1], 10);
          score = n > 0 ? MATE_SCORE - n : -MATE_SCORE - n;
        }
        if (line.startsWith('bestmove')) resolve(whiteToMove ? score : -score);
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${ANALYSIS_DEPTH}`);
    });

  const promise = (async () => {
    worker.postMessage('uci');
    worker.postMessage('ucinewgame');
    const evals: number[] = [];
    for (let i = 0; i < fens.length; i++) {
      if (cancelled) break;
      const chess = new Chess(fens[i]);
      if (chess.isCheckmate()) {
        evals.push(chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE);
      } else if (chess.isDraw()) {
        evals.push(0);
      } else {
        evals.push(await evaluate(fens[i]));
      }
      onProgress(i + 1);
    }
    worker.terminate();
    return evals;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker.terminate();
    },
  };
};

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
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
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
    const job = analyzeGame(fens, setProgress);
    job.promise.then((evals) => {
      if (evals.length !== fens.length) return;
      const result: MoveAnalysis[] = moves.map((_, i) => {
        const moverIsWhite = i % 2 === 0;
        const before = Math.max(-1500, Math.min(1500, evals[i]));
        const after = Math.max(-1500, Math.min(1500, evals[i + 1]));
        const loss = Math.max(0, moverIsWhite ? before - after : after - before);
        return { evalAfter: evals[i + 1], loss, category: categorize(loss) };
      });
      analyzedKeyRef.current = movesKey;
      setAnalysis(result);
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
  const formatEval = (cp: number) =>
    Math.abs(cp) >= MATE_SCORE - 100
      ? `${cp > 0 ? '+' : '-'}M${MATE_SCORE - Math.abs(cp)}`
      : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;

  const countFor = (color: 'w' | 'b', cat: Category) =>
    analysis ? analysis.filter((a, i) => (i % 2 === 0 ? 'w' : 'b') === color && a.category === cat).length : 0;
  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  const btn = 'w-8 h-8 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs';

  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-bold text-sm">🔄 Game Analysis</h3>
        {!isRewindMode && moves.length > 0 && (
          <button onClick={startRewind} className="text-xs font-semibold text-accent hover:underline">
            Start Rewind
          </button>
        )}
      </div>

      {isRewindMode ? (
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* Controls */}
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => goTo(0)} disabled={rewindIndex === 0} className={btn} title="Start (Home)">⏮</button>
            <button onClick={() => goTo((rewindIndex ?? 0) - 1)} disabled={rewindIndex === 0} className={btn} title="Previous (←)">◀</button>
            <button
              onClick={togglePlay}
              className="w-8 h-8 bg-accent hover:bg-accent-hover rounded-lg flex items-center justify-center text-white text-xs transition-colors"
              title="Play / Pause (Space)"
            >
              {isAutoPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => goTo((rewindIndex ?? 0) + 1)} disabled={rewindIndex === totalMoves} className={btn} title="Next (→)">▶</button>
            <button onClick={() => goTo(totalMoves)} disabled={rewindIndex === totalMoves} className={btn} title="End (End)">⏭</button>
            <div className="text-center pl-2">
              <div className="text-[10px] font-bold text-text-secondary uppercase">Move</div>
              <div className="text-sm font-bold text-text-primary font-mono">{rewindIndex}/{totalMoves}</div>
            </div>
          </div>

          {/* Current move analysis */}
          {!analysis ? (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-text-secondary mb-2">🤖 Stockfish is analyzing the game… {progress}/{totalMoves + 1}</p>
              <div className="w-full h-1.5 bg-bg-darker rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${(progress / (totalMoves + 1)) * 100}%` }} />
              </div>
            </div>
          ) : current ? (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase ${COLORS[current.category]}`}>
                  {ICONS[current.category]} {moves[(rewindIndex ?? 1) - 1]?.san} — {current.category}
                </span>
                <span className={`text-xs font-bold font-mono ${current.evalAfter >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatEval(current.evalAfter)}
                </span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed">{COMMENTS[current.category]}</p>
            </div>
          ) : (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3 text-xs text-text-secondary">
              Starting position. Use ▶ or the arrow keys to step through the game.
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
                        {moves[i].san}
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
              {[{ label: 'Your Moves', color: playerColor }, { label: 'Opponent', color: opponentColor }].map(({ label, color }) => (
                <div key={label} className="bg-bg-dark/50 rounded-lg p-2 text-center text-[11px] font-bold">
                  <div className="text-[10px] text-text-secondary uppercase mb-1">{label}</div>
                  <div className="text-green-600">{countFor(color as 'w' | 'b', 'best')} Best</div>
                  <div className="text-yellow-600">{countFor(color as 'w' | 'b', 'inaccuracy')} Inaccuracies</div>
                  <div className="text-orange-500">{countFor(color as 'w' | 'b', 'mistake')} Mistakes</div>
                  <div className="text-red-500">{countFor(color as 'w' | 'b', 'blunder')} Blunders</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={exitRewind}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors"
          >
            Exit Rewind Mode
          </button>
        </div>
      ) : (
        <div className="text-center py-4 flex-1 flex items-center justify-center">
          <p className="text-text-secondary text-xs">
            {moves.length === 0 ? 'Play a game to analyze' : 'Click "Start Rewind" to replay and analyze the moves.'}
          </p>
        </div>
      )}
    </div>
  );
};
