import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { soundEffects } from '../utils/soundEffects';
import { POSITIONS } from '../data/positions';
import { updateProgress, useProgress } from '../lib/progress';

export const CoachPosition: React.FC = () => {
  const [index, setIndex] = useState(0);
  const pos = POSITIONS[index];
  const chessRef = useRef(new Chess(pos.fen));
  const [fen, setFen] = useState(pos.fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<'playing' | 'correct' | 'incorrect'>('playing');
  const [feedback, setFeedback] = useState('');
  const progress = useProgress();

  const sideToMove = pos.fen.split(' ')[1] === 'w' ? 'White' : 'Black';

  const loadPosition = () => {
    chessRef.current = new Chess(pos.fen);
    setFen(pos.fen);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setLastMove(null);
    setStatus('playing');
    setFeedback(`Find the best move for ${sideToMove} in this ${pos.theme.toLowerCase()} position.`);
  };

  useEffect(loadPosition, [index]);

  const handleSquareClick = (square: string) => {
    const chess = chessRef.current;
    if (status !== 'playing') return;

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
        setStatus('correct');
        setFeedback(
          move.san === pos.bestMove
            ? `✅ Correct! ${pos.explanation}`
            : `✅ Good move! ${move.san} is also strong. The engine's first choice is ${pos.bestMove}: ${pos.explanation}`
        );
        soundEffects.playSuccess();
      } else {
        setStatus('incorrect');
        setFeedback(`❌ Not quite. The best move is ${pos.bestMove}${pos.accepted.length ? ` (${pos.accepted.join(', ')} also work)` : ''}. ${pos.explanation}`);
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

  const accuracy = progress.positionAttempts > 0 ? Math.round((progress.positionCorrect / progress.positionAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">🎯 Position Trainer</h1>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-4">
            Master key opening positions. Every answer was checked against Stockfish.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
            <div className="game-board-container flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center font-bold text-sm sm:text-lg">📍</div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-text-primary">Position #{pos.id}</div>
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">
                      {pos.theme} · {sideToMove} to move
                    </span>
                  </div>
                </div>
                {progress.solvedPositions.includes(pos.id) && <span className="text-xs font-bold text-green-600">✓ Mastered</span>}
              </div>

              <ChessBoard
                gameState={{
                  fen,
                  turn: chessRef.current.turn(),
                  moves: [],
                  status: 'playing',
                  selectedSquare,
                  possibleMoves,
                  lastMove,
                }}
                onSquareClick={handleSquareClick}
                pendingPromotion={null}
                onPromoteSelect={() => {}}
                onPromoteCancel={() => {}}
                flipped={sideToMove === 'Black'}
              />
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3 sm:space-y-4 order-1 lg:order-2">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent text-xl">🎓</div>
                <div>
                  <h4 className="font-bold text-text-primary">AI Coach</h4>
                  <p className="text-[10px] text-text-secondary font-bold uppercase">Position Training</p>
                </div>
              </div>

              <div className={`bg-bg-darker/40 border rounded-xl p-4 ${
                status === 'correct' ? 'border-green-500/40' : status === 'incorrect' ? 'border-red-500/40' : 'border-gray-100'
              }`}>
                <p className="text-sm text-text-primary leading-relaxed font-medium">{feedback}</p>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {POSITIONS.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setIndex(i)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                      i === index
                        ? 'bg-accent text-white border-accent'
                        : progress.solvedPositions.includes(p.id)
                          ? 'bg-green-500/10 text-green-700 border-green-500/30'
                          : 'bg-bg-dark text-text-primary hover:bg-bg-darker border-gray-200'
                    }`}
                  >
                    #{p.id}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={loadPosition} className="bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors">
                  Retry
                </button>
                <button
                  onClick={() => setIndex((i) => (i + 1) % POSITIONS.length)}
                  className={`font-bold py-2.5 px-4 rounded-xl text-xs transition-colors ${status !== 'playing' ? 'bg-accent hover:bg-accent-hover text-white' : 'bg-bg-dark hover:bg-bg-darker text-text-primary border border-gray-200'}`}
                >
                  Next →
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-text-primary mb-3">📊 Statistics</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-text-secondary">Positions mastered</span><span className="text-text-primary font-bold">{progress.solvedPositions.length} / {POSITIONS.length}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Accuracy</span><span className="text-text-primary font-bold">{accuracy}%</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Attempts</span><span className="text-text-primary font-bold">{progress.positionAttempts}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
