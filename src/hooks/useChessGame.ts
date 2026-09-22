import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import type { GameState, GameStatus, GameResult, Difficulty, Square, PieceColor } from '../types/chess';
import { useStockfish, LEVEL_SETTINGS } from './useStockfish';
import { soundEffects } from '../utils/soundEffects';

interface UseChessGameHook {
  gameState: GameState;
  result: GameResult | null;
  difficulty: Difficulty;
  playerColor: PieceColor;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  selectSquare: (square: Square) => void;
  newGame: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
  undoMove: () => void;
  declareResult: (result: GameResult) => void;
  isComputerThinking: boolean;
}

const PLAYER_COLOR: PieceColor = 'w';
const AI_COLOR: PieceColor = 'b';

// Determine whether the position on the board ends the game, and how
export const getGameResult = (chess: Chess): GameResult | null => {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'threefold' };
  if (chess.isDraw()) return { winner: null, reason: 'fifty-moves' };
  return null;
};

const getStatus = (chess: Chess): GameStatus => {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  if (chess.isCheck()) return 'check';
  return 'playing';
};

const buildGameState = (chess: Chess): GameState => {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    moves: history.map((move) => ({
      from: move.from,
      to: move.to,
      piece: { type: move.piece, color: move.color },
      captured: move.captured ? { type: move.captured, color: move.color === 'w' ? 'b' : 'w' } : undefined,
      promotion: move.promotion,
      san: move.san,
    })),
    status: getStatus(chess),
    selectedSquare: null,
    possibleMoves: [],
    lastMove: last ? { from: last.from, to: last.to } : null,
  };
};

export const useChessGame = (): UseChessGameHook => {
  const [chess] = useState(() => new Chess());
  const [gameState, setGameState] = useState<GameState>(() => buildGameState(chess));
  const [result, setResult] = useState<GameResult | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const { isReady, isThinking, getBestMove, stop, newGame: resetEngine } = useStockfish();
  const requestedFenRef = useRef<string | null>(null);

  const refresh = useCallback(() => {
    setGameState(buildGameState(chess));
    setResult(getGameResult(chess));
  }, [chess]);

  const makeMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (getGameResult(chess)) return false;
    try {
      const move = chess.move({ from, to, promotion });
      refresh();

      if (chess.isCheckmate()) {
        soundEffects.playGameOver(move.color === PLAYER_COLOR);
      } else if (chess.isDraw()) {
        soundEffects.playGameOver(false);
      } else if (chess.isCheck()) {
        soundEffects.playCheck();
      } else if (move.captured) {
        soundEffects.playCapture();
      } else {
        soundEffects.playMove();
      }
      return true;
    } catch {
      return false;
    }
  }, [chess, refresh]);

  const selectSquare = useCallback((square: Square) => {
    // The player can only act on their own turn, while the game is running
    if (result || chess.turn() !== PLAYER_COLOR || isThinking) return;

    if (gameState.selectedSquare && gameState.possibleMoves.includes(square)) {
      const piece = chess.get(gameState.selectedSquare as any);
      const isPawnPromotion = piece?.type === 'p' && (square[1] === '8' || square[1] === '1');
      makeMove(gameState.selectedSquare, square, isPawnPromotion ? 'q' : undefined);
      return;
    }

    const piece = chess.get(square as any);
    if (piece && piece.color === PLAYER_COLOR && square !== gameState.selectedSquare) {
      const moves = chess.moves({ square: square as any, verbose: true });
      setGameState((prev) => ({ ...prev, selectedSquare: square, possibleMoves: moves.map((m) => m.to) }));
    } else {
      setGameState((prev) => ({ ...prev, selectedSquare: null, possibleMoves: [] }));
    }
  }, [gameState.selectedSquare, gameState.possibleMoves, chess, makeMove, result, isThinking]);

  const newGame = useCallback(() => {
    resetEngine();
    requestedFenRef.current = null;
    chess.reset();
    refresh();
  }, [chess, refresh, resetEngine]);

  const undoMove = useCallback(() => {
    stop();
    requestedFenRef.current = null;
    // Undo back to the last position where it was the player's turn
    if (chess.history().length === 0) return;
    chess.undo();
    if (chess.turn() !== PLAYER_COLOR && chess.history().length > 0) chess.undo();
    refresh();
  }, [chess, refresh, stop]);

  const declareResult = useCallback((external: GameResult) => {
    stop();
    setResult(external);
  }, [stop]);

  // Computer move logic: plays whenever it is the AI's turn, including when in check
  useEffect(() => {
    if (!isReady || result || gameState.turn !== AI_COLOR) return;
    const fen = gameState.fen;
    if (requestedFenRef.current === fen) return;
    requestedFenRef.current = fen;

    const settings = LEVEL_SETTINGS[difficulty];
    const playRandom = Math.random() < settings.randomMoveChance;

    (async () => {
      let uci: string | null = null;
      if (playRandom) {
        const legal = chess.moves({ verbose: true });
        const pick = legal[Math.floor(Math.random() * legal.length)];
        await new Promise((r) => setTimeout(r, 400));
        uci = pick ? pick.from + pick.to + (pick.promotion ?? '') : null;
      } else {
        uci = await getBestMove(fen, difficulty);
      }
      // Ignore answers for a position that is no longer on the board (undo / new game)
      if (!uci || chess.fen() !== fen) return;
      makeMove(uci.substring(0, 2), uci.substring(2, 4), uci.length > 4 ? uci[4] : undefined);
    })();
  }, [gameState.turn, gameState.fen, result, isReady, difficulty, chess, getBestMove, makeMove]);

  return {
    gameState,
    result,
    difficulty,
    playerColor: PLAYER_COLOR,
    makeMove,
    selectSquare,
    newGame,
    setDifficulty,
    undoMove,
    declareResult,
    isComputerThinking: isThinking,
  };
};
