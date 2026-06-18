import React from 'react';
import { renderPieceSVG } from './PieceSVGs';

interface PromotionModalProps {
  isOpen: boolean;
  color: 'w' | 'b';
  onSelect: (pieceType: string) => void;
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  color,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  const options = [
    { type: 'q', label: 'Queen' },
    { type: 'r', label: 'Rook' },
    { type: 'b', label: 'Bishop' },
    { type: 'n', label: 'Knight' },
  ];

  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30 animate-fade-in backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-[280px] w-full text-center border border-gray-100 transform scale-100 transition-all duration-200">
        <h3 className="text-gray-800 font-bold text-base mb-4">Promote Pawn</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className="bg-bg-darker hover:bg-accent/10 hover:border-accent border border-gray-200 rounded-lg p-3 flex flex-col items-center gap-1 transition-all group"
            >
              <div className="w-12 h-12 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                {renderPieceSVG(color, opt.type, "w-full h-full")}
              </div>
              <span className="text-xs text-text-primary font-semibold group-hover:text-accent transition-colors">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-text-secondary hover:text-text-primary underline font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
