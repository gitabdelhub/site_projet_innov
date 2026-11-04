/**
 * Puzzles from the open Lichess database (CC0), embedded in public/puzzles/
 * (one JSON file per 100 point rating band, built by scripts/build_puzzles.py).
 *
 * Lichess format: `fen` is the position BEFORE the opponent's move. The first
 * move of `moves` is played automatically, then the player must find every
 * other move of their side.
 */

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[]; // UCI
  rating: number;
  themes: string[];
}

type RawPuzzle = [string, string, string, number, string];

export const THEME_FILTERS: { id: string; match: string[] }[] = [
  { id: 'all', match: [] },
  { id: 'mate', match: ['mateIn1', 'mateIn2', 'mateIn3', 'mate'] },
  { id: 'fork', match: ['fork'] },
  { id: 'pin', match: ['pin'] },
  { id: 'skewer', match: ['skewer'] },
  { id: 'hangingPiece', match: ['hangingPiece'] },
  { id: 'discoveredAttack', match: ['discoveredAttack'] },
  { id: 'backRankMate', match: ['backRankMate'] },
  { id: 'sacrifice', match: ['sacrifice'] },
  { id: 'endgame', match: ['endgame'] },
  { id: 'promotion', match: ['promotion', 'advancedPawn'] },
];

const MIN_BAND = 400;
const MAX_BAND = 2800;
const bandOf = (rating: number) => Math.max(MIN_BAND, Math.min(MAX_BAND, Math.floor(rating / 100) * 100));

const bandCache = new Map<number, Promise<Puzzle[]>>();

const loadBand = (band: number): Promise<Puzzle[]> => {
  let p = bandCache.get(band);
  if (!p) {
    p = fetch(`/puzzles/${band}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RawPuzzle[]>) : []))
      .then((rows) =>
        rows.map(([id, fen, moves, rating, themes]) => ({
          id,
          fen,
          moves: moves.split(' '),
          rating,
          themes: themes.split(' '),
        })),
      )
      .catch(() => []);
    bandCache.set(band, p);
  }
  return p;
};

/**
 * Picks a puzzle close to `target` (rating), matching the theme filter and not
 * already solved. Widens the window until something is found.
 */
export const pickPuzzle = async (target: number, themeId: string, exclude: Set<string>): Promise<Puzzle | null> => {
  const filter = THEME_FILTERS.find((f) => f.id === themeId) ?? THEME_FILTERS[0];
  const matches = (p: Puzzle) =>
    !exclude.has(p.id) && (filter.match.length === 0 || p.themes.some((t) => filter.match.includes(t)));

  for (const width of [100, 200, 400, 800]) {
    const bands: number[] = [];
    for (let b = bandOf(target - width); b <= bandOf(target + width); b += 100) bands.push(b);
    const all = (await Promise.all(bands.map(loadBand))).flat();
    const candidates = all.filter((p) => Math.abs(p.rating - target) <= width && matches(p));
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return null;
};

/** Elo style update of the player's puzzle rating. */
export const updatePuzzleRating = (player: number, puzzle: number, solved: boolean, games: number) => {
  const k = games < 10 ? 60 : games < 30 ? 40 : 24;
  const expected = 1 / (1 + Math.pow(10, (puzzle - player) / 400));
  return Math.round(Math.max(400, Math.min(3000, player + k * ((solved ? 1 : 0) - expected))));
};
