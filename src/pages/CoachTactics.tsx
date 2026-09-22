import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { soundEffects } from '../utils/soundEffects';
import { PUZZLES, THEMES, type Puzzle, type ThemeId } from '../data/puzzles';
import { updateProgress, useProgress } from '../lib/progress';

type PuzzleStatus = 'playing' | 'wrong' | 'success' | 'revealed';

const buildStart = (puzzle: Puzzle) => {
  const chess = new Chess(puzzle.fen);
  if (puzzle.moves) {
    chess.reset();
    puzzle.moves.split(' ').forEach((m) => chess.move(m));
  }
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  return { fen: chess.fen(), lastMove: last ? { from: last.from, to: last.to } : null };
};

export const CoachTactics: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const themeFilter = (searchParams.get('theme') as ThemeId | null) ?? null;
  const puzzles = useMemo(() => (themeFilter ? PUZZLES.filter((p) => p.theme === themeFilter) : PUZZLES), [themeFilter]);

  const [index, setIndex] = useState(0);
  const puzzle = puzzles[Math.min(index, puzzles.length - 1)];

  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState('');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [status, setStatus] = useState<PuzzleStatus>('playing');
  const [feedback, setFeedback] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hadError, setHadError] = useState(false);
  const timers = useRef<number[]>([]);
  const progress = useProgress();

  const playerColor = useMemo(() => new Chess(buildStart(puzzle).fen).turn(), [puzzle]);
  const theme = THEMES.find((t) => t.id === puzzle.theme)!;

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const loadPuzzle = () => {
    clearTimers();
    const start = buildStart(puzzle);
    chessRef.current = new Chess(start.fen);
    setFen(start.fen);
    setLastMove(start.lastMove);
    setStep(0);
    setSelected(null);
    setPossible([]);
    setStatus('playing');
    setShowHint(false);
    setHadError(false);
    setFeedback(`${playerColor === 'w' ? 'White' : 'Black'} to play. ${puzzle.solution.length > 1 ? 'Find the whole combination!' : 'Find the best move!'}`);
  };

  useEffect(loadPuzzle, [puzzle]);
  useEffect(() => clearTimers, []);
  useEffect(() => setIndex(0), [themeFilter]);

  const applyMove = (san: string) => {
    const move = chessRef.current.move(san);
    setFen(chessRef.current.fen());
    setLastMove({ from: move.from, to: move.to });
    if (chessRef.current.isCheckmate()) soundEffects.playCheck();
    else if (move.captured) soundEffects.playCapture();
    else soundEffects.playMove();
    return move;
  };

  const finishSuccess = () => {
    setStatus('success');
    setFeedback(`🏆 Solved! ${puzzle.explanation}`);
    soundEffects.playSuccess();
    updateProgress((p) => {
      const firstSolve = !p.solvedPuzzles.includes(puzzle.id);
      const streak = hadError ? 0 : p.streak + 1;
      return {
        ...p,
        solvedPuzzles: firstSolve ? [...p.solvedPuzzles, puzzle.id] : p.solvedPuzzles,
        puzzleAttempts: p.puzzleAttempts + 1,
        puzzleFirstTry: p.puzzleFirstTry + (hadError ? 0 : 1),
        streak,
        bestStreak: Math.max(p.bestStreak, streak),
      };
    });
  };

  const tryMove = (from: string, to: string) => {
    const chess = chessRef.current;
    const expected = puzzle.solution[step];
    let move;
    try {
      move = chess.move({ from, to, promotion: 'q' });
    } catch {
      return;
    }
    // Accept the expected move, or any other checkmate when a mate is expected
    const correct = move.san === expected || (expected.includes('#') && chess.isCheckmate());
    setSelected(null);
    setPossible([]);

    if (!correct) {
      setFen(chess.fen());
      setLastMove({ from, to });
      setStatus('wrong');
      setHadError(true);
      setFeedback(`❌ ${move.san} is not the best move. Try again!`);
      soundEffects.playError();
      if (!hadError) updateProgress((p) => ({ ...p, streak: 0 }));
      timers.current.push(window.setTimeout(() => {
        chess.undo();
        const history = chess.history({ verbose: true });
        const last = history[history.length - 1];
        setFen(chess.fen());
        setLastMove(last ? { from: last.from, to: last.to } : buildStart(puzzle).lastMove);
        setStatus('playing');
      }, 1000));
      return;
    }

    setFen(chess.fen());
    setLastMove({ from, to });
    soundEffects.playMove();
    const nextStep = step + 1;
    if (nextStep >= puzzle.solution.length) {
      setStep(nextStep);
      finishSuccess();
      return;
    }
    // Opponent reply
    setFeedback('✅ Correct! Keep going…');
    setStep(nextStep + 1);
    timers.current.push(window.setTimeout(() => {
      applyMove(puzzle.solution[nextStep]);
      if (nextStep + 1 >= puzzle.solution.length) finishSuccess();
    }, 600));
  };

  const handleSquareClick = (square: string) => {
    if (status !== 'playing') return;
    const chess = chessRef.current;
    if (chess.turn() !== playerColor) return;

    if (selected && possible.includes(square)) {
      tryMove(selected, square);
      return;
    }
    const piece = chess.get(square as any);
    if (piece && piece.color === playerColor && square !== selected) {
      setSelected(square);
      setPossible(chess.moves({ square: square as any, verbose: true }).map((m) => m.to));
    } else {
      setSelected(null);
      setPossible([]);
    }
  };

  const revealSolution = () => {
    clearTimers();
    const start = buildStart(puzzle);
    chessRef.current = new Chess(start.fen);
    setFen(start.fen);
    setLastMove(start.lastMove);
    setStatus('revealed');
    setFeedback(`💡 Solution: ${puzzle.solution.join(' ')} — ${puzzle.explanation}`);
    updateProgress((p) => ({ ...p, streak: 0, puzzleAttempts: p.puzzleAttempts + 1 }));
    puzzle.solution.forEach((san, i) => {
      timers.current.push(window.setTimeout(() => applyMove(san), 700 * (i + 1)));
    });
  };

  const nextPuzzle = () => setIndex((i) => (i + 1) % puzzles.length);

  const accuracy = progress.puzzleAttempts > 0 ? Math.round((progress.puzzleFirstTry / progress.puzzleAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">⚔️ Tactic Trainer</h1>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-4">
            {PUZZLES.length} puzzles verified by Stockfish. Find the winning move — or the whole combination.
          </p>
        </div>

        {/* Theme filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setSearchParams({})}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${!themeFilter ? 'bg-accent text-white border-accent' : 'bg-bg-card text-text-primary border-gray-200 hover:bg-bg-darker'}`}
          >
            All themes
          </button>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ theme: t.id })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${themeFilter === t.id ? 'bg-accent text-white border-accent' : 'bg-bg-card text-text-primary border-gray-200 hover:bg-bg-darker'}`}
            >
              {t.icon} {t.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
            <div className="game-board-container flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center font-bold text-sm sm:text-lg">{theme.icon}</div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-text-primary">{puzzle.title}</div>
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">
                      {theme.name} · {playerColor === 'w' ? 'White' : 'Black'} to move
                    </span>
                  </div>
                </div>
                {progress.solvedPuzzles.includes(puzzle.id) && <span className="text-xs font-bold text-green-600">✓ Solved before</span>}
              </div>

              {fen && (
                <ChessBoard
                  gameState={{
                    fen,
                    turn: chessRef.current.turn(),
                    moves: [],
                    status: 'playing',
                    selectedSquare: selected,
                    possibleMoves: possible,
                    lastMove,
                  }}
                  onSquareClick={handleSquareClick}
                  pendingPromotion={null}
                  onPromoteSelect={() => {}}
                  onPromoteCancel={() => {}}
                  flipped={playerColor === 'b'}
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3 sm:space-y-4 order-1 lg:order-2">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent text-xl">🎓</div>
                <div>
                  <h4 className="font-bold text-text-primary">AI Coach</h4>
                  <p className="text-[10px] text-text-secondary font-bold uppercase">Puzzle {index + 1} / {puzzles.length}</p>
                </div>
              </div>

              <div className={`bg-bg-darker/40 border rounded-xl p-4 ${status === 'success' ? 'border-green-500/40' : status === 'wrong' ? 'border-red-500/40' : 'border-gray-100'}`}>
                <p className="text-sm text-text-primary leading-relaxed font-medium">{feedback}</p>
                {showHint && status === 'playing' && <p className="text-xs text-text-secondary mt-2">💡 {puzzle.hint}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowHint(true)}
                  disabled={status !== 'playing' || showHint}
                  className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors disabled:opacity-40"
                >
                  Hint
                </button>
                <button
                  onClick={revealSolution}
                  disabled={status === 'success' || status === 'revealed'}
                  className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors disabled:opacity-40"
                >
                  Solution
                </button>
                <button onClick={loadPuzzle} className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors">
                  Retry
                </button>
              </div>
              <button
                onClick={nextPuzzle}
                className={`w-full font-bold py-2.5 px-4 rounded-xl text-sm transition-colors ${status === 'success' || status === 'revealed' ? 'bg-accent hover:bg-accent-hover text-white' : 'bg-bg-dark hover:bg-bg-darker text-text-primary border border-gray-200'}`}
              >
                Next puzzle →
              </button>

              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {puzzles.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setIndex(i)}
                    title={p.title}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                      i === index
                        ? 'bg-accent text-white border-accent'
                        : progress.solvedPuzzles.includes(p.id)
                          ? 'bg-green-500/10 text-green-700 border-green-500/30'
                          : 'bg-bg-dark text-text-primary border-gray-200 hover:bg-bg-darker'
                    }`}
                  >
                    {progress.solvedPuzzles.includes(p.id) && i !== index ? '✓' : i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-text-primary mb-3">📊 Statistics</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-text-secondary">Puzzles solved</span><span className="text-text-primary font-bold">{progress.solvedPuzzles.length} / {PUZZLES.length}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">First-try accuracy</span><span className="text-text-primary font-bold">{accuracy}%</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Current streak</span><span className="text-text-primary font-bold">{progress.streak} 🔥</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Best streak</span><span className="text-text-primary font-bold">{progress.bestStreak}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
