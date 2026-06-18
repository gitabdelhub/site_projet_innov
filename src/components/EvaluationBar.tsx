import React from 'react';
import { Chess } from 'chess.js';

interface EvaluationBarProps {
  fen: string;
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({ fen }) => {
  // Calculate material balance
  // wP: 1, wN: 3, wB: 3, wR: 5, wQ: 9
  const getMaterialScore = (): { score: number; text: string; whiteDiff: number } => {
    try {
      const chess = new Chess(fen);
      const board = chess.board();
      
      let whiteScore = 0;
      let blackScore = 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece) {
            let value = 0;
            switch (piece.type) {
              case 'p': value = 1; break;
              case 'n': value = 3; break;
              case 'b': value = 3; break;
              case 'r': value = 5; break;
              case 'q': value = 9; break;
            }
            if (piece.color === 'w') {
              whiteScore += value;
            } else {
              blackScore += value;
            }
          }
        }
      }

      const whiteDiff = whiteScore - blackScore;
      
      if (whiteDiff === 0) {
        return { score: 0.5, text: '0.0', whiteDiff };
      }
      
      // Calculate a ratio for the bar (50% is equal, up to 90% for +10, down to 10% for -10)
      // Clamped between 10% and 90%
      const rawScore = 0.5 + (whiteDiff * 0.04);
      const score = Math.max(0.1, Math.min(0.9, rawScore));
      
      const text = whiteDiff > 0 ? `+${whiteDiff}` : `${whiteDiff}`;
      
      return { score, text, whiteDiff };
    } catch (e) {
      return { score: 0.5, text: '0.0', whiteDiff: 0 };
    }
  };

  const { score, text, whiteDiff } = getMaterialScore();
  
  // White is on the bottom, Black is on the top.
  // Black is dark blue (#2058d0 in our inspiration colors is the board dark, let's use gray/black for Black side and pure white/cream for White side)
  // Wait, the Black portion is at the top, White is at the bottom.
  const blackPercentage = (1 - score) * 100;

  return (
    <div className="w-6 md:w-8 h-full bg-gray-200 rounded-md overflow-hidden flex flex-col border border-gray-300 shadow-inner relative select-none">
      {/* Black area (top portion of the bar) */}
      <div 
        className="w-full bg-[#181818] transition-all duration-500 ease-out relative"
        style={{ height: `${blackPercentage}%` }}
      >
        {whiteDiff < 0 && (
          <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-white z-10">
            {text}
          </span>
        )}
      </div>

      {/* White area (bottom portion of the bar) */}
      <div 
        className="w-full bg-white transition-all duration-500 ease-out relative flex-1"
      >
        {whiteDiff >= 0 && (
          <span className="absolute top-2 left-0 right-0 text-center text-[10px] font-bold text-gray-800 z-10">
            {whiteDiff === 0 ? '0.0' : text}
          </span>
        )}
      </div>
    </div>
  );
};
export default EvaluationBar;
