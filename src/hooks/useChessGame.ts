import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { GameState, GameStatus, Difficulty, Square } from '../types/chess';
import { useStockfish } from './useStockfish';
import { soundEffects } from '../utils/soundEffects';

interface UseChessGameHook {
  gameState: GameState;
  difficulty: Difficulty;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  selectSquare: (square: Square) => void;
  newGame: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
  undoMove: () => void;
  isComputerThinking: boolean;
}

export const useChessGame = (): UseChessGameHook => {
  const [chess] = useState(() => new Chess());
  const [gameState, setGameState] = useState<GameState>(() => ({
    fen: chess.fen(),
    turn: chess.turn(),
    moves: [],
    status: 'playing',
    selectedSquare: null,
    possibleMoves: [],
    lastMove: null,
  }));
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [playAgainstComputer] = useState(true);
  const { isReady, isThinking, getBestMove } = useStockfish();

  const updateGameState = useCallback(() => {
    let status: GameStatus = 'playing';

    if (chess.isCheckmate()) {
      status = 'checkmate';
    } else if (chess.isDraw()) {
      status = 'draw';
    } else if (chess.isStalemate()) {
      status = 'stalemate';
    } else if (chess.isCheck()) {
      status = 'check';
    }

    setGameState({
      fen: chess.fen(),
      turn: chess.turn(),
      moves: chess.history({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        piece: { type: move.piece, color: move.color },
        captured: move.captured ? { type: move.captured, color: move.color === 'w' ? 'b' : 'w' } : undefined,
        promotion: move.promotion,
        san: move.san,
      })),
      status,
      selectedSquare: null,
      possibleMoves: [],
      lastMove: chess.history({ verbose: true }).length > 0
        ? {
            from: chess.history({ verbose: true })[chess.history({ verbose: true }).length - 1].from,
            to: chess.history({ verbose: true })[chess.history({ verbose: true }).length - 1].to,
          }
        : null,
    });
  }, [chess]);

  const makeMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        updateGameState();
        
        // Play appropriate sound effect
        if (chess.isCheckmate()) {
          soundEffects.playGameOver(move.color === 'w'); // player is white usually, so color === 'w' means white mated black -> victory
        } else if (chess.isDraw() || chess.isStalemate()) {
          soundEffects.playGameOver(false);
        } else if (chess.isCheck()) {
          soundEffects.playCheck();
        } else if (move.captured) {
          soundEffects.playCapture();
        } else {
          soundEffects.playMove();
        }

        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, [chess, updateGameState]);

  const selectSquare = useCallback((square: Square) => {
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate' || gameState.status === 'draw') {
      return;
    }

    // If clicking on a possible move, make the move
    if (gameState.selectedSquare && gameState.possibleMoves.includes(square)) {
      const piece = chess.get(gameState.selectedSquare as any);
      const isPawnPromotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1');
      
      if (isPawnPromotion) {
        // Auto-promote to queen for simplicity
        makeMove(gameState.selectedSquare, square, 'q');
      } else {
        makeMove(gameState.selectedSquare, square);
      }
      return;
    }

    // Select a piece
    const piece = chess.get(square as any);
    if (piece && piece.color === chess.turn()) {
      const moves = chess.moves({ square: square as any, verbose: true });
      setGameState({
        ...gameState,
        selectedSquare: square,
        possibleMoves: moves.map((m: any) => m.to),
      });
    } else {
      setGameState({
        ...gameState,
        selectedSquare: null,
        possibleMoves: [],
      });
    }
  }, [gameState, chess, makeMove]);

  const newGame = useCallback(() => {
    chess.reset();
    updateGameState();
  }, [chess, updateGameState]);

  const undoMove = useCallback(() => {
    chess.undo();
    updateGameState();
  }, [chess, updateGameState]);

  // Computer move logic
  useEffect(() => {
    if (
      playAgainstComputer &&
      isReady &&
      gameState.turn === 'b' &&
      gameState.status === 'playing' &&
      !isThinking
    ) {
      const makeComputerMove = async () => {
        const bestMove = await getBestMove(gameState.fen, difficulty);
        if (bestMove) {
          const from = bestMove.substring(0, 2);
          const to = bestMove.substring(2, 4);
          const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
          makeMove(from, to, promotion);
        }
      };

      makeComputerMove();
    }
  }, [gameState.turn, gameState.status, playAgainstComputer, isReady, isThinking, difficulty, gameState.fen, getBestMove, makeMove]);

  return {
    gameState,
    difficulty,
    makeMove,
    selectSquare,
    newGame,
    setDifficulty,
    undoMove,
    isComputerThinking: isThinking,
  };
};
