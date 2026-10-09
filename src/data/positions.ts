// Position trainer: find the best move in typical opening positions.
// `accepted` lists moves that Stockfish rates as (nearly) equal to the best one.
import type { Bilingual } from '../i18n/I18nProvider';

export interface TrainingPosition {
  id: number;
  theme: Bilingual;
  fen: string;
  bestMove: string;
  accepted: string[];
  explanation: Bilingual;
}

const OPENING = { fr: 'Ouverture', en: 'Opening' };
const DEVELOPMENT = { fr: 'Développement', en: 'Development' };
const KING_SAFETY = { fr: 'Sécurité du roi', en: 'King safety' };

export const POSITIONS: TrainingPosition[] = [
  { id: 1, theme: OPENING, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', bestMove: 'e5', accepted: ['c5', 'e6', 'c6'],
    explanation: { fr: '1…e5 est la réponse la plus directe : elle prend sa part du centre et libère le fou et la dame.', en: '1…e5 is the most principled reply: it fights for the centre and frees the bishop and queen.' } },
  { id: 2, theme: DEVELOPMENT, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', bestMove: 'Nf3', accepted: ['Nc3'],
    explanation: { fr: 'Cf3 développe une pièce en attaquant e5, et prépare le roque.', en: 'Nf3 develops with tempo by attacking e5 and prepares castling.' } },
  { id: 3, theme: DEVELOPMENT, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', bestMove: 'Bb5', accepted: ['Bc4', 'd4'],
    explanation: { fr: 'Fb5 (partie espagnole) met la pression sur le cavalier qui défend e5 ; Fc4 (partie italienne), qui vise f7, est tout aussi bon.', en: 'Bb5 (Ruy Lopez) pressures the knight that defends e5; Bc4 (Italian) aiming at f7 is just as good.' } },
  { id: 4, theme: DEVELOPMENT, fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', bestMove: 'a6', accepted: ['Nf6'],
    explanation: { fr: '3…a6 demande au fou de se décider ; 3…Cf6 (défense berlinoise) contre-attaque e4. Ce sont les deux grandes lignes.', en: '3…a6 asks the bishop to decide; 3…Nf6 (Berlin) counter-attacks e4. Both are main lines.' } },
  { id: 5, theme: KING_SAFETY, fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5', bestMove: 'O-O', accepted: ['c3', 'Nc3'],
    explanation: { fr: 'Le roque met le roi à l’abri et relie les tours avant que le centre ne s’ouvre.', en: 'Castling brings the king to safety and connects the rooks before the centre opens.' } },
  { id: 6, theme: KING_SAFETY, fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 2 5', bestMove: 'O-O', accepted: ['d6'],
    explanation: { fr: 'Les Noirs font comme les Blancs : le roque abrite le roi et active la tour.', en: 'Black mirrors White: castling puts the king on a safe square and activates the rook.' } },
];
