import React from 'react';
import { Chess } from 'chess.js';
import { renderPieceSVG } from './PieceSVGs';

interface MiniBoardProps {
  fen: string;
  highlight?: string[]; // squares to mark, e.g. ['g5', 'f6']
  flipped?: boolean;
  className?: string;
}

// A small, non-interactive board for illustrations (home page, lessons, cards)
export const MiniBoard: React.FC<MiniBoardProps> = ({ fen, highlight = [], flipped = false, className = '' }) => {
  const board = new Chess(fen).board();
  const rows = flipped ? [...board].reverse().map((r) => [...r].reverse()) : board;
  return (
    <div className={`grid grid-cols-8 grid-rows-8 aspect-square rounded-xl overflow-hidden ${className}`} role="img" aria-label={fen}>
      {rows.flatMap((row, r) =>
        row.map((piece, c) => {
          const file = flipped ? 7 - c : c;
          const rank = flipped ? r + 1 : 8 - r;
          const square = `${'abcdefgh'[file]}${rank}`;
          const light = (file + rank) % 2 === 0;
          const marked = highlight.includes(square);
          return (
            <div
              key={square}
              className={`relative flex items-center justify-center ${
                marked ? (light ? 'bg-[#f6e7a8]' : 'bg-[#e6cb6a]') : light ? 'bg-board-light' : 'bg-board-dark'
              }`}
            >
              {piece && <div className="w-[86%] h-[86%]">{renderPieceSVG(piece.color, piece.type, 'w-full h-full')}</div>}
            </div>
          );
        })
      )}
    </div>
  );
};
