import type { Bilingual } from '../i18n/I18nProvider';
import type { IconName } from '../components/Icon';

// The beginner path: short interactive lessons, from how the pieces move to the first traps.
// tests/lessons.test.ts checks that every exercise can be solved.

export type Goal = 'mate' | 'check' | 'castle' | 'promote' | 'escape';

export type Exercise =
  // Move the lone piece onto every star (the side to move never changes)
  | { kind: 'stars'; fen: string; targets: string[]; prompt: Bilingual }
  // Any move that reaches the goal is right (any mate, any check…)
  | { kind: 'goal'; fen: string; goal: Goal; prompt: Bilingual; success: Bilingual }
  // One of the listed moves (SAN) is expected
  | { kind: 'move'; fen: string; accept: string[]; prompt: Bilingual; success: Bilingual; wrong?: Bilingual };

export interface Lesson {
  id: string;
  art: { piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k' } | { icon: IconName };
  title: Bilingual;
  intro: Bilingual;
  exercises: Exercise[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS: Lesson[] = [
  {
    id: 'rook',
    art: { piece: 'r' },
    title: { fr: 'La tour', en: 'The rook' },
    intro: {
      fr: 'La tour se déplace en ligne droite, horizontalement ou verticalement, d’autant de cases qu’elle veut. Elle ne saute pas par-dessus les pièces.',
      en: 'The rook moves in straight lines, across or up and down, as many squares as it likes. It cannot jump over pieces.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/R7 w - - 0 1',
        targets: ['a6', 'f6', 'f2'],
        prompt: { fr: 'Clique sur la tour, puis sur une case. Ramasse toutes les étoiles.', en: 'Click the rook, then a square. Collect every star.' },
      },
      {
        kind: 'stars',
        fen: '7R/8/8/8/8/8/8/8 w - - 0 1',
        targets: ['b8', 'b3', 'g3', 'g7'],
        prompt: { fr: 'Encore une fois, en un minimum de coups.', en: 'Once more, in as few moves as you can.' },
      },
    ],
  },
  {
    id: 'bishop',
    art: { piece: 'b' },
    title: { fr: 'Le fou', en: 'The bishop' },
    intro: {
      fr: 'Le fou se déplace en diagonale, aussi loin qu’il veut. Il reste toujours sur des cases de la même couleur.',
      en: 'The bishop moves diagonally, as far as it likes. It always stays on squares of the same colour.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/2B5 w - - 0 1',
        targets: ['e3', 'b6', 'd8'],
        prompt: { fr: 'Ramasse les étoiles en suivant les diagonales.', en: 'Collect the stars along the diagonals.' },
      },
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/5B2 w - - 0 1',
        targets: ['b5', 'e8', 'h5'],
        prompt: { fr: 'Toutes les étoiles sont sur des cases claires, comme ton fou.', en: 'Every star is on a light square, like your bishop.' },
      },
    ],
  },
  {
    id: 'queen',
    art: { piece: 'q' },
    title: { fr: 'La dame', en: 'The queen' },
    intro: {
      fr: 'La dame est la pièce la plus forte : elle se déplace comme une tour et comme un fou à la fois.',
      en: 'The queen is the strongest piece: she moves like a rook and like a bishop at the same time.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1',
        targets: ['d6', 'a3', 'h3', 'e6'],
        prompt: { fr: 'Lignes droites et diagonales : ramasse tout.', en: 'Straight lines and diagonals: collect them all.' },
      },
    ],
  },
  {
    id: 'knight',
    art: { piece: 'n' },
    title: { fr: 'Le cavalier', en: 'The knight' },
    intro: {
      fr: 'Le cavalier saute en forme de L : deux cases dans une direction, puis une sur le côté. C’est la seule pièce qui passe par-dessus les autres.',
      en: 'The knight jumps in an L shape: two squares one way, then one to the side. It is the only piece that jumps over others.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/1N6 w - - 0 1',
        targets: ['c3', 'e4', 'f6', 'h7'],
        prompt: { fr: 'Saute d’étoile en étoile.', en: 'Jump from star to star.' },
      },
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/6N1 w - - 0 1',
        targets: ['f3', 'g5', 'e6', 'd8'],
        prompt: { fr: 'Le cavalier change de couleur de case à chaque saut.', en: 'The knight changes square colour on every jump.' },
      },
    ],
  },
  {
    id: 'king',
    art: { piece: 'k' },
    title: { fr: 'Le roi', en: 'The king' },
    intro: {
      fr: 'Le roi avance d’une seule case, dans n’importe quelle direction. C’est la pièce à protéger : si on l’attrape, la partie est perdue.',
      en: 'The king moves one square in any direction. It is the piece to protect: if it is caught, the game is lost.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/8/4K3 w - - 0 1',
        targets: ['d2', 'd3', 'e4', 'f5'],
        prompt: { fr: 'Une case à la fois : ramasse les étoiles.', en: 'One square at a time: collect the stars.' },
      },
    ],
  },
  {
    id: 'pawn',
    art: { piece: 'p' },
    title: { fr: 'Le pion', en: 'The pawn' },
    intro: {
      fr: 'Le pion avance tout droit d’une case (deux cases à son premier coup), mais il prend en diagonale. Arrivé au bout, il se transforme, en dame le plus souvent.',
      en: 'The pawn moves straight ahead one square (two on its first move), but it captures diagonally. When it reaches the far side, it turns into another piece, usually a queen.',
    },
    exercises: [
      {
        kind: 'stars',
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
        targets: ['e4', 'e5', 'e6'],
        prompt: { fr: 'Fais avancer le pion. Au premier coup, il peut faire deux cases.', en: 'Push the pawn. On its first move it may go two squares.' },
      },
      {
        kind: 'move',
        fen: '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
        accept: ['exd5'],
        prompt: { fr: 'Le pion prend en diagonale. Prends le pion noir.', en: 'The pawn captures diagonally. Take the black pawn.' },
        success: { fr: 'Bien vu : le pion avance tout droit, mais il prend en biais.', en: 'Well spotted: a pawn moves straight but captures on the diagonal.' },
      },
      {
        kind: 'goal',
        fen: '8/4P3/8/8/8/8/k7/7K w - - 0 1',
        goal: 'promote',
        prompt: { fr: 'Amène le pion sur la dernière rangée pour le transformer.', en: 'Bring the pawn to the last rank to promote it.' },
        success: { fr: 'Promotion ! Ton pion est devenu une dame.', en: 'Promotion! Your pawn became a queen.' },
      },
    ],
  },
  {
    id: 'capture',
    art: { icon: 'target' },
    title: { fr: 'Prendre les pièces', en: 'Capturing pieces' },
    intro: {
      fr: 'On prend une pièce en allant sur sa case. Elles n’ont pas toutes la même valeur : pion 1, cavalier et fou 3, tour 5, dame 9.',
      en: 'You capture a piece by moving onto its square. They are not all worth the same: pawn 1, knight and bishop 3, rook 5, queen 9.',
    },
    exercises: [
      {
        kind: 'move',
        fen: '4k3/8/8/n7/8/8/8/R3K3 w - - 0 1',
        accept: ['Rxa5'],
        prompt: { fr: 'Le cavalier noir n’est pas défendu. Prends-le.', en: 'The black knight is not defended. Take it.' },
        success: { fr: 'Une pièce gratuite : tu gagnes 3 points.', en: 'A free piece: you win 3 points.' },
      },
      {
        kind: 'move',
        fen: '4k3/8/2q5/8/3N4/8/4p3/4K3 w - - 0 1',
        accept: ['Nxc6'],
        prompt: { fr: 'Ton cavalier peut prendre deux choses. Choisis la plus précieuse.', en: 'Your knight can take two things. Pick the most valuable.' },
        success: { fr: 'La dame vaut 9 points, le pion seulement 1.', en: 'The queen is worth 9 points, the pawn only 1.' },
        wrong: { fr: 'Le pion ne vaut que 1 point. Regarde ce que ton cavalier attaque d’autre.', en: 'The pawn is only worth 1 point. Look at what else your knight attacks.' },
      },
    ],
  },
  {
    id: 'check',
    art: { icon: 'shield' },
    title: { fr: 'L’échec', en: 'Check' },
    intro: {
      fr: 'Quand une pièce attaque le roi, on dit qu’il est « en échec ». Le joueur doit tout de suite le sauver : bouger le roi, prendre l’attaquant ou se mettre entre les deux.',
      en: 'When a piece attacks the king, the king is "in check". Its player must save it at once: move the king, capture the attacker, or block.',
    },
    exercises: [
      {
        kind: 'goal',
        fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
        goal: 'check',
        prompt: { fr: 'Mets le roi noir en échec avec ta tour.', en: 'Put the black king in check with your rook.' },
        success: { fr: 'Échec ! Le roi noir est attaqué.', en: 'Check! The black king is attacked.' },
      },
      {
        kind: 'goal',
        fen: '4k3/8/8/8/8/8/8/r3K3 w - - 0 1',
        goal: 'escape',
        prompt: { fr: 'Ton roi est en échec. Mets-le à l’abri.', en: 'Your king is in check. Get it to safety.' },
        success: { fr: 'Ton roi est sauvé.', en: 'Your king is safe.' },
      },
      {
        kind: 'move',
        fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1',
        accept: ['Kxd2'],
        prompt: { fr: 'La dame noire te met en échec, mais personne ne la défend. Que fais-tu ?', en: 'The black queen gives check, but nothing defends her. What do you do?' },
        success: { fr: 'Le roi peut prendre lui aussi, tant que la pièce n’est pas défendue.', en: 'The king can capture too, as long as the piece is not defended.' },
        wrong: { fr: 'Tu es sauvé, mais tu pouvais prendre la dame avec ton roi.', en: 'You are safe, but you could have taken the queen with your king.' },
      },
    ],
  },
  {
    id: 'mate',
    art: { icon: 'crown' },
    title: { fr: 'Échec et mat', en: 'Checkmate' },
    intro: {
      fr: 'Échec et mat : le roi est en échec et ne peut plus s’en sortir. La partie est gagnée. C’est le but du jeu.',
      en: 'Checkmate: the king is in check and has no way out. The game is won. That is the goal of chess.',
    },
    exercises: [
      {
        kind: 'goal',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        goal: 'mate',
        prompt: { fr: 'Le roi noir est enfermé derrière ses pions. Fais échec et mat en un coup.', en: 'The black king is stuck behind its pawns. Checkmate in one move.' },
        success: { fr: 'Le « mat du couloir » : les pions empêchent le roi de fuir.', en: 'The "back-rank mate": the pawns keep the king from escaping.' },
      },
      {
        kind: 'goal',
        fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1',
        goal: 'mate',
        prompt: { fr: 'Ta dame et ton roi travaillent ensemble. Mat en un coup.', en: 'Your queen and king work together. Mate in one.' },
        success: { fr: 'Ton roi garde les cases de fuite, ta dame donne le mat.', en: 'Your king guards the escape squares while the queen delivers mate.' },
      },
      {
        kind: 'goal',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        goal: 'mate',
        prompt: { fr: 'La dame et le fou visent la même case. Mat en un coup.', en: 'The queen and bishop aim at the same square. Mate in one.' },
        success: { fr: 'C’est le « coup du berger » : f7 n’était défendu que par le roi.', en: 'That is the "Scholar’s mate": f7 was defended only by the king.' },
      },
    ],
  },
  {
    id: 'castle',
    art: { icon: 'shield' },
    title: { fr: 'Le roque', en: 'Castling' },
    intro: {
      fr: 'Le roque met le roi à l’abri et sort la tour en un seul coup. Le roi glisse de deux cases vers la tour. On ne peut pas roquer si le roi ou la tour ont déjà bougé, ni à travers un échec.',
      en: 'Castling tucks the king away and brings the rook out in one move. The king slides two squares towards the rook. You cannot castle if the king or rook has moved, nor through check.',
    },
    exercises: [
      {
        kind: 'goal',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        goal: 'castle',
        prompt: { fr: 'Roque : clique sur ton roi, puis deux cases à droite ou à gauche.', en: 'Castle: click your king, then two squares left or right.' },
        success: { fr: 'Roi à l’abri, tour en jeu.', en: 'King safe, rook in play.' },
      },
      {
        kind: 'move',
        fen: '4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1',
        accept: ['O-O-O'],
        prompt: { fr: 'La tour noire contrôle f1 : le petit roque est interdit. Roque de l’autre côté.', en: 'The black rook covers f1, so you cannot castle short. Castle on the other side.' },
        success: { fr: 'Le grand roque, du côté de la dame.', en: 'Long castling, on the queen’s side.' },
      },
    ],
  },
  {
    id: 'opening',
    art: { icon: 'compass' },
    title: { fr: 'Bien commencer', en: 'Starting well' },
    intro: {
      fr: 'Trois idées suffisent pour bien débuter : occuper le centre avec un pion, sortir les cavaliers et les fous, puis roquer.',
      en: 'Three ideas are enough to start well: take the centre with a pawn, bring out the knights and bishops, then castle.',
    },
    exercises: [
      {
        kind: 'move',
        fen: START,
        accept: ['e4', 'd4', 'Nf3', 'c4'],
        prompt: { fr: 'Premier coup de la partie : prends de la place au centre.', en: 'First move of the game: claim space in the centre.' },
        success: { fr: 'Les cases centrales sont les plus importantes au début.', en: 'The central squares matter most early on.' },
        wrong: { fr: 'Ce coup ne s’occupe pas du centre. Essaie e4 ou d4.', en: 'That move does not fight for the centre. Try e4 or d4.' },
      },
      {
        kind: 'move',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        accept: ['Nf3', 'Nc3', 'Bc4'],
        prompt: { fr: 'Sors une pièce mineure (un cavalier ou un fou).', en: 'Bring out a minor piece (a knight or a bishop).' },
        success: { fr: 'Ta pièce vise le centre et pourra participer à l’attaque.', en: 'Your piece eyes the centre and can join the attack.' },
        wrong: { fr: 'Sors plutôt un cavalier ou un fou : Cf3 attaque même le pion e5.', en: 'Develop a knight or bishop instead: Nf3 even attacks the e5 pawn.' },
      },
      {
        kind: 'move',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        accept: ['O-O'],
        prompt: { fr: 'Tes pièces sont sorties. Ton roi est encore au centre : mets-le à l’abri.', en: 'Your pieces are out. Your king is still in the centre: tuck it away.' },
        success: { fr: 'Parfait : centre, développement, roque.', en: 'Perfect: centre, development, castling.' },
      },
    ],
  },
  {
    id: 'traps',
    art: { icon: 'flame' },
    title: { fr: 'Les premiers pièges', en: 'First traps' },
    intro: {
      fr: 'Beaucoup de parties de débutants se terminent en quelques coups. Apprends ces pièges pour les tendre… et surtout pour ne pas y tomber.',
      en: 'Many beginner games end in a few moves. Learn these traps to set them… and above all, not to fall for them.',
    },
    exercises: [
      {
        kind: 'goal',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
        goal: 'mate',
        prompt: { fr: 'Tu as les Noirs. Les Blancs ont affaibli leur roi. Mat en un coup !', en: 'You are Black. White has weakened the king. Mate in one!' },
        success: { fr: 'Le « mat du lion », le plus rapide possible : deux coups seulement.', en: 'The "Fool’s mate", the fastest possible: only two moves.' },
      },
      {
        kind: 'move',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        accept: ['g6', 'Qe7', 'Qf6'],
        prompt: { fr: 'Tu as les Noirs. La dame et le fou blancs menacent Dxf7 mat. Défends-toi.', en: 'You are Black. White’s queen and bishop threaten Qxf7 mate. Defend.' },
        success: { fr: 'Le coup du berger est paré. Pense toujours à la case f7 (ou f2 avec les Blancs).', en: 'Scholar’s mate stopped. Always watch the f7 square (f2 as White).' },
        wrong: { fr: 'Après ce coup, Dxf7 est mat. Il faut protéger f7 ou chasser la dame.', en: 'After that, Qxf7 is mate. Protect f7 or chase the queen away.' },
      },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
