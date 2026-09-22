import React from 'react';
import { useMatchmaking } from '../hooks/useMatchmaking';

export const MatchmakingPanel: React.FC = () => {
  const { isSearching, joinQueue, leaveQueue, currentGame } = useMatchmaking();

  if (currentGame) {
    return (
      <div className="bg-bg-card rounded-lg p-4">
        <h3 className="text-text-primary font-bold mb-3">Game Found!</h3>
        <p className="text-text-secondary text-sm mb-4">
          You have been matched with an opponent. The game will start shortly.
        </p>
        <div className="bg-accent/20 rounded-lg p-3 text-center">
          <p className="text-accent font-bold">Game ID: {currentGame.id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-lg p-4">
      <h3 className="text-text-primary font-bold mb-3">Find a Match</h3>
      <p className="text-text-secondary text-sm mb-4">
        Play against players of similar skill level
      </p>
      
      {isSearching ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-accent rounded-full animate-bounce" />
            <div className="w-4 h-4 bg-accent rounded-full animate-bounce delay-100" />
            <div className="w-4 h-4 bg-accent rounded-full animate-bounce delay-200" />
          </div>
          <p className="text-text-secondary text-sm text-center">
            Searching for opponent...
          </p>
          <button
            onClick={leaveQueue}
            className="w-full bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2 px-4 rounded-lg border border-bg-darker transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={joinQueue}
          className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Find Match
        </button>
      )}
    </div>
  );
};
