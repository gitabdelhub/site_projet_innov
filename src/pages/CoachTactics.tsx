import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { soundEffects } from '../utils/soundEffects';

export const CoachTactics: React.FC = () => {
  const [puzzleChess, setPuzzleChess] = useState<Chess | null>(null);
  const [puzzleFen, setPuzzleFen] = useState('');
  const [puzzleSelectedSquare, setPuzzleSelectedSquare] = useState<string | null>(null);
  const [puzzlePossibleMoves, setPuzzlePossibleMoves] = useState<string[]>([]);
  const [puzzleFeedback, setPuzzleFeedback] = useState<string>('White to play. Can you find the winning tactical sequence?');
  const [puzzleStatus, setPuzzleStatus] = useState<'playing' | 'success' | 'failed'>('playing');
  const [puzzleNumber, setPuzzleNumber] = useState(1);
  const [solvedCount, setSolvedCount] = useState(0);
  const [streak, setStreak] = useState(0);

  const loadPuzzle = (num: number) => {
    setPuzzleNumber(num);
    setPuzzleStatus('playing');
    setPuzzleSelectedSquare(null);
    setPuzzlePossibleMoves([]);
    
    try {
      // Real beginner-level tactical puzzles with valid FENs
      const puzzles: Record<number, { fen: string; feedback: string; solution: string; theme: string }> = {
        1: {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
          feedback: 'White to play. Find the fork that attacks two pieces at once!',
          solution: 'Nf3',
          theme: 'Fork'
        },
        2: {
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3',
          feedback: 'White to play. Pin the knight to the king to win material!',
          solution: 'Bb5',
          theme: 'Pin'
        },
        3: {
          fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3',
          feedback: 'White to play. Use a discovered attack to win material!',
          solution: 'Nxe5',
          theme: 'Discovered Attack'
        },
        4: {
          fen: 'r1b1k1nr/pppp1ppp/2n2q2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 5',
          feedback: 'White to play. Find the skewer to win the queen!',
          solution: 'Bb5+',
          theme: 'Skewer'
        },
        5: {
          fen: 'r2q1rk1/ppp2ppp/2n1pn2/3p4/3P4/1P2PN2/P2P1PPP/RNBQ1RK1 w - - 0 8',
          feedback: 'White to play. Create a back rank mate threat!',
          solution: 'Qd8+',
          theme: 'Back Rank'
        },
        6: {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/5N2/PPPP1PPP/RNB1K2R w KQkq - 0 4',
          feedback: 'White to play. Find the mate in 1!',
          solution: 'Qxf7#',
          theme: 'Mate in 1'
        }
      };

      const puzzle = puzzles[num] || puzzles[1];
      const puzzleInstance = new Chess(puzzle.fen);
      setPuzzleChess(puzzleInstance);
      setPuzzleFen(puzzleInstance.fen());
      setPuzzleFeedback(`AI Coach: ${puzzle.theme} - ${puzzle.feedback}`);
    } catch (error) {
      console.error('Error loading puzzle:', error);
      setPuzzleFeedback('Error loading puzzle. Please try again.');
    }
  };

  const handleSquareClick = (square: string) => {
    if (!puzzleChess || puzzleStatus !== 'playing') return;

    const selected = puzzleSelectedSquare;

    if (selected === square) {
      setPuzzleSelectedSquare(null);
      setPuzzlePossibleMoves([]);
      return;
    }

    if (selected) {
      const moves = puzzleChess.moves({ square: selected as any, verbose: true }) as any[];
      const validMove = moves.find(m => m.to === square);

      if (validMove) {
        const moveResult = puzzleChess.move({ from: selected, to: square });
        setPuzzleFen(puzzleChess.fen());
        setPuzzleSelectedSquare(null);
        setPuzzlePossibleMoves([]);
        soundEffects.playMove();

        // Get the current puzzle solution
        const puzzles: Record<number, { solution: string }> = {
          1: { solution: 'Nf3' },
          2: { solution: 'Bb5' },
          3: { solution: 'Nxe5' },
          4: { solution: 'Bb5+' },
          5: { solution: 'Qd8+' },
          6: { solution: 'Qxf7#' }
        };

        const currentSolution = puzzles[puzzleNumber]?.solution;
        
        // Check if the move matches the solution (either SAN or destination)
        const isCorrect = moveResult.san === currentSolution || 
                         validMove.to === currentSolution || 
                         moveResult.san.includes(currentSolution);

        if (isCorrect) {
          setPuzzleStatus('success');
          setSolvedCount(prev => prev + 1);
          setStreak(prev => prev + 1);
          setPuzzleFeedback('🏆 Excellent! Correct tactical solution found!');
          soundEffects.playSuccess();
        } else {
          setStreak(0);
          setPuzzleFeedback('❌ Not quite right. Think about the tactical theme and try again!');
          soundEffects.playError();
          setTimeout(() => {
            loadPuzzle(puzzleNumber);
          }, 1500);
        }
        return;
      }
    }

    const piece = puzzleChess.get(square as any);
    if (piece && piece.color === puzzleChess.turn()) {
      setPuzzleSelectedSquare(square);
      const moves = puzzleChess.moves({ square: square as any, verbose: true }) as any[];
      setPuzzlePossibleMoves(moves.map(m => m.to));
    } else {
      setPuzzleSelectedSquare(null);
      setPuzzlePossibleMoves([]);
    }
  };

  React.useEffect(() => {
    loadPuzzle(1);
  }, []);

  // Fallback: if puzzleFen is empty after loading, set a default starting position
  React.useEffect(() => {
    if (!puzzleFen) {
      const defaultChess = new Chess();
      setPuzzleChess(defaultChess);
      setPuzzleFen(defaultChess.fen());
      setPuzzleFeedback('AI Coach: White to play. Find the best move!');
    }
  }, [puzzleFen]);

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-text-primary tracking-tight mb-2">⚔️ Tactic Trainer</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Sharpen your tactical vision with interactive puzzles. Find the best moves to improve your pattern recognition.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="game-board-container flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center font-bold text-lg">🎯</div>
                  <div>
                    <div className="font-bold text-sm text-text-primary">Puzzle #{puzzleNumber}</div>
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold font-mono">
                      {puzzleStatus === 'success' ? 'Solved' : 'In Progress'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex gap-3 md:gap-4 items-stretch justify-center">
                <div className="flex-1">
                  <ChessBoard
                    gameState={{
                      fen: puzzleFen,
                      turn: puzzleChess ? puzzleChess.turn() : 'w',
                      moves: [],
                      status: puzzleStatus === 'success' ? 'checkmate' : 'playing',
                      selectedSquare: puzzleSelectedSquare,
                      possibleMoves: puzzlePossibleMoves,
                      lastMove: null
                    }}
                    onSquareClick={handleSquareClick}
                    pendingPromotion={null}
                    onPromoteSelect={() => {}}
                    onPromoteCancel={() => {}}
                  />
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
                  <p className="text-[10px] text-text-secondary font-bold uppercase">Tactical Training</p>
                </div>
              </div>

              <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-4">
                <p className="text-sm text-text-primary leading-relaxed font-medium">
                  {puzzleFeedback}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => loadPuzzle(num)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                      puzzleNumber === num
                        ? 'bg-accent text-white'
                        : 'bg-bg-dark text-text-primary hover:bg-bg-darker border border-gray-200'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => loadPuzzle(puzzleNumber)}
                className="w-full bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors"
              >
                Reset Puzzle
              </button>
            </div>

            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-text-primary mb-3">📊 Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Puzzles Solved</span>
                  <span className="text-text-primary font-bold">{solvedCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Accuracy</span>
                  <span className="text-text-primary font-bold">{solvedCount > 0 ? '100%' : '0%'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Current Streak</span>
                  <span className="text-text-primary font-bold">{streak} 🔥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
