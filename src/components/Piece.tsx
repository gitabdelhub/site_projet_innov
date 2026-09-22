import React from 'react';
import { renderPieceSVG } from './PieceSVGs';
import type { Piece as PieceType } from '../types/chess';

interface PieceProps {
  piece: PieceType;
  isDragging?: boolean;
}

export const Piece: React.FC<PieceProps> = ({ piece, isDragging = false }) => {
  return (
    <div
      className={`w-[85%] h-[85%] flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isDragging ? 'scale-110 rotate-1' : 'hover:scale-105 hover:-translate-y-[2px]'
      }`}
    >
      {renderPieceSVG(piece.color, piece.type, "w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]")}
    </div>
  );
};
