import React from 'react';
import type { Difficulty, GameStatus } from '../types/chess';

interface GameControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  status: GameStatus;
  isComputerThinking: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onUndo,
  difficulty,
  onDifficultyChange,
  status,
  isComputerThinking,
}) => {
  const getStatusMessage = (): string => {
    switch (status) {
      case 'check':
        return 'Check!';
      case 'checkmate':
        return 'Checkmate!';
      case 'stalemate':
        return 'Stalemate';
      case 'draw':
        return 'Draw';
      default:
        return isComputerThinking ? 'Computer thinking...' : 'Your turn';
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'check':
        return 'text-yellow-400';
      case 'checkmate':
        return 'text-red-400';
      case 'stalemate':
      case 'draw':
        return 'text-blue-400';
      default:
        return 'text-text-primary';
    }
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 space-y-4">
      <div className="text-center">
        <p className={`text-xl font-bold ${getStatusColor()}`}>
          {getStatusMessage()}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-text-secondary text-sm mb-2">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => onDifficultyChange(Number(e.target.value) as Difficulty)}
            className="w-full bg-bg-darker text-text-primary rounded-lg px-4 py-2 border border-bg-darker focus:border-accent focus:outline-none"
          >
            <option value={1}>Beginner</option>
            <option value={2}>Easy</option>
            <option value={3}>Medium</option>
            <option value={4}>Hard</option>
            <option value={5}>Expert</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNewGame}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            New Game
          </button>
          <button
            onClick={onUndo}
            className="flex-1 bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2 px-4 rounded-lg border border-bg-darker transition-colors"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
};
