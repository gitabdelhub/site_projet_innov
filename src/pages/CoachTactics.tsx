import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { soundEffects } from '../utils/soundEffects';
import { PUZZLES, THEMES, LEVELS, type Puzzle, type ThemeId, type LevelId } from '../data/puzzles';
import { loadProgress, updateProgress, useProgress } from '../lib/progress';
import { pickPuzzle, recordPuzzle, weakThemes } from '../lib/adaptive';
import { useI18n, pick, type MessageKey } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';

type PuzzleStatus = 'playing' | 'wrong' | 'success' | 'revealed';
// Feedback is kept as a message key so it follows a language switch
type Feedback = { key: MessageKey; move?: string };

export const buildStart = (puzzle: Puzzle) => {
  const chess = new Chess(puzzle.fen);
  if (puzzle.moves) {
    chess.reset();
    puzzle.moves.split(' ').forEach((m) => chess.move(m));
  }
  if (puzzle.setup) chess.move(puzzle.setup);
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  return { fen: chess.fen(), lastMove: last ? { from: last.from, to: last.to } : null };
};

const chip = (active: boolean, dark = false) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
    active ? (dark ? 'bg-text-primary text-white border-text-primary' : 'bg-accent text-white border-accent') : 'bg-bg-card text-text-primary border-gray-200 hover:bg-bg-darker'
  }`;

export const CoachTactics: React.FC = () => {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const themeFilter = (searchParams.get('theme') as ThemeId | null) ?? null;
  const levelFilter = (searchParams.get('level') as LevelId | null) ?? null;
  // "For me": an endless series picked by the adaptive coach
  const forYou = searchParams.get('mode') === 'foryou';
  const [queue, setQueue] = useState<Puzzle[]>([]);
  const filtered = useMemo(() => {
    const level = LEVELS.find((l) => l.id === levelFilter);
    return PUZZLES.filter((p) =>
      (!themeFilter || p.theme === themeFilter) &&
      (!level || (p.rating !== undefined && p.rating >= level.min && p.rating < level.max)));
  }, [themeFilter, levelFilter]);
  const puzzles = forYou ? queue : filtered;
  const setFilter = (key: 'theme' | 'level' | 'mode', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'mode') {
      next.delete('theme');
      next.delete('level');
    } else next.delete('mode');
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const [index, setIndex] = useState(0);
  const puzzle = puzzles[Math.min(index, puzzles.length - 1)];

  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState('');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [status, setStatus] = useState<PuzzleStatus>('playing');
  const [feedback, setFeedback] = useState<Feedback>({ key: 'tactics.findMove' });
  const [showHint, setShowHint] = useState(false);
  const [hadError, setHadError] = useState(false);
  // Each puzzle counts once for the rating: the first try decides
  const ratedRef = useRef(false);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const progress = useProgress();

  const playerColor = useMemo(() => (puzzle ? new Chess(buildStart(puzzle).fen).turn() : 'w'), [puzzle]);
  const theme = puzzle ? THEMES.find((th) => th.id === puzzle.theme)! : THEMES[0];
  const san = (m: string) => localSan(m, lang);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };

  const loadPuzzle = () => {
    if (!puzzle) return;
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
    ratedRef.current = false;
    setRatingDelta(null);
    setFeedback({ key: puzzle.solution.length > 1 ? 'tactics.findCombination' : 'tactics.findMove' });
  };

  useEffect(loadPuzzle, [puzzle]);
  useEffect(() => clearTimers, []);
  useEffect(() => {
    setIndex(0);
    setQueue(forYou ? [pickPuzzle(loadProgress())] : []);
  }, [themeFilter, levelFilter, forYou]);

  const rate = (score: 0 | 1) => {
    if (ratedRef.current || !puzzle) return;
    ratedRef.current = true;
    const before = loadProgress().puzzleRating;
    const after = updateProgress((p) => recordPuzzle(p, puzzle, score)).puzzleRating;
    setRatingDelta(after - before);
  };

  const applyMove = (s: string) => {
    const move = chessRef.current.move(s);
    setFen(chessRef.current.fen());
    setLastMove({ from: move.from, to: move.to });
    if (chessRef.current.isCheckmate()) soundEffects.playCheck();
    else if (move.captured) soundEffects.playCapture();
    else soundEffects.playMove();
    return move;
  };

  const finishSuccess = () => {
    rate(1);
    setStatus('success');
    setFeedback({ key: 'tactics.solved' });
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
      setFeedback({ key: 'tactics.wrong', move: move.san });
      rate(0);
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
    setFeedback({ key: 'tactics.keepGoing' });
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
    rate(0);
    setFeedback({ key: 'tactics.solutionIs' });
    updateProgress((p) => ({ ...p, streak: 0, puzzleAttempts: p.puzzleAttempts + 1 }));
    puzzle.solution.forEach((s, i) => {
      timers.current.push(window.setTimeout(() => applyMove(s), 700 * (i + 1)));
    });
  };

  const nextPuzzle = () => {
    if (forYou) {
      setQueue((q) => [...q, pickPuzzle(loadProgress(), q.map((x) => x.id).slice(-50))]);
      setIndex((i) => i + 1);
    } else setIndex((i) => (i + 1) % puzzles.length);
  };
  const weak = weakThemes(progress);

  const accuracy = progress.puzzleAttempts > 0 ? Math.round((progress.puzzleFirstTry / progress.puzzleAttempts) * 100) : 0;
  const side = t(playerColor === 'w' ? 'common.white' : 'common.black');
  const solvedHere = puzzles.filter((p) => progress.solvedPuzzles.includes(p.id)).length;

  let message = t(feedback.key, { side, move: feedback.move ? san(feedback.move) : '' });
  if (puzzle && status === 'success') message += ` ${pick(puzzle.explanation, lang)}`;
  if (puzzle && status === 'revealed') message += ` ${puzzle.solution.map(san).join(' ')}. ${pick(puzzle.explanation, lang)}`;

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="puzzle" title={t('tactics.title')} subtitle={t('tactics.subtitle', { n: PUZZLES.length })} />

        <div className="flex flex-wrap justify-center gap-2 mb-3">
          <button onClick={() => setFilter('mode', 'foryou')} className={chip(forYou)}>
            <Icon name="sparkle" className="w-3.5 h-3.5" /> {t('adaptive.forYou')}
          </button>
          <button onClick={() => setFilter('theme', null)} className={chip(!forYou && !themeFilter)}>{t('tactics.allThemes')}</button>
          {THEMES.map((th) => (
            <button key={th.id} onClick={() => setFilter('theme', th.id)} className={chip(!forYou && themeFilter === th.id)}>
              <Icon name={th.icon} className="w-3.5 h-3.5" />
              {pick(th.name, lang)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-5 sm:mb-6">
          <button onClick={() => setFilter('level', null)} className={chip(!forYou && !levelFilter, true)}>{t('tactics.allLevels')}</button>
          {LEVELS.map((l) => (
            <button key={l.id} onClick={() => setFilter('level', l.id)} className={chip(!forYou && levelFilter === l.id, true)}>
              {pick(l.label, lang)} <span className="opacity-70 font-semibold">{l.range}</span>
            </button>
          ))}
        </div>

        {forYou && (
          <p className="max-w-2xl mx-auto text-center text-sm text-text-secondary bg-bg-card border border-accent/20 rounded-xl px-4 py-3 mb-5">
            {t('adaptive.forYouText', { rating: progress.puzzleRating })}{' '}
            {weak.length
              ? t('adaptive.forYouWeak', { themes: weak.map((w) => pick(THEMES.find((th) => th.id === w.theme)!.name, lang).toLowerCase()).join(', ') })
              : t('adaptive.forYouNoWeak')}
          </p>
        )}

        {!puzzle ? (
          <p className="text-center text-text-secondary text-sm py-16">{t('tactics.noMatch')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
              <div className="game-board-container flex flex-col items-center w-full">
                <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-accent/10 text-accent rounded-lg flex items-center justify-center">
                      <Icon name={theme.icon} className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="font-bold text-sm text-text-primary">{pick(puzzle.title, lang)}</div>
                      <span className="text-[11px] text-text-secondary font-semibold">
                        {t('common.toMove', { side })}
                        {puzzle.source === 'lichess' && (
                          <>
                            {' · '}
                            <a href={`https://lichess.org/training/${puzzle.id.slice(3)}`} target="_blank" rel="noreferrer" className="underline">
                              Lichess
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  {progress.solvedPuzzles.includes(puzzle.id) && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                      <Icon name="check" className="w-4 h-4" /> {t('tactics.solvedBefore')}
                    </span>
                  )}
                </div>

                {fen && (
                  <ChessBoard
                    gameState={{ fen, turn: chessRef.current.turn(), moves: [], status: 'playing', selectedSquare: selected, possibleMoves: possible, lastMove }}
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
              <div className="bg-bg-card border border-gray-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                      <Icon name="graduation" className="w-5 h-5" />
                    </span>
                    <div>
                      <h2 className="font-bold text-text-primary">{t('common.coach')}</h2>
                      <p className="text-[11px] text-text-secondary font-semibold">
                        {forYou ? t('adaptive.counter', { n: index + 1 }) : t('tactics.counter', { i: index + 1, n: puzzles.length })}
                      </p>
                    </div>
                  </div>
                  {puzzle.rating && <span className="font-mono text-xs font-bold text-text-secondary bg-bg-darker px-2 py-1 rounded-md">{puzzle.rating}</span>}
                </div>

                <div
                  aria-live="polite"
                  className={`bg-bg-darker/40 border rounded-xl p-4 ${status === 'success' ? 'border-green-500/40' : status === 'wrong' ? 'border-red-500/40' : 'border-gray-100'}`}
                >
                  <p className="text-sm text-text-primary leading-relaxed font-medium">{message}</p>
                  {showHint && status === 'playing' && (
                    <p className="flex gap-2 text-xs text-text-secondary mt-2">
                      <Icon name="bulb" className="w-4 h-4 shrink-0" /> {pick(puzzle.hint, lang)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShowHint(true)}
                    disabled={status !== 'playing' || showHint}
                    className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors disabled:opacity-40"
                  >
                    {t('tactics.hint')}
                  </button>
                  <button
                    onClick={revealSolution}
                    disabled={status === 'success' || status === 'revealed'}
                    className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors disabled:opacity-40"
                  >
                    {t('tactics.solution')}
                  </button>
                  <button onClick={loadPuzzle} className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2 rounded-xl text-xs border border-gray-200 transition-colors">
                    {t('common.retry')}
                  </button>
                </div>
                <button
                  onClick={nextPuzzle}
                  className={`w-full inline-flex items-center justify-center gap-1.5 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors ${status === 'success' || status === 'revealed' ? 'bg-accent hover:bg-accent-hover text-white' : 'bg-bg-dark hover:bg-bg-darker text-text-primary border border-gray-200'}`}
                >
                  {t('tactics.nextPuzzle')} <Icon name="arrowRight" className="w-4 h-4" />
                </button>

                {puzzles.length > 30 ? (
                  <div>
                    <div className="flex justify-between text-[11px] text-text-secondary font-semibold mb-1">
                      <span>{t('tactics.solvedSelection')}</span>
                      <span>{solvedHere} / {puzzles.length}</span>
                    </div>
                    <div className="w-full h-2 bg-bg-darker rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(solvedHere / puzzles.length) * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-1.5 pt-1">
                    {puzzles.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => setIndex(i)}
                        title={pick(p.title, lang)}
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
                )}
              </div>

              <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-text-primary mb-3">{t('common.statistics')}</h2>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">{t('adaptive.puzzleRating')}</dt>
                    <dd className="text-text-primary font-bold">
                      {progress.puzzleRating}
                      {ratingDelta !== null && ratingDelta !== 0 && (
                        <span className={`ml-1.5 ${ratingDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>{ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between"><dt className="text-text-secondary">{t('tactics.statSolved')}</dt><dd className="text-text-primary font-bold">{progress.solvedPuzzles.length} / {PUZZLES.length}</dd></div>
                  <div className="flex justify-between"><dt className="text-text-secondary">{t('tactics.statFirstTry')}</dt><dd className="text-text-primary font-bold">{accuracy}%</dd></div>
                  <div className="flex justify-between"><dt className="text-text-secondary">{t('tactics.statStreak')}</dt><dd className="text-text-primary font-bold inline-flex items-center gap-1">{progress.streak} <Icon name="flame" className="w-3.5 h-3.5 text-orange-500" /></dd></div>
                  <div className="flex justify-between"><dt className="text-text-secondary">{t('tactics.statBestStreak')}</dt><dd className="text-text-primary font-bold">{progress.bestStreak}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
