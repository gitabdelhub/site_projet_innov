// Tactical puzzles. The side to move after the setup is the player.
// `solution` alternates player moves and scripted opponent replies (SAN).
// Hand-made puzzles are verified against Stockfish: run `npm run verify:puzzles` after editing.
// The rated ones come from the Lichess puzzle database (CC0): scripts/import-lichess-puzzles.mjs
import lichessPuzzles from './lichessPuzzles.json';
import type { Bilingual } from '../i18n/I18nProvider';
import type { IconName } from '../components/Icon';

export type ThemeId = 'mating-nets' | 'queen-sacrifice' | 'opening-traps' | 'pawn-promotion' | 'back-rank' | 'forks' | 'pins-skewers';

export interface Puzzle {
  id: string;
  theme: ThemeId;
  title: Bilingual;
  fen?: string;
  moves?: string; // alternative to fen: moves played from the initial position
  setup?: string; // opponent move played from `fen` just before the puzzle starts
  solution: string[];
  rating?: number; // Lichess puzzle rating (difficulty)
  source?: 'lichess';
  hint: Bilingual;
  explanation: Bilingual;
}

export type LevelId = 'beginner' | 'intermediate' | 'advanced';

export interface Theme {
  id: ThemeId;
  name: Bilingual;
  icon: IconName;
  difficulty: LevelId;
  description: Bilingual;
  hint: Bilingual; // generic hint for the rated puzzles of this theme
}

export const THEMES: Theme[] = [
  { id: 'back-rank', icon: 'shield', difficulty: 'beginner',
    name: { fr: 'Faiblesse de la dernière rangée', en: 'Back rank weakness' },
    description: { fr: 'Un roi enfermé derrière ses propres pions peut être maté sur sa dernière rangée. Apprends à le voir, et à l’éviter.', en: 'A king trapped behind its own pawns can be mated on the back rank. Learn to spot it, and to avoid it.' },
    hint: { fr: 'Regarde la dernière rangée : le roi est-il bloqué par ses propres pions ?', en: 'Look at the back rank: is the king boxed in by its own pawns?' } },
  { id: 'opening-traps', icon: 'flag', difficulty: 'beginner',
    name: { fr: 'Pièges d’ouverture', en: 'Opening traps' },
    description: { fr: 'Les pièges classiques des premiers coups : coup du berger, mat du lion, mat de Légal, piège de Blackburne.', en: 'Classic traps from the first moves: Scholar’s mate, Fool’s mate, Légal’s mate and the Blackburne Shilling.' },
    hint: { fr: 'En début de partie, cherche une pièce mal protégée ou une case faible près du roi.', en: 'Early in the game, look for a loose piece or a weak square near the king.' } },
  { id: 'forks', icon: 'swords', difficulty: 'beginner',
    name: { fr: 'Fourchettes et attaques doubles', en: 'Forks and double attacks' },
    description: { fr: 'Une pièce qui attaque deux cibles à la fois. Cavaliers, pions et dames sont les rois de la fourchette.', en: 'One piece attacking two targets at once. Knights, pawns and queens are the kings of forks.' },
    hint: { fr: 'Trouve un coup qui attaque deux cibles en même temps.', en: 'Find a move that attacks two targets at once.' } },
  { id: 'pins-skewers', icon: 'link', difficulty: 'intermediate',
    name: { fr: 'Clouages et enfilades', en: 'Pins and skewers' },
    description: { fr: 'Attaquer sur une ligne pour que la pièce de devant ne puisse plus bouger, ou doive bouger et découvrir celle de derrière.', en: 'Attack along a line so the piece in front cannot move, or must move and expose what is behind it.' },
    hint: { fr: 'Aligne ta pièce avec le roi ou la dame adverse placés derrière.', en: 'Line up a piece with the king or queen behind it.' } },
  { id: 'mating-nets', icon: 'target', difficulty: 'intermediate',
    name: { fr: 'Filets de mat', en: 'Mating nets' },
    description: { fr: 'Mat à l’étouffée, mat arabe, mat de l’escalier : reconnais les motifs qui piègent le roi adverse.', en: 'Smothered mate, Arabian mate, the rook ladder: recognise the patterns that trap the enemy king.' },
    hint: { fr: 'Le roi n’a presque plus de cases : trouve le coup qui lui retire les dernières.', en: 'The king has very few squares: find the move that takes the last ones away.' } },
  { id: 'queen-sacrifice', icon: 'flame', difficulty: 'advanced',
    name: { fr: 'Sacrifices de dame', en: 'Queen sacrifices' },
    description: { fr: 'Donner sa pièce la plus forte pour forcer le mat. Les combinaisons les plus spectaculaires des échecs.', en: 'Give up your strongest piece to force checkmate. The most spectacular combinations in chess.' },
    hint: { fr: 'Ta dame vaut peut-être d’être sacrifiée si elle force le mat.', en: 'Your queen may be worth giving up if it forces mate.' } },
  { id: 'pawn-promotion', icon: 'crown', difficulty: 'intermediate',
    name: { fr: 'Percées de pions', en: 'Pawn breakthroughs' },
    description: { fr: 'Créer un pion passé et le pousser jusqu’à la promotion, même face à plus de pions.', en: 'Create passed pawns and push them to promotion, even against more pawns.' },
    hint: { fr: 'Un pion proche de la promotion peut valoir plus qu’une pièce.', en: 'A pawn close to promotion can be stronger than a piece.' } },
];

const HANDMADE: Puzzle[] = [
  // Back rank
  { id: 'br1', theme: 'back-rank', fen: '6k1/5ppp/8/8/8/8/r4PPP/4R1K1 w - - 0 1', solution: ['Re8#'],
    title: { fr: 'La colonne e ouverte', en: 'The open e-file' },
    hint: { fr: 'Le roi noir n’a aucune case de fuite.', en: 'The black king has no escape squares.' },
    explanation: { fr: 'Te8# : les pions f7, g7 et h7 emprisonnent leur propre roi.', en: 'Re8#: the pawns on f7, g7 and h7 imprison their own king.' } },
  { id: 'br2', theme: 'back-rank', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', solution: ['Qd8#'],
    title: { fr: 'La dame en huitième', en: 'Queen to the eighth' },
    hint: { fr: 'Quelle rangée le roi ne peut-il pas quitter ?', en: 'Which rank can the king not leave?' },
    explanation: { fr: 'Dd8# : un mat du couloir classique avec la dame.', en: 'Qd8#: a classic back-rank mate with the queen.' } },
  { id: 'br3', theme: 'back-rank', fen: '2r3k1/5ppp/8/8/8/8/5PPP/2R1R1K1 w - - 0 1', solution: ['Rxc8#'],
    title: { fr: 'Prendre en matant', en: 'Capture with mate' },
    hint: { fr: 'Prends le seul défenseur de la dernière rangée.', en: 'Take the only defender of the back rank.' },
    explanation: { fr: 'Txc8# : sans sa tour, le roi n’a plus de défense sur la huitième rangée.', en: 'Rxc8#: once the rook is gone, the king is defenceless on the eighth rank.' } },

  // Opening traps
  { id: 'ot1', theme: 'opening-traps', moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6', solution: ['Qxf7#'],
    title: { fr: 'Le coup du berger', en: 'Scholar’s mate' },
    hint: { fr: 'f7 n’est défendu que par le roi.', en: 'f7 is only defended by the king.' },
    explanation: { fr: 'Dxf7# : la dame et le fou s’unissent sur la case faible f7.', en: 'Qxf7#: queen and bishop combine on the weak f7 square.' } },
  { id: 'ot2', theme: 'opening-traps', moves: 'f3 e5 g4', solution: ['Qh4#'],
    title: { fr: 'Le mat du lion', en: 'Fool’s mate' },
    hint: { fr: 'Les Blancs ont affaibli la diagonale e1–h4.', en: 'White has weakened the e1–h4 diagonal.' },
    explanation: { fr: 'Dh4# : le mat le plus rapide possible, après seulement deux coups blancs.', en: 'Qh4#: the fastest checkmate possible, after only two White moves.' } },
  { id: 'ot3', theme: 'opening-traps', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5', solution: ['Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'],
    title: { fr: 'Le piège de Blackburne', en: 'Blackburne Shilling trap' },
    hint: { fr: 'Contre-attaque g2 au lieu de défendre e5.', en: 'Counter-attack g2 instead of defending e5.' },
    explanation: { fr: 'Dg5 ! attaque g2 et e5. Après Cxf7 Dxg2 Tf1 Dxe4+ Fe2 Cf3#, le cavalier fait un mat à l’étouffée.', en: 'Qg5! hits g2 and e5. After Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3# the knight delivers a smothered mate.' } },

  // Forks
  { id: 'fk1', theme: 'forks', fen: 'r3k3/pp6/8/1N6/8/8/PP6/4K3 w - - 0 1', solution: ['Nc7+', 'Kd7', 'Nxa8'],
    title: { fr: 'Fourchette royale', en: 'Royal fork' },
    hint: { fr: 'Le cavalier attaque des cases des deux couleurs… mais se pose sur une seule.', en: 'Knights attack squares of both colours… but land on one.' },
    explanation: { fr: 'Cc7+ attaque le roi et la tour : après le coup du roi, Cxa8 gagne la qualité.', en: 'Nc7+ forks the king and the rook: after the king moves, Nxa8 wins the exchange.' } },
  { id: 'fk2', theme: 'forks', fen: '4k3/8/2n1n3/8/3P4/8/8/4K3 w - - 0 1', solution: ['d5'],
    title: { fr: 'Fourchette de pion', en: 'Pawn fork' },
    hint: { fr: 'La plus humble des pièces peut en attaquer deux.', en: 'The humblest piece can attack two at once.' },
    explanation: { fr: 'd5 attaque les deux cavaliers : l’un des deux sera perdu.', en: 'd5 attacks both knights: one of them will be lost.' } },
  { id: 'fk3', theme: 'forks', fen: '4k3/8/8/8/7b/8/8/1K1Q4 w - - 0 1', solution: ['Qa4+'],
    title: { fr: 'Échec et prise', en: 'Queen check and capture' },
    hint: { fr: 'Cherche un échec qui attaque aussi le fou mal protégé.', en: 'Look for a check that also attacks the loose bishop.' },
    explanation: { fr: 'Da4+ fait échec en diagonale et attaque le fou h4 sur la rangée.', en: 'Qa4+ checks the king along the diagonal and attacks the bishop on h4 along the rank.' } },

  // Pins & skewers
  { id: 'ps1', theme: 'pins-skewers', fen: '8/8/8/8/2k3q1/8/8/R3K3 w - - 0 1', solution: ['Ra4+'],
    title: { fr: 'Enfilade à la tour', en: 'Rook skewer' },
    hint: { fr: 'Le roi et la dame sont sur la même rangée.', en: 'King and queen are on the same rank.' },
    explanation: { fr: 'Ta4+ : le roi doit s’écarter et la dame g4 tombe.', en: 'Ra4+ skewers the king: it must step aside and the queen on g4 falls.' } },
  { id: 'ps2', theme: 'pins-skewers', fen: '4k3/4q3/8/8/8/8/5K2/R7 w - - 0 1', solution: ['Re1'],
    title: { fr: 'Clouer la dame', en: 'Pinning the queen' },
    hint: { fr: 'La dame se tient devant son roi.', en: 'The queen stands in front of her king.' },
    explanation: { fr: 'Te1 cloue la dame sur son roi : le mieux pour les Noirs est de la donner contre la tour.', en: 'Re1 pins the queen to the king: the best Black can do is give the queen for the rook.' } },
  { id: 'ps3', theme: 'pins-skewers', fen: '6q1/8/8/3k4/8/8/8/3BK3 w - - 0 1', solution: ['Bb3+'],
    title: { fr: 'Enfilade au fou', en: 'Bishop skewer' },
    hint: { fr: 'Le roi et la dame partagent une diagonale.', en: 'King and queen share a diagonal.' },
    explanation: { fr: 'Fb3+ : le roi s’écarte et la dame g8 tombe.', en: 'Bb3+ skewers the king to the queen on g8.' } },

  // Mating nets
  { id: 'mn1', theme: 'mating-nets', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['Nf7#'],
    title: { fr: 'Mat à l’étouffée', en: 'Smothered mate' },
    hint: { fr: 'Le roi est entouré par ses propres pièces.', en: 'The king is surrounded by its own pieces.' },
    explanation: { fr: 'Cf7# : la tour et les pions noirs bloquent toutes les cases du roi.', en: 'Nf7#: the king cannot move because its own rook and pawns block every square.' } },
  { id: 'mn2', theme: 'mating-nets', fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', solution: ['Rh7#'],
    title: { fr: 'Mat arabe', en: 'Arabian mate' },
    hint: { fr: 'Le cavalier protège la tour et contrôle g8.', en: 'The knight protects the rook and covers g8.' },
    explanation: { fr: 'Th7# : la tour et le cavalier forment l’un des plus vieux motifs de mat connus.', en: 'Rh7#: rook and knight team up in one of the oldest known mating patterns.' } },
  { id: 'mn3', theme: 'mating-nets', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', solution: ['Ra7', 'Kf8', 'Rb8#'],
    title: { fr: 'Le mat de l’escalier', en: 'Rook ladder' },
    hint: { fr: 'Coupe le roi rangée par rangée.', en: 'Cut the king off rank by rank.' },
    explanation: { fr: 'Ta7 retire la septième rangée au roi, puis Tb8# mate sur la huitième.', en: 'Ra7 takes away the seventh rank, then Rb8# mates on the eighth.' } },

  // Queen sacrifices
  { id: 'qs1', theme: 'queen-sacrifice', fen: '5r1k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1', solution: ['Qg8+', 'Rxg8', 'Nf7#'],
    title: { fr: 'Le legs de Philidor', en: 'Philidor’s legacy' },
    hint: { fr: 'Force la tour à venir en g8 pour enfermer le roi.', en: 'Force the rook onto g8 to block the king.' },
    explanation: { fr: 'Dg8+ !! Txg8 Cf7# : le sacrifice de dame crée un mat à l’étouffée.', en: 'Qg8+!! Rxg8 Nf7#: the queen sacrifice creates a smothered mate.' } },
  { id: 'qs2', theme: 'queen-sacrifice', fen: '3r2k1/2q2ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1', solution: ['Qxd8+', 'Qxd8', 'Rxd8#'],
    title: { fr: 'Échanger pour mater', en: 'Trade into mate' },
    hint: { fr: 'La tour d8 est le seul gardien de la dernière rangée.', en: 'The d8-rook is the only guard of the back rank.' },
    explanation: { fr: 'Dxd8+ Dxd8 Txd8# : la dame dévie le défenseur et la tour mate.', en: 'Qxd8+ Qxd8 Rxd8#: the queen deflects the defender and the rook mates.' } },
  { id: 'qs3', theme: 'queen-sacrifice', moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6', solution: ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
    title: { fr: 'Le mat de Légal', en: 'Légal’s mate' },
    hint: { fr: 'Ignore le clouage de ton cavalier !', en: 'Ignore the pin on your knight!' },
    explanation: { fr: 'Cxe5 ! Si les Noirs prennent la dame par Fxd1, Fxf7+ Re7 Cd5# : mat avec trois pièces mineures.', en: 'Nxe5! If Black grabs the queen with Bxd1, Bxf7+ Ke7 Nd5# is mate by three minor pieces.' } },

  // Pawn breakthroughs
  { id: 'pp1', theme: 'pawn-promotion', fen: '7k/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1', solution: ['b6'],
    title: { fr: 'Trois contre trois', en: 'Three against three' },
    hint: { fr: 'Sacrifie des pions pour en créer un imparable.', en: 'Sacrifice pawns to create one unstoppable pawn.' },
    explanation: { fr: 'b6 ! Après axb6 c6 ! ou cxb6 a6 !, un pion blanc passe et va à dame.', en: 'b6! After axb6 c6! or cxb6 a6!, one white pawn breaks through and promotes.' } },
  { id: 'pp2', theme: 'pawn-promotion', fen: '1r5k/P7/8/8/8/8/8/K7 w - - 0 1', solution: ['axb8=Q+'],
    title: { fr: 'Promotion avec échec', en: 'Promote with check' },
    hint: { fr: 'Prends et promeus en même temps.', en: 'Capture and promote at the same time.' },
    explanation: { fr: 'axb8=D+ gagne la tour et donne une nouvelle dame avec échec.', en: 'axb8=Q+ wins the rook and gets a new queen with check.' } },
];

const themeOf = (id: ThemeId) => THEMES.find((t) => t.id === id)!;

const RATED: Puzzle[] = (lichessPuzzles as { id: string; theme: ThemeId; rating: number; fen: string; setup: string; solution: string[] }[]).map((p) => ({
  ...p,
  source: 'lichess',
  title: { fr: `${themeOf(p.theme).name.fr} · ${p.rating}`, en: `${themeOf(p.theme).name.en} · ${p.rating}` },
  hint: themeOf(p.theme).hint,
  explanation: { fr: `Puzzle Lichess ${p.id.slice(3)}, classé ${p.rating}.`, en: `Lichess puzzle ${p.id.slice(3)}, rated ${p.rating}.` },
}));

// Hand-made classics first, then the rated puzzles from easiest to hardest
export const PUZZLES: Puzzle[] = [...HANDMADE, ...[...RATED].sort((a, b) => a.rating! - b.rating!)];

export const LEVELS: { id: LevelId; label: Bilingual; range: string; min: number; max: number }[] = [
  { id: 'beginner', label: { fr: 'Débutant', en: 'Beginner' }, range: '<1200', min: 0, max: 1200 },
  { id: 'intermediate', label: { fr: 'Intermédiaire', en: 'Intermediate' }, range: '1200–1800', min: 1200, max: 1800 },
  { id: 'advanced', label: { fr: 'Avancé', en: 'Advanced' }, range: '1800+', min: 1800, max: 9999 },
];

export const getPuzzlesByTheme = (theme: ThemeId) => PUZZLES.filter((p) => p.theme === theme);
