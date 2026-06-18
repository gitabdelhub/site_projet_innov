import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { soundEffects } from '../utils/soundEffects';

export const CoachPosition: React.FC = () => {
  const [positionChess, setPositionChess] = useState<Chess | null>(null);
  const [positionFen, setPositionFen] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('Find the best move for White in this position.');
  const [status, setStatus] = useState<'playing' | 'correct' | 'incorrect'>('playing');
  const [positionNumber, setPositionNumber] = useState(1);
  const [solvedCount, setSolvedCount] = useState(0);
  const [accuracy, setAccuracy] = useState(0);

  const positions: Record<number, { fen: string; theme: string; bestMove: string; explanation: string }> = {
    1: {
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      theme: 'Opening',
      bestMove: 'e5',
      explanation: 'Playing e5 is the most principled response to e4, controlling the center.'
    },
    2: {
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      theme: 'Development',
      bestMove: 'Nf3',
      explanation: 'Developing the knight to f3 controls the center and prepares for castling.'
    },
    3: {
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      theme: 'Development',
      bestMove: 'Bc4',
      explanation: 'Developing the bishop to c4 targets the weak f7 square.'
    },
    4: {
      fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      theme: 'Development',
      bestMove: 'Nf6',
      explanation: 'Developing the knight to f6 attacks e4 and prepares for castling.'
    },
    5: {
      fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      theme: 'Safety',
      bestMove: 'O-O',
      explanation: 'Castling kingside brings the king to safety and connects the rooks.'
    },
    6: {
      fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1K1R b kq - 5 5',
      theme: 'Safety',
      bestMove: 'O-O',
      explanation: 'Castling kingside is the standard response to maintain king safety.'
    }
  };

  const loadPosition = (num: number) => {
    setPositionNumber(num);
    setStatus('playing');
    setSelectedSquare(null);
    setPossibleMoves([]);
    
    try {
      const pos = positions[num] || positions[1];
      const chessInstance = new Chess(pos.fen);
      setPositionChess(chessInstance);
      setPositionFen(chessInstance.fen());
      setFeedback(`Find the best move for White in this ${pos.theme} position.`);
    } catch (error) {
      console.error('Error loading position:', error);
      setFeedback('Error loading position. Please try again.');
    }
  };

  const handleSquareClick = (square: string) => {
    if (!positionChess || status !== 'playing') return;

    const selected = selectedSquare;

    if (selected === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    if (selected) {
      const moves = positionChess.moves({ square: selected as any, verbose: true }) as any[];
      const validMove = moves.find(m => m.to === square);

      if (validMove) {
        positionChess.move({ from: selected, to: square });
        setPositionFen(positionChess.fen());
        setSelectedSquare(null);
        setPossibleMoves([]);
        soundEffects.playMove();

        const pos = positions[positionNumber];
        if (validMove.san === pos.bestMove || validMove.to === pos.bestMove) {
          setStatus('correct');
          setSolvedCount(prev => prev + 1);
          setAccuracy(prev => Math.round(((prev * (solvedCount || 1)) + 100) / (solvedCount + 1)));
          setFeedback(`✅ Correct! ${pos.explanation}`);
          soundEffects.playSuccess();
        } else {
          setAccuracy(prev => Math.round((prev * (solvedCount || 1)) / (solvedCount + 1)));
          setStatus('incorrect');
          setFeedback(`❌ Not quite. The best move was ${pos.bestMove}. ${pos.explanation}`);
          soundEffects.playError();
        }
        return;
      }
    }

    const piece = positionChess.get(square as any);
    if (piece && piece.color === positionChess.turn()) {
      setSelectedSquare(square);
      const moves = positionChess.moves({ square: square as any, verbose: true }) as any[];
      setPossibleMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  React.useEffect(() => {
    loadPosition(1);
  }, []);

  // Fallback: if positionFen is empty after loading, set a default starting position
  React.useEffect(() => {
    if (!positionFen) {
      const defaultChess = new Chess();
      setPositionChess(defaultChess);
      setPositionFen(defaultChess.fen());
      setFeedback('Find the best move for White in this position.');
    }
  }, [positionFen]);

  const currentPos = positions[positionNumber];

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-text-primary tracking-tight mb-2">🎯 Position Trainer</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Master critical positions from different openings and middlegames. Improve your positional understanding.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="game-board-container flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center font-bold text-lg">📍</div>
                  <div>
                    <div className="font-bold text-sm text-text-primary">Position #{positionNumber}</div>
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold font-mono">
                      {currentPos?.theme}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex gap-3 md:gap-4 items-stretch justify-center">
                <div className="flex-1">
                  {positionChess && positionFen ? (
                    <ChessBoard
                      gameState={{
                        fen: positionFen,
                        turn: positionChess.turn(),
                        moves: [],
                        status: status === 'correct' ? 'checkmate' : 'playing',
                        selectedSquare,
                        possibleMoves,
                        lastMove: null
                      }}
                      onSquareClick={handleSquareClick}
                      pendingPromotion={null}
                      onPromoteSelect={() => {}}
                      onPromoteCancel={() => {}}
                    />
                  ) : (
                    <div className="bg-bg-card border border-gray-200 rounded-xl p-8 text-center">
                      <p className="text-text-secondary">Loading position...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent text-xl">🎓</div>
                <div>
                  <h4 className="font-bold text-text-primary">AI Coach</h4>
                  <p className="text-[10px] text-text-secondary font-bold uppercase">Position Training</p>
                </div>
              </div>

              <div className={`bg-bg-darker/40 border rounded-xl p-4 ${
                status === 'correct' ? 'border-green-500/30' : status === 'incorrect' ? 'border-red-500/30' : 'border-gray-100'
              }`}>
                <p className="text-sm text-text-primary leading-relaxed font-medium">
                  {feedback}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => loadPosition(num)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                      positionNumber === num
                        ? 'bg-accent text-white'
                        : 'bg-bg-dark text-text-primary hover:bg-bg-darker border border-gray-200'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => loadPosition(positionNumber)}
                className="w-full bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors"
              >
                Reset Position
              </button>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-text-primary mb-3">📊 Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Positions Solved</span>
                  <span className="text-text-primary font-bold">{solvedCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Accuracy</span>
                  <span className="text-text-primary font-bold">{accuracy}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Themes Mastered</span>
                  <span className="text-text-primary font-bold">{Math.floor(solvedCount / 2)}/3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
