import React from 'react';
import { Square } from './Square';
import { FILES, RANKS } from '../utils/boardUtils';
import type { GameState } from '../types/chess';
import { Chess } from 'chess.js';
import { PromotionModal } from './PromotionModal';

interface ChessBoardProps {
  gameState: GameState;
  onSquareClick: (square: string) => void;
  pendingPromotion: { from: string; to: string; color: 'w' | 'b' } | null;
  onPromoteSelect: (pieceType: string) => void;
  onPromoteCancel: () => void;
  flipped?: boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  gameState,
  onSquareClick,
  pendingPromotion,
  onPromoteSelect,
  onPromoteCancel,
  flipped = false,
}) => {
  const chess = new Chess(gameState.fen);
  const board = chess.board();

  const ranksList = flipped ? [...RANKS].reverse() : RANKS;
  const filesList = flipped ? [...FILES].reverse() : FILES;

  const isKingInCheck = (color: 'w' | 'b'): boolean => {
    return chess.isCheck() && chess.turn() === color;
  };

  return (
    <div className="relative aspect-square w-full max-w-[400px] sm:max-w-[500px] md:max-w-[600px] mx-auto rounded-lg overflow-hidden shadow-2xl border-4 border-bg-darker">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranksList.map((rank) =>
          filesList.map((file) => {
            const square = `${file}${rank}`;
            const piece = board[8 - parseInt(rank)][file.charCodeAt(0) - 97];
            const isSelected = gameState.selectedSquare === square;
            const isPossibleMove = gameState.possibleMoves.includes(square);
            const isLastMove = !!(
              gameState.lastMove &&
              (gameState.lastMove.from === square || gameState.lastMove.to === square)
            );
            const isCheck = piece?.type === 'k' && isKingInCheck(piece.color);

            return (
              <Square
                key={square}
                square={square}
                piece={piece || null}
                isSelected={isSelected}
                isPossibleMove={isPossibleMove}
                isLastMove={isLastMove}
                isCheck={isCheck}
                onClick={() => onSquareClick(square)}
              />
            );
          })
        )}
      </div>
      <PromotionModal
        isOpen={!!pendingPromotion}
        color={pendingPromotion?.color || 'w'}
        onSelect={onPromoteSelect}
        onClose={onPromoteCancel}
      />
    </div>
  );
};
