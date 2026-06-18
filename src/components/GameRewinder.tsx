import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Move } from '../types/chess';

interface MoveAnalysis {
  moveIndex: number;
  evaluation: number;
  category: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  comment: string;
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

export const GameRewinder: React.FC<GameRewinderProps> = ({ 
  moves, 
  initialFen, 
  playerColor,
  rewindIndex,
  setRewindIndex,
  isRewindMode,
  setIsRewindMode,
  totalMoves
}) => {
  const [analysis, setAnalysis] = useState<MoveAnalysis[]>([]);

  // Analyze moves when game ends or when rewinding
  useEffect(() => {
    if (moves.length > 0) {
      const moveAnalyses: MoveAnalysis[] = [];
      const chess = new Chess(initialFen);

      moves.forEach((move, index) => {
        chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        
        // Simulated analysis - in real implementation, this would use Stockfish
        const evaluation = Math.random() * 200 - 100; // -100 to +100 centipawns
        let category: MoveAnalysis['category'] = 'good';
        let comment = '';

        if (evaluation > 50) {
          category = 'best';
          comment = 'Excellent move! Best continuation.';
        } else if (evaluation > 20) {
          category = 'good';
          comment = 'Good move, solid position.';
        } else if (evaluation > -10) {
          category = 'inaccuracy';
          comment = 'Slight inaccuracy, could be better.';
        } else if (evaluation > -50) {
          category = 'mistake';
          comment = 'Mistake - better move available.';
        } else {
          category = 'blunder';
          comment = 'Blunder! Serious error.';
        }

        moveAnalyses.push({
          moveIndex: index,
          evaluation,
          category,
          comment
        });
      });

      setAnalysis(moveAnalyses);
    }
  }, [moves, initialFen]);

  const handleRewindStart = () => {
    setIsRewindMode(true);
    setRewindIndex(0);
  };

  const handleRewindStep = (direction: 'forward' | 'backward') => {
    if (direction === 'forward' && rewindIndex !== null && rewindIndex < totalMoves) {
      setRewindIndex(rewindIndex + 1);
    } else if (direction === 'backward' && rewindIndex !== null && rewindIndex > 0) {
      setRewindIndex(rewindIndex - 1);
    }
  };

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const handleAutoPlay = () => {
    if (rewindIndex === null) {
      setRewindIndex(0);
    }
    
    setIsAutoPlaying(true);
    
    let currentIndex = rewindIndex || 0;
    
    const interval = setInterval(() => {
      if (currentIndex >= totalMoves) {
        clearInterval(interval);
        setIsAutoPlaying(false);
        setIsRewindMode(false);
        return;
      }
      currentIndex += 1;
      setRewindIndex(currentIndex);
    }, 800); // 800ms per move for smoother animation

    return () => clearInterval(interval);
  };

  const handleRewindEnd = () => {
    setIsRewindMode(false);
    setRewindIndex(null);
  };

  const getCategoryColor = (category: MoveAnalysis['category']) => {
    switch (category) {
      case 'best': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'inaccuracy': return 'text-yellow-500';
      case 'mistake': return 'text-orange-500';
      case 'blunder': return 'text-red-500';
      default: return 'text-text-secondary';
    }
  };

  const getCategoryIcon = (category: MoveAnalysis['category']) => {
    switch (category) {
      case 'best': return '!!';
      case 'good': return '!';
      case 'inaccuracy': return '?';
      case 'mistake': return '??';
      case 'blunder': return '???';
      default: return '';
    }
  };

  const getCurrentAnalysis = () => {
    if (rewindIndex !== null && rewindIndex > 0 && analysis[rewindIndex - 1]) {
      return analysis[rewindIndex - 1];
    }
    return null;
  };

  const currentAnalysis = getCurrentAnalysis();

  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-bold text-sm">🔄 Game Analysis</h3>
        {!isRewindMode && moves.length > 0 && (
          <button
            onClick={handleRewindStart}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Start Rewind
          </button>
        )}
      </div>

      {isRewindMode ? (
        <div className="space-y-3 flex-1 flex flex-col">
          {/* Rewind Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleRewindStep('backward')}
              disabled={rewindIndex === 0 || isAutoPlaying}
              className="w-8 h-8 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ◀
            </button>
            <button
              onClick={handleAutoPlay}
              disabled={isAutoPlaying || rewindIndex === totalMoves}
              className="w-8 h-8 bg-accent hover:bg-accent-hover border border-accent/30 rounded-lg flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAutoPlaying ? '⏸' : '▶'}
            </button>
            <div className="text-center px-4">
              <div className="text-xs font-bold text-text-secondary">Move</div>
              <div className="text-lg font-bold text-text-primary font-mono">
                {rewindIndex}/{totalMoves}
              </div>
            </div>
            <button
              onClick={() => handleRewindStep('forward')}
              disabled={rewindIndex === totalMoves || isAutoPlaying}
              className="w-8 h-8 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ▶
            </button>
          </div>

          {/* Current Move Analysis */}
          {currentAnalysis && (
            <div className="bg-bg-darker/40 border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getCategoryColor(currentAnalysis.category)}`}>
                    {getCategoryIcon(currentAnalysis.category)}
                  </span>
                  <span className={`text-xs font-bold uppercase ${getCategoryColor(currentAnalysis.category)}`}>
                    {currentAnalysis.category}
                  </span>
                </div>
                {isAutoPlaying && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-accent font-bold">Playing</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-primary leading-relaxed">
                {currentAnalysis.comment}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-text-secondary">Evaluation:</span>
                <span className={`text-xs font-bold font-mono ${currentAnalysis.evaluation > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {currentAnalysis.evaluation > 0 ? '+' : ''}{currentAnalysis.evaluation.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Player vs Opponent Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg-dark/50 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-text-secondary uppercase mb-1">Your Moves</div>
              <div className="text-xs font-bold text-text-primary">
                {analysis.filter((a, i) => (i % 2 === (playerColor === 'w' ? 0 : 1)) && a.category === 'best').length} Best
              </div>
              <div className="text-xs font-bold text-red-500">
                {analysis.filter((a, i) => (i % 2 === (playerColor === 'w' ? 0 : 1)) && a.category === 'blunder').length} Blunders
              </div>
            </div>
            <div className="bg-bg-dark/50 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-text-secondary uppercase mb-1">Opponent</div>
              <div className="text-xs font-bold text-text-primary">
                {analysis.filter((a, i) => (i % 2 === (playerColor === 'w' ? 1 : 0)) && a.category === 'best').length} Best
              </div>
              <div className="text-xs font-bold text-red-500">
                {analysis.filter((a, i) => (i % 2 === (playerColor === 'w' ? 1 : 0)) && a.category === 'blunder').length} Blunders
              </div>
            </div>
          </div>

          <button
            onClick={handleRewindEnd}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors mt-auto"
          >
            Exit Rewind Mode
          </button>
        </div>
      ) : (
        <div className="text-center py-4 flex-1 flex items-center justify-center">
          {moves.length === 0 ? (
            <p className="text-text-secondary text-xs italic">Play a game to analyze</p>
          ) : (
            <p className="text-text-secondary text-xs">Game complete. Click "Start Rewind" to analyze your moves.</p>
          )}
        </div>
      )}
    </div>
  );
};
