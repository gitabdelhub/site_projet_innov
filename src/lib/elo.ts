/**
 * Calculate new Elo ratings after a game
 * Based on the standard Elo rating formula
 */
export interface EloResult {
  winner: 'white' | 'black' | 'draw';
  whiteRating: number;
  blackRating: number;
  newWhiteRating: number;
  newBlackRating: number;
}

export const calculateEloChange = (
  whiteRating: number,
  blackRating: number,
  result: 'white' | 'black' | 'draw'
): EloResult => {
  const K = 32; // K-factor for rating changes

  // Calculate expected scores
  const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
  const expectedBlack = 1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));

  // Determine actual scores
  let actualWhite: number;
  let actualBlack: number;

  if (result === 'white') {
    actualWhite = 1;
    actualBlack = 0;
  } else if (result === 'black') {
    actualWhite = 0;
    actualBlack = 1;
  } else {
    actualWhite = 0.5;
    actualBlack = 0.5;
  }

  // Calculate new ratings
  const newWhiteRating = Math.round(whiteRating + K * (actualWhite - expectedWhite));
  const newBlackRating = Math.round(blackRating + K * (actualBlack - expectedBlack));

  return {
    winner: result,
    whiteRating,
    blackRating,
    newWhiteRating,
    newBlackRating,
  };
};

export const getInitialEloRating = (): number => {
  return 1200; // Standard starting Elo rating
};
