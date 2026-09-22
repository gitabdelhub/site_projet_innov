// Position trainer: find the best move in typical opening positions.
// `accepted` lists moves that Stockfish rates as (nearly) equal to the best one.

export interface TrainingPosition {
  id: number;
  theme: string;
  fen: string;
  bestMove: string;
  accepted: string[];
  explanation: string;
}

export const POSITIONS: TrainingPosition[] = [
  { id: 1, theme: 'Opening', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', bestMove: 'e5', accepted: ['c5', 'e6', 'c6'], explanation: '1...e5 is the most principled reply: it fights for the centre and frees the bishop and queen.' },
  { id: 2, theme: 'Development', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', bestMove: 'Nf3', accepted: ['Nc3'], explanation: 'Nf3 develops with tempo by attacking e5 and prepares castling.' },
  { id: 3, theme: 'Development', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', bestMove: 'Bb5', accepted: ['Bc4', 'd4'], explanation: 'Bb5 (Ruy Lopez) pressures the knight that defends e5; Bc4 (Italian) aiming at f7 is just as good.' },
  { id: 4, theme: 'Development', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', bestMove: 'a6', accepted: ['Nf6'], explanation: '3...a6 asks the bishop to decide; 3...Nf6 (Berlin) counter-attacks e4. Both are main lines.' },
  { id: 5, theme: 'King Safety', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5', bestMove: 'O-O', accepted: ['c3', 'Nc3'], explanation: 'Castling brings the king to safety and connects the rooks before the centre opens.' },
  { id: 6, theme: 'King Safety', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 2 5', bestMove: 'O-O', accepted: ['d6'], explanation: 'Black mirrors White: castling puts the king on a safe square and activates the rook.' },
];
