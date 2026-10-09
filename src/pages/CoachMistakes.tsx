import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { soundEffects } from '../utils/soundEffects';
import { evaluatePositions } from '../lib/analysis';
import { describeMove } from '../lib/explain';
import { dueMistakes, isGoodEnough, reviewMistake } from '../lib/adaptive';
import { updateProgress, useProgress, type MistakeCard } from '../lib/progress';
import { useI18n } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';

type Outcome = { kind: 'playing' } | { kind: 'checking' } | { kind: 'best' } | { kind: 'alternative'; move: string } | { kind: 'missed'; move: string; same: boolean };

// "Review my mistakes": positions where the player went wrong in their own games come back
// as exercises, more often when missed, less often once known (spaced repetition).
export const CoachMistakes: React.FC = () => {
  const { t, lang } = useI18n();
  const progress = useProgress();
  const san = (m: string) => localSan(m, lang);

  // Cards seen in this visit are not shown again until the page is reloaded
  const [seen, setSeen] = useState<string[]>([]);
  const due = useMemo(() => dueMistakes(progress).filter((m) => !seen.includes(m.id)), [progress, seen]);
  const [card, setCard] = useState<MistakeCard | null>(null);
  useEffect(() => {
    if (!card && due.length) setCard(due[0]);
  }, [card, due]);

  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'playing' });
  const cancelRef = useRef<(() => void) | null>(null);

  const load = (c: MistakeCard | null) => {
    cancelRef.current?.();
    if (!c) return;
    chessRef.current = new Chess(c.fen);
    setFen(c.fen);
    setSelected(null);
    setPossible([]);
    setLastMove(null);
    setOutcome({ kind: 'playing' });
  };
  useEffect(() => load(card), [card]);
  useEffect(() => () => cancelRef.current?.(), []);

  const finish = (c: MistakeCard, solved: boolean, result: Outcome) => {
    setOutcome(result);
    updateProgress((p) => reviewMistake(p, c.id, solved));
    if (solved) soundEffects.playSuccess();
    else soundEffects.playError();
  };

  const onSquareClick = (square: string) => {
    if (!card || outcome.kind !== 'playing') return;
    const chess = chessRef.current;
    if (selected && possible.includes(square)) {
      const move = chess.move({ from: selected, to: square, promotion: 'q' });
      setFen(chess.fen());
      setLastMove({ from: move.from, to: move.to });
      setSelected(null);
      setPossible([]);
      if (move.san === card.best) return finish(card, true, { kind: 'best' });
      if (move.san === card.played) return finish(card, false, { kind: 'missed', move: move.san, same: true });
      if (chess.isCheckmate()) return finish(card, true, { kind: 'alternative', move: move.san });

      // Another move: ask the engine whether it is as good as the best one
      setOutcome({ kind: 'checking' });
      const job = evaluatePositions([chess.fen()]);
      cancelRef.current = job.cancel;
      job.promise.then(([score]) => {
        cancelRef.current = null;
        if (score === undefined) return;
        const mover = card.fen.split(' ')[1] === 'w' ? score : -score;
        if (isGoodEnough(card.evalBefore, mover)) finish(card, true, { kind: 'alternative', move: move.san });
        else finish(card, false, { kind: 'missed', move: move.san, same: false });
      });
      return;
    }
    const piece = chess.get(square as never);
    if (piece && piece.color === chess.turn() && square !== selected) {
      setSelected(square);
      setPossible(chess.moves({ square: square as never, verbose: true }).map((m) => m.to));
    } else {
      setSelected(null);
      setPossible([]);
    }
  };

  const next = () => {
    if (card) setSeen((s) => [...s, card.id]);
    setCard(null);
  };

  const total = progress.mistakes.length;
  const known = progress.mistakes.filter((m) => m.box >= 3).length;
  const nextDue = progress.mistakes.length ? Math.min(...progress.mistakes.map((m) => m.due)) : null;

  if (!card && due.length) return null; // the first card is being picked
  if (!card) {
    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans">
        <div className="max-w-3xl mx-auto">
          <PageHeader icon="undo" title={t('mistakes.title')} subtitle={t('mistakes.subtitle')} />
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 text-center shadow-sm">
            <span className="inline-flex w-12 h-12 rounded-2xl bg-green-500/10 text-green-700 items-center justify-center mb-3">
              <Icon name="check" className="w-6 h-6" />
            </span>
            <h2 className="font-bold text-text-primary mb-2">{total ? t('mistakes.allDone') : t('mistakes.emptyTitle')}</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-5">
              {total
                ? t('mistakes.allDoneText', { date: nextDue ? new Date(Math.max(nextDue, Date.now())).toLocaleDateString(lang) : '—' })
                : t('mistakes.emptyText')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/game" className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors">
                <Icon name="board" className="w-4 h-4" /> {t('mistakes.play')}
              </Link>
              <Link to="/coach/elo" className="inline-flex items-center gap-1.5 bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-sm border border-gray-200 transition-colors">
                <Icon name="chart" className="w-4 h-4" /> {t('mistakes.import')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const side = t(card.fen.split(' ')[1] === 'w' ? 'common.white' : 'common.black');
  const pawns = Math.max(1, Math.round(card.loss / 100));
  const bestWhy = outcome.kind !== 'playing' && outcome.kind !== 'checking' ? describeMove(card.fen, card.best, t) : [];
  const playedWhy = describeMove(card.fen, card.played, t);

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="undo" title={t('mistakes.title')} subtitle={t('mistakes.subtitle')} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
            <div className="game-board-container flex flex-col items-center w-full">
              {fen && <ChessBoard
                gameState={{ fen, turn: chessRef.current.turn(), moves: [], status: 'playing', selectedSquare: selected, possibleMoves: possible, lastMove }}
                onSquareClick={onSquareClick}
                pendingPromotion={null}
                onPromoteSelect={() => {}}
                onPromoteCancel={() => {}}
                flipped={card.fen.split(' ')[1] === 'b'}
              />}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('common.toMove', { side })}</span>
                <span className="text-[11px] font-bold text-text-secondary">{t('mistakes.left', { n: due.length })}</span>
              </div>

              <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-4">
                <p className="text-sm text-text-primary leading-relaxed">
                  {t('mistakes.prompt', { move: san(card.played), n: pawns })}
                </p>
                {outcome.kind === 'playing' && <p className="text-sm font-bold text-text-primary mt-2">{t('mistakes.findBetter')}</p>}
              </div>

              {outcome.kind !== 'playing' && (
                <div
                  aria-live="polite"
                  className={`border rounded-xl p-4 space-y-2 ${
                    outcome.kind === 'checking' ? 'border-gray-100' : outcome.kind === 'missed' ? 'border-red-500/40 bg-red-500/5' : 'border-green-500/40 bg-green-500/5'
                  }`}
                >
                  {outcome.kind === 'checking' && <p className="text-sm text-text-secondary">{t('mistakes.checking')}</p>}
                  {outcome.kind === 'best' && <p className="text-sm font-bold text-green-700">{t('mistakes.best')}</p>}
                  {outcome.kind === 'alternative' && <p className="text-sm font-bold text-green-700">{t('mistakes.alternative', { move: san(outcome.move), best: san(card.best) })}</p>}
                  {outcome.kind === 'missed' && (
                    <p className="text-sm font-bold text-red-600">
                      {outcome.same ? t('mistakes.same') : t('mistakes.missed', { move: san(outcome.move) })} {t('mistakes.bestWas', { best: san(card.best) })}
                    </p>
                  )}
                  {bestWhy.length > 0 && <p className="text-sm text-text-primary leading-relaxed">{t('mistakes.why', { best: san(card.best) })} {bestWhy.join(' ')}</p>}
                  {outcome.kind === 'missed' && <p className="text-xs text-text-secondary leading-relaxed">{t('mistakes.inGame', { move: san(card.played) })} {playedWhy.join(' ')}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => load(card)}
                  disabled={outcome.kind === 'checking'}
                  className="inline-flex items-center justify-center gap-1.5 bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors disabled:opacity-50"
                >
                  <Icon name="refresh" className="w-4 h-4" /> {t('common.retry')}
                </button>
                <button
                  onClick={next}
                  disabled={outcome.kind === 'checking'}
                  className={`inline-flex items-center justify-center gap-1.5 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors disabled:opacity-50 ${
                    outcome.kind === 'playing' ? 'bg-bg-dark hover:bg-bg-darker text-text-primary border border-gray-200' : 'bg-accent hover:bg-accent-hover text-white'
                  }`}
                >
                  {outcome.kind === 'playing' ? t('mistakes.skip') : t('common.next')} <Icon name="arrowRight" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-text-primary mb-3">{t('common.statistics')}</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-text-secondary">{t('mistakes.statTotal')}</dt><dd className="text-text-primary font-bold">{total}</dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">{t('mistakes.statKnown')}</dt><dd className="text-text-primary font-bold">{known}</dd></div>
              </dl>
              <p className="text-[11px] text-text-secondary mt-3 leading-relaxed">{t('mistakes.howItWorks')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
