export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';
export type Square = string;

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  san: string;
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface GameState {
  fen: string;
  turn: PieceColor;
  moves: Move[];
  status: GameStatus;
  selectedSquare: Square | null;
  possibleMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
}
