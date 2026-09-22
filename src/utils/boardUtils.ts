export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const isLightSquare = (square: string): boolean => {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  return (file + rank) % 2 === 0;
};

export const getSquareColor = (square: string): 'light' | 'dark' => {
  return isLightSquare(square) ? 'light' : 'dark';
};
