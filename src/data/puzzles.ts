// Tactical puzzles. The side to move after the setup is the player.
// `solution` alternates player moves and scripted opponent replies (SAN).
// Hand-made puzzles are verified against Stockfish: run `npm run verify:puzzles` after editing.
// The rated ones come from the Lichess puzzle database (CC0): scripts/import-lichess-puzzles.mjs
import lichessPuzzles from './lichessPuzzles.json';

export type ThemeId = 'mating-nets' | 'queen-sacrifice' | 'opening-traps' | 'pawn-promotion' | 'back-rank' | 'forks' | 'pins-skewers';

export interface Puzzle {
  id: string;
  theme: ThemeId;
  title: string;
  fen?: string;
  moves?: string; // alternative to fen: moves played from the initial position
  setup?: string; // opponent move played from `fen` just before the puzzle starts
  solution: string[];
  rating?: number; // Lichess puzzle rating (difficulty)
  source?: 'lichess';
  hint: string;
  explanation: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  icon: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  hint: string; // generic hint for the rated puzzles of this theme
}

export const THEMES: Theme[] = [
  { id: 'back-rank', name: 'Back Rank Weakness', icon: '🏰', difficulty: 'Beginner', description: 'A king trapped behind its own pawns can be mated on the back rank. Learn to spot it — and to avoid it.', hint: 'Look at the back rank: is the king boxed in by its own pawns?' },
  { id: 'opening-traps', name: 'Opening Traps', icon: '🛡️', difficulty: 'Beginner', description: 'Classic traps from the first moves: Scholar\'s mate, Fool\'s mate, Légal and the Blackburne Shilling.', hint: 'Early in the game, look for a loose piece or a weak square near the king.' },
  { id: 'forks', name: 'Forks & Double Attacks', icon: '🍴', difficulty: 'Beginner', description: 'One piece attacking two targets at once. Knights, pawns and queens are the kings of forks.', hint: 'Find a move that attacks two targets at once.' },
  { id: 'pins-skewers', name: 'Pins & Skewers', icon: '📌', difficulty: 'Intermediate', description: 'Attack along a line so the piece in front cannot move — or must move and expose what is behind it.', hint: 'Line up a piece with the king or queen behind it.' },
  { id: 'mating-nets', name: 'Mating Nets', icon: '👑', difficulty: 'Intermediate', description: 'Smothered mate, Arabian mate, the rook ladder: recognise the patterns that trap the enemy king.', hint: 'The king has very few squares: find the move that takes the last ones away.' },
  { id: 'queen-sacrifice', name: 'Queen Sacrifices', icon: '⚔️', difficulty: 'Advanced', description: 'Give up your strongest piece to force checkmate. The most spectacular combinations in chess.', hint: 'Your queen may be worth giving up if it forces mate.' },
  { id: 'pawn-promotion', name: 'Pawn Breakthroughs', icon: '♟️', difficulty: 'Intermediate', description: 'Create and push passed pawns to promotion, even against more pawns.', hint: 'A pawn close to promotion can be stronger than a piece.' },
];

const HANDMADE: Puzzle[] = [
  // Back rank
  { id: 'br1', theme: 'back-rank', title: 'The open e-file', fen: '6k1/5ppp/8/8/8/8/r4PPP/4R1K1 w - - 0 1', solution: ['Re8#'], hint: 'The black king has no escape squares.', explanation: 'Re8# — the pawns on f7, g7 and h7 imprison their own king.' },
  { id: 'br2', theme: 'back-rank', title: 'Queen to the eighth', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', solution: ['Qd8#'], hint: 'Which rank can the king not leave?', explanation: 'Qd8# — a classic back-rank mate with the queen.' },
  { id: 'br3', theme: 'back-rank', title: 'Capture with mate', fen: '2r3k1/5ppp/8/8/8/8/5PPP/2R1R1K1 w - - 0 1', solution: ['Rxc8#'], hint: 'Take the only defender of the back rank.', explanation: 'Rxc8# — removing the rook leaves the king defenceless on the eighth rank.' },

  // Opening traps
  { id: 'ot1', theme: 'opening-traps', title: "Scholar's mate", moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6', solution: ['Qxf7#'], hint: 'f7 is only defended by the king.', explanation: 'Qxf7# — queen and bishop combine on the weak f7 square.' },
  { id: 'ot2', theme: 'opening-traps', title: "Fool's mate", moves: 'f3 e5 g4', solution: ['Qh4#'], hint: 'White has weakened the e1–h4 diagonal.', explanation: 'Qh4# — the fastest checkmate possible, after only two White moves.' },
  { id: 'ot3', theme: 'opening-traps', title: 'Blackburne Shilling trap', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5', solution: ['Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'], hint: 'Counter-attack g2 instead of defending e5.', explanation: 'Qg5! hits g2 and e5. After Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3# the knight delivers a smothered mate.' },

  // Forks
  { id: 'fk1', theme: 'forks', title: 'Royal fork', fen: 'r3k3/pp6/8/1N6/8/8/PP6/4K3 w - - 0 1', solution: ['Nc7+', 'Kd7', 'Nxa8'], hint: 'Knights attack squares of both colours… but land on one.', explanation: 'Nc7+ forks the king and the rook: after the king moves, Nxa8 wins the exchange.' },
  { id: 'fk2', theme: 'forks', title: 'Pawn fork', fen: '4k3/8/2n1n3/8/3P4/8/8/4K3 w - - 0 1', solution: ['d5'], hint: 'The humblest piece can attack two at once.', explanation: 'd5 attacks both knights: one of them will be lost.' },
  { id: 'fk3', theme: 'forks', title: 'Queen check and capture', fen: '4k3/8/8/8/7b/8/8/1K1Q4 w - - 0 1', solution: ['Qa4+'], hint: 'Look for a check that also attacks the loose bishop.', explanation: 'Qa4+ checks the king along the diagonal and attacks the bishop on h4 along the rank.' },

  // Pins & skewers
  { id: 'ps1', theme: 'pins-skewers', title: 'Rook skewer', fen: '8/8/8/8/2k3q1/8/8/R3K3 w - - 0 1', solution: ['Ra4+'], hint: 'King and queen are on the same rank.', explanation: 'Ra4+ skewers the king: it must step aside and the queen on g4 falls.' },
  { id: 'ps2', theme: 'pins-skewers', title: 'Pinning the queen', fen: '4k3/4q3/8/8/8/8/5K2/R7 w - - 0 1', solution: ['Re1'], hint: 'The queen stands in front of her king.', explanation: 'Re1 pins the queen to the king: the best Black can do is give the queen for the rook.' },
  { id: 'ps3', theme: 'pins-skewers', title: 'Bishop skewer', fen: '6q1/8/8/3k4/8/8/8/3BK3 w - - 0 1', solution: ['Bb3+'], hint: 'King and queen share a diagonal.', explanation: 'Bb3+ skewers the king to the queen on g8.' },

  // Mating nets
  { id: 'mn1', theme: 'mating-nets', title: 'Smothered mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['Nf7#'], hint: 'The king is surrounded by its own pieces.', explanation: 'Nf7# — the king cannot move because its own rook and pawns block every square.' },
  { id: 'mn2', theme: 'mating-nets', title: 'Arabian mate', fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', solution: ['Rh7#'], hint: 'The knight protects the rook and covers g8.', explanation: 'Rh7# — rook and knight team up in one of the oldest known mating patterns.' },
  { id: 'mn3', theme: 'mating-nets', title: 'Rook ladder', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', solution: ['Ra7', 'Kf8', 'Rb8#'], hint: 'Cut the king off rank by rank.', explanation: 'Ra7 takes away the seventh rank, then Rb8# mates on the eighth.' },

  // Queen sacrifices
  { id: 'qs1', theme: 'queen-sacrifice', title: "Philidor's legacy", fen: '5r1k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1', solution: ['Qg8+', 'Rxg8', 'Nf7#'], hint: 'Force the rook onto g8 to block the king.', explanation: 'Qg8+!! Rxg8 Nf7# — the queen sacrifice creates a smothered mate.' },
  { id: 'qs2', theme: 'queen-sacrifice', title: 'Trade into mate', fen: '3r2k1/2q2ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1', solution: ['Qxd8+', 'Qxd8', 'Rxd8#'], hint: 'The d8-rook is the only guard of the back rank.', explanation: 'Qxd8+ Qxd8 Rxd8# — the queen deflects the defender and the rook mates.' },
  { id: 'qs3', theme: 'queen-sacrifice', title: "Légal's mate", moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6', solution: ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'], hint: 'Ignore the pin on your knight!', explanation: 'Nxe5! If Black grabs the queen with Bxd1, Bxf7+ Ke7 Nd5# is mate by three minor pieces.' },

  // Pawn breakthroughs
  { id: 'pp1', theme: 'pawn-promotion', title: 'Three against three', fen: '7k/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1', solution: ['b6'], hint: 'Sacrifice pawns to create one unstoppable pawn.', explanation: 'b6! After axb6 c6! or cxb6 a6!, one white pawn breaks through and promotes.' },
  { id: 'pp2', theme: 'pawn-promotion', title: 'Promote with check', fen: '1r5k/P7/8/8/8/8/8/K7 w - - 0 1', solution: ['axb8=Q+'], hint: 'Capture and promote at the same time.', explanation: 'axb8=Q+ wins the rook and gets a new queen with check.' },
];

const themeName = (id: ThemeId) => THEMES.find((t) => t.id === id)!.name;

const RATED: Puzzle[] = (lichessPuzzles as { id: string; theme: ThemeId; rating: number; fen: string; setup: string; solution: string[] }[]).map((p) => ({
  ...p,
  source: 'lichess',
  title: `${themeName(p.theme)} · ${p.rating}`,
  hint: THEMES.find((t) => t.id === p.theme)!.hint,
  explanation: `Lichess puzzle ${p.id.slice(3)}, rated ${p.rating}.`,
}));

// Hand-made classics first, then the rated puzzles from easiest to hardest
export const PUZZLES: Puzzle[] = [...HANDMADE, ...[...RATED].sort((a, b) => a.rating! - b.rating!)];

export const LEVELS = [
  { id: 'beginner', label: 'Beginner', range: '<1200', min: 0, max: 1200 },
  { id: 'intermediate', label: 'Intermediate', range: '1200–1800', min: 1200, max: 1800 },
  { id: 'advanced', label: 'Advanced', range: '1800+', min: 1800, max: 9999 },
] as const;
export type LevelId = (typeof LEVELS)[number]['id'];

export const getPuzzlesByTheme = (theme: ThemeId) => PUZZLES.filter((p) => p.theme === theme);
