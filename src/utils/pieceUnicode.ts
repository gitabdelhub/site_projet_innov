export const PIECE_UNICODE: Record<string, string> = {
  'wK': '♔',
  'wQ': '♕',
  'wR': '♖',
  'wB': '♗',
  'wN': '♘',
  'wP': '♙',
  'bK': '♚',
  'bQ': '♛',
  'bR': '♜',
  'bB': '♝',
  'bN': '♞',
  'bP': '♟',
};

export const getPieceUnicode = (color: 'w' | 'b', type: string): string => {
  return PIECE_UNICODE[`${color}${type.toUpperCase()}`] || '';
};
