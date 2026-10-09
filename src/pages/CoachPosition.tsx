import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { soundEffects } from '../utils/soundEffects';
import { POSITIONS } from '../data/positions';
import { updateProgress, useProgress } from '../lib/progress';
import { useI18n, pick } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';

type Outcome = { kind: 'playing' } | { kind: 'best' } | { kind: 'good'; played: string } | { kind: 'wrong' };

export const CoachPosition: React.FC = () => {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const pos = POSITIONS[index];
  const chessRef = useRef(new Chess(pos.fen));
  const [fen, setFen] = useState(pos.fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'playing' });
  const progress = useProgress();

  const whiteToMove = pos.fen.split(' ')[1] === 'w';
  const side = t(whiteToMove ? 'common.white' : 'common.black');
  const san = (m: string) => localSan(m, lang);
  const explanation = pick(pos.explanation, lang);

  const loadPosition = () => {
    chessRef.current = new Chess(pos.fen);
    setFen(pos.fen);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setLastMove(null);
    setOutcome({ kind: 'playing' });
  };

  useEffect(loadPosition, [index]);

  const handleSquareClick = (square: string) => {
    const chess = chessRef.current;
    if (outcome.kind !== 'playing') return;

    if (selectedSquare && possibleMoves.includes(square)) {
      const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
      setFen(chess.fen());
      setLastMove({ from: move.from, to: move.to });
      setSelectedSquare(null);
      setPossibleMoves([]);

      const correct = move.san === pos.bestMove || pos.accepted.includes(move.san);
      updateProgress((p) => ({
        ...p,
        positionAttempts: p.positionAttempts + 1,
        positionCorrect: p.positionCorrect + (correct ? 1 : 0),
        solvedPositions: correct && !p.solvedPositions.includes(pos.id) ? [...p.solvedPositions, pos.id] : p.solvedPositions,
      }));

      if (correct) {
        setOutcome(move.san === pos.bestMove ? { kind: 'best' } : { kind: 'good', played: move.san });
        soundEffects.playSuccess();
      } else {
        setOutcome({ kind: 'wrong' });
        soundEffects.playError();
      }
      return;
    }

    const piece = chess.get(square as any);
    if (piece && piece.color === chess.turn() && square !== selectedSquare) {
      setSelectedSquare(square);
      setPossibleMoves(chess.moves({ square: square as any, verbose: true }).map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const feedback =
    outcome.kind === 'playing'
      ? t('positions.prompt', { side, theme: pick(pos.theme, lang).toLowerCase() })
      : outcome.kind === 'best'
        ? `${t('positions.best')} ${explanation}`
        : outcome.kind === 'good'
          ? `${t('positions.good', { move: san(outcome.played), best: san(pos.bestMove) })} ${explanation}`
          : `${t('positions.wrong', { best: san(pos.bestMove) })}${
              pos.accepted.length ? ` ${t('positions.alsoWork', { moves: pos.accepted.map(san).join(', ') })}` : ''
            } ${explanation}`;

  const accuracy = progress.positionAttempts > 0 ? Math.round((progress.positionCorrect / progress.positionAttempts) * 100) : 0;
  const done = outcome.kind !== 'playing';

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="target" title={t('positions.title')} subtitle={t('positions.subtitle')} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
            <div className="game-board-container flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl">
                <div>
                  <div className="font-bold text-sm text-text-primary">{t('positions.number', { n: pos.id })}</div>
                  <span className="text-[11px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">
                    {pick(pos.theme, lang)} · {t('common.toMove', { side })}
                  </span>
                </div>
                {progress.solvedPositions.includes(pos.id) && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                    <Icon name="check" className="w-4 h-4" /> {t('positions.mastered')}
                  </span>
                )}
              </div>

              <ChessBoard
                gameState={{ fen, turn: chessRef.current.turn(), moves: [], status: 'playing', selectedSquare, possibleMoves, lastMove }}
                onSquareClick={handleSquareClick}
                pendingPromotion={null}
                onPromoteSelect={() => {}}
                onPromoteCancel={() => {}}
                flipped={!whiteToMove}
              />
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3 sm:space-y-4 order-1 lg:order-2">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <span className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                  <Icon name="graduation" className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-bold text-text-primary">{t('common.coach')}</h2>
                  <p className="text-[11px] text-text-secondary font-semibold">{t('positions.panel')}</p>
                </div>
              </div>

              <div
                aria-live="polite"
                className={`bg-bg-darker/40 border rounded-xl p-4 ${
                  outcome.kind === 'best' || outcome.kind === 'good' ? 'border-green-500/40' : outcome.kind === 'wrong' ? 'border-red-500/40' : 'border-gray-100'
                }`}
              >
                <p className="text-sm text-text-primary leading-relaxed font-medium">{feedback}</p>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {POSITIONS.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setIndex(i)}
                    aria-label={t('positions.number', { n: p.id })}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                      i === index
                        ? 'bg-accent text-white border-accent'
                        : progress.solvedPositions.includes(p.id)
                          ? 'bg-green-500/10 text-green-700 border-green-500/30'
                          : 'bg-bg-dark text-text-primary hover:bg-bg-darker border-gray-200'
                    }`}
                  >
                    {p.id}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={loadPosition} className="inline-flex items-center justify-center gap-1.5 bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors">
                  <Icon name="refresh" className="w-4 h-4" /> {t('common.retry')}
                </button>
                <button
                  onClick={() => setIndex((i) => (i + 1) % POSITIONS.length)}
                  className={`inline-flex items-center justify-center gap-1.5 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors ${done ? 'bg-accent hover:bg-accent-hover text-white' : 'bg-bg-dark hover:bg-bg-darker text-text-primary border border-gray-200'}`}
                >
                  {t('common.next')} <Icon name="arrowRight" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-text-primary mb-3">{t('common.statistics')}</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-text-secondary">{t('positions.statMastered')}</dt><dd className="text-text-primary font-bold">{progress.solvedPositions.length} / {POSITIONS.length}</dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">{t('common.accuracy')}</dt><dd className="text-text-primary font-bold">{accuracy}%</dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">{t('common.attempts')}</dt><dd className="text-text-primary font-bold">{progress.positionAttempts}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
