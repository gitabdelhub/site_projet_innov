import React from 'react';
import { Piece } from './Piece';
import { getSquareColor } from '../utils/boardUtils';
import type { Piece as PieceType } from '../types/chess';

interface SquareProps {
  square: string;
  piece: PieceType | null;
  isSelected: boolean;
  isPossibleMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  onClick: () => void;
}

export const Square: React.FC<SquareProps> = ({
  square,
  piece,
  isSelected,
  isPossibleMove,
  isLastMove,
  isCheck,
  onClick,
}) => {
  const color = getSquareColor(square);
  
  const getBackgroundColor = () => {
    if (isSelected) return 'bg-board-selected';
    if (isLastMove) return 'bg-board-highlight';
    if (isCheck && piece?.type === 'k') return 'bg-red-500/35 radial-check';
    return color === 'light' ? 'bg-board-light' : 'bg-board-dark';
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full h-full flex items-center justify-center
        ${getBackgroundColor()}
        transition-colors duration-150
        hover:brightness-105
        focus:outline-none
      `}
      aria-label={square}
    >
      {piece && <Piece piece={piece} />}
      
      {/* Possible move dot (empty square) */}
      {isPossibleMove && !piece && (
        <div className="absolute w-4 h-4 bg-black/15 rounded-full pointer-events-none" />
      )}
      
      {/* Possible move ring (occupied square) */}
      {isPossibleMove && piece && (
        <div className="absolute w-[80%] h-[80%] border-[5px] border-black/15 rounded-full pointer-events-none" />
      )}
      
      {/* Square coordinate (only for edge squares, styled with alternating colors) */}
      {square[0] === 'a' && (
        <span className={`absolute top-0.5 left-1 text-[10px] font-bold select-none ${
          color === 'light' ? 'text-board-dark' : 'text-board-light'
        }`}>
          {square[1]}
        </span>
      )}
      {square[1] === '1' && (
        <span className={`absolute bottom-0.5 right-1.5 text-[10px] font-bold select-none ${
          color === 'light' ? 'text-board-dark' : 'text-board-light'
        }`}>
          {square[0]}
        </span>
      )}
    </button>
  );
};
