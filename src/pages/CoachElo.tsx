import React, { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { evaluatePositions, judgeMoves, summarize, type AnalyzedMove, type SideSummary } from '../lib/analysis';
import { eloFeatures } from '../lib/eloFeatures';
import { predictElo, errorFor, MODEL_INFO } from '../lib/eloModel';
import { updateProgress } from '../lib/progress';

type Side = 'w' | 'b';

interface GameReport {
  white: string;
  black: string;
  result: string;
  date: string;
  side: Side;
  actualElo: number | null; // rating written in the PGN, when there is one
  moves: AnalyzedMove[];
  summary: SideSummary;
  estimate: number;
}

interface Report {
  games: GameReport[];
  playerName: string;
  estimate: number;
  margin: number;
  actualElo: number | null;
  accuracy: number;
  acpl: number;
  best: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  opening: number | null;
  middlegame: number | null;
  endgame: number | null;
  style: string;
  styleDesc: string;
}

const SAMPLE_PGN = `[Event "Casual game"]
[Site "Chess Hub"]
[Date "2026.05.20"]
[White "GuestPlayer"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 11. Rxe4 d6 12. Bg5 Bxg5 13. Nxg5 h6 14. Qe2 hxg5 15. Re1 Be6 16. dxe6 f6 17. Re3 c6 18. Rh3 Rxh3 19. gxh3 g6 20. Qf3 Qa5 21. Rd1 Qf5 22. Qb3 O-O-O 23. Qa3 Qc5 24. Qb4 1-0`;

const GAME_COUNTS = [1, 3, 5, 10];
const MIN_OWN_MOVES = 10;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[]) => (xs.length ? Math.round(avg(xs) * 10) / 10 : null);

// Several games pasted one after the other: split them on their [Event] tag
const splitPgns = (text: string) => {
  const parts = text.trim().split(/\n\s*\n(?=\s*\[Event )/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
};

const fetchLichessGames = async (username: string, max: number) => {
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&perfType=blitz,rapid,classical&clocks=false&evals=false`,
    { headers: { Accept: 'application/x-chess-pgn' } }
  );
  if (res.status === 404) throw new Error(`Lichess user "${username}" not found.`);
  if (!res.ok) throw new Error('Lichess is unavailable right now.');
  const pgn = (await res.text()).trim();
  if (!pgn.startsWith('[')) throw new Error(`No blitz, rapid or classical games found for "${username}" on Lichess.`);
  return pgn;
};

const fetchChessComGames = async (username: string, max: number) => {
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  if (res.status === 404) throw new Error(`Chess.com user "${username}" not found.`);
  if (!res.ok) throw new Error('Chess.com is unavailable right now.');
  const { archives } = await res.json();
  const found: string[] = [];
  for (let i = archives.length - 1; i >= 0 && found.length < max; i--) {
    const month = await (await fetch(archives[i])).json();
    const games = (month.games || []).filter((g: any) => g.rules === 'chess' && g.pgn && g.time_class !== 'bullet' && g.time_class !== 'daily');
    for (let j = games.length - 1; j >= 0 && found.length < max; j--) found.push(games[j].pgn);
  }
  if (!found.length) throw new Error(`No blitz, rapid or classical games found for "${username}" on Chess.com.`);
  return found.join('\n\n');
};

export const CoachElo: React.FC = () => {
  const [pgnText, setPgnText] = useState('');
  const [username, setUsername] = useState('');
  const [importedUser, setImportedUser] = useState<string | null>(null);
  const [source, setSource] = useState<'lichess' | 'chesscom'>('lichess');
  const [gameCount, setGameCount] = useState(5);
  const [importing, setImporting] = useState(false);
  const [side, setSide] = useState<Side>('w');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ game: 0, games: 0, done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const handleImport = async () => {
    const name = username.trim();
    if (!name) return;
    setImporting(true);
    setError(null);
    try {
      const pgn = source === 'lichess' ? await fetchLichessGames(name, gameCount) : await fetchChessComGames(name, gameCount);
      setPgnText(pgn);
      setImportedUser(name);
    } catch (e: any) {
      // Network/CORS failures surface as TypeError ("Failed to fetch")
      setError(
        e instanceof TypeError
          ? `${source === 'lichess' ? 'Lichess' : 'Chess.com'} refused the request from the browser. Download the games' PGN from the site and paste it below.`
          : e.message || 'Import failed.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    // Read every game first, so a bad PGN is reported before the long analysis
    const parsed: { chess: Chess; sideToRate: Side }[] = [];
    for (const [i, pgn] of splitPgns(pgnText).entries()) {
      const chess = new Chess();
      try {
        chess.loadPgn(pgn);
      } catch {
        setError(`Game ${i + 1} could not be read. Check that it is a complete, valid PGN.`);
        return;
      }
      const headers = chess.getHeaders();
      const sideToRate: Side = importedUser
        ? (headers.Black ?? '').toLowerCase() === importedUser.toLowerCase() ? 'b' : 'w'
        : side;
      if (chess.history().filter((_, k) => (k % 2 === 0) === (sideToRate === 'w')).length < MIN_OWN_MOVES) continue;
      parsed.push({ chess, sideToRate });
    }
    if (!parsed.length) {
      setError(`Each game needs at least ${MIN_OWN_MOVES} moves by the player to be rated.`);
      return;
    }

    setAnalyzing(true);
    const games: GameReport[] = [];
    for (const [i, { chess, sideToRate }] of parsed.entries()) {
      const history = chess.history({ verbose: true });
      const fens = [history[0].before, ...history.map((m) => m.after)];
      setProgress({ game: i + 1, games: parsed.length, done: 0, total: fens.length });
      const job = evaluatePositions(fens, (done) => setProgress({ game: i + 1, games: parsed.length, done, total: fens.length }));
      cancelRef.current = job.cancel;
      const evals = await job.promise;
      cancelRef.current = null;
      if (evals.length !== fens.length) {
        setAnalyzing(false);
        return; // cancelled (page left)
      }
      const headers = chess.getHeaders();
      const result = headers.Result || (chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : '*');
      const moves = judgeMoves(history.map((m) => m.san), evals, history[0].color);
      const rating = Number(sideToRate === 'w' ? headers.WhiteElo : headers.BlackElo);
      games.push({
        white: headers.White || 'White',
        black: headers.Black || 'Black',
        result,
        date: headers.Date || '—',
        side: sideToRate,
        actualElo: rating > 0 ? rating : null,
        moves,
        summary: summarize(moves, sideToRate),
        estimate: predictElo(eloFeatures({ moves, side: sideToRate, result })),
      });
    }

    const mine = games.flatMap((g) => g.moves.filter((m) => m.color === g.side));
    const byPhase = (from: number, to: number) =>
      pct(games.flatMap((g) => g.moves.filter((m) => m.color === g.side).slice(from, to).map((m) => m.accuracy)));
    const sum = (key: keyof SideSummary) => games.reduce((s, g) => s + g.summary[key], 0);
    const aggressive = avg(games.map((g) => {
      const own = g.moves.filter((m) => m.color === g.side);
      return own.filter((m) => m.san.includes('x') || m.san.includes('+')).length / Math.max(1, own.length);
    }));
    const actual = games.map((g) => g.actualElo).filter((r): r is number => r !== null);
    const first = games[0];

    setReport({
      games,
      playerName: importedUser ?? (first.side === 'w' ? first.white : first.black),
      estimate: Math.round(avg(games.map((g) => g.estimate))),
      margin: errorFor(games.length),
      actualElo: actual.length === games.length ? Math.round(avg(actual)) : null,
      accuracy: Math.round(avg(mine.map((m) => m.accuracy)) * 10) / 10,
      acpl: Math.round(avg(mine.map((m) => m.loss))),
      best: sum('best'),
      inaccuracies: sum('inaccuracies'),
      mistakes: sum('mistakes'),
      blunders: sum('blunders'),
      opening: byPhase(0, 10),
      middlegame: byPhase(10, 30),
      endgame: byPhase(30, Infinity),
      style: aggressive > 0.35 ? 'Aggressive' : aggressive < 0.15 ? 'Positional' : 'Balanced',
      styleDesc:
        aggressive > 0.35
          ? 'You look for captures and checks and keep the initiative.'
          : aggressive < 0.15
            ? 'You build your position patiently and avoid early exchanges.'
            : 'You mix quiet manoeuvres with tactical strikes when they appear.',
    });
    setAnalyzing(false);
    updateProgress((p) => ({ ...p, gamesAnalyzed: p.gamesAnalyzed + games.length }));
  };

  const bar = (label: string, value: number | null) => (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary">{value === null ? 'not reached' : `${value}%`}</span>
      </div>
      <div className="w-full bg-bg-darker h-2 rounded-full overflow-hidden">
        <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );

  const pastedGames = pgnText.trim() ? splitPgns(pgnText).length : 0;

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">📊 Elo Prediction</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Stockfish reviews every move, then a model trained on real rated games estimates the strength behind them.
          </p>
        </div>

        {!report ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">Import your latest games</h3>
              <div className="flex flex-wrap gap-2">
                {(['lichess', 'chesscom'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${source === s ? 'bg-accent text-white border-accent' : 'bg-bg-dark text-text-primary border-gray-200 hover:bg-bg-darker'}`}
                  >
                    {s === 'lichess' ? '⚡ Lichess' : '♟️ Chess.com'}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder={`Your ${source === 'lichess' ? 'Lichess' : 'Chess.com'} username`}
                  className="flex-1 bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 text-sm focus:border-accent focus:outline-none"
                />
                <select
                  value={gameCount}
                  onChange={(e) => setGameCount(Number(e.target.value))}
                  aria-label="Number of games"
                  className="bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-3 py-3 text-sm font-semibold focus:border-accent focus:outline-none"
                >
                  {GAME_COUNTS.map((n) => (
                    <option key={n} value={n}>{n} game{n > 1 ? 's' : ''} · ±{errorFor(n)}</option>
                  ))}
                </select>
                <button
                  onClick={handleImport}
                  disabled={importing || !username.trim()}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200 text-text-primary font-bold py-3 px-5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>
              <p className="text-xs text-text-secondary">More games give a more reliable estimate (the ± is the measured error, see below).</p>
            </div>

            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">
                Or paste PGN{pastedGames > 1 ? ` — ${pastedGames} games` : ''}
              </h3>
              <textarea
                value={pgnText}
                onChange={(e) => { setPgnText(e.target.value); setImportedUser(null); }}
                placeholder="Paste one or several games (PGN) from Chess.com or Lichess..."
                className="w-full h-40 bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 font-mono text-xs focus:border-accent focus:outline-none resize-none"
                disabled={analyzing}
              />
              {importedUser ? (
                <p className="text-xs text-text-secondary">Rating <span className="font-bold text-text-primary">{importedUser}</span> in each game, whatever their colour.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-text-secondary uppercase">Evaluate:</span>
                  {(['w', 'b'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSide(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${side === c ? 'bg-accent text-white border-accent' : 'bg-bg-dark text-text-primary border-gray-200'}`}
                    >
                      {c === 'w' ? '♔ White' : '♚ Black'}
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-2">{error}</p>}

              {analyzing && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">
                    🤖 Stockfish is reviewing {progress.games > 1 ? `game ${progress.game}/${progress.games}` : 'the game'}… {progress.done}/{progress.total} positions
                  </p>
                  <div className="w-full h-2 bg-bg-darker rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${((progress.game - 1 + progress.done / Math.max(1, progress.total)) / Math.max(1, progress.games)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !pgnText.trim()}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25 disabled:opacity-50"
                >
                  {analyzing ? 'Analyzing…' : pastedGames > 1 ? `Analyze ${pastedGames} games` : 'Analyze game'}
                </button>
                <button
                  onClick={() => { setPgnText(SAMPLE_PGN); setImportedUser(null); setSide('w'); }}
                  disabled={analyzing}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200/80 text-text-primary font-bold py-3.5 px-4 rounded-xl text-sm transition-all"
                >
                  Load Sample
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-text-secondary leading-relaxed max-w-xl mx-auto">
              How it works: the model was trained on {MODEL_INFO}. Tested on players it never saw, 80% of its estimates fall
              within ±{errorFor(1)} points for one game and ±{errorFor(10)} for ten games. The estimate is a Lichess-style rating.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs text-xs">
              <div><span className="font-bold text-text-secondary">Player:</span> <span className="text-text-primary font-semibold">{report.playerName}</span></div>
              <div><span className="font-bold text-text-secondary">Games analysed:</span> <span className="text-text-primary font-semibold">{report.games.length}</span></div>
              <div><span className="font-bold text-text-secondary">Moves rated:</span> <span className="text-text-primary font-semibold">{report.games.reduce((s, g) => s + g.summary.moves, 0)}</span></div>
              <button onClick={() => setReport(null)} className="font-semibold text-accent hover:underline">Analyze other games</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-5 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-center">
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 rounded-full text-accent text-[10px] font-extrabold uppercase tracking-wide mb-4">
                    🔮 Model trained on real rated games
                  </span>
                  <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-1">Estimated level</h3>
                  <div className="text-5xl font-black text-text-primary font-mono tracking-tight mb-1">
                    {report.estimate} <span className="text-xs text-text-secondary font-sans font-normal">Elo</span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary mb-2">
                    likely between {Math.max(400, report.estimate - report.margin)} and {report.estimate + report.margin}
                  </p>
                  <p className="text-xs text-text-secondary">
                    80% of estimates from {report.games.length} game{report.games.length > 1 ? 's' : ''} fall within ±{report.margin} points
                    {report.games.length < 10 ? ' — analyse more games to narrow it down.' : '.'}
                  </p>
                  {report.actualElo !== null && (
                    <p className="text-xs mt-3 bg-bg-dark rounded-lg py-2 px-3 text-text-secondary">
                      Rating recorded in these games: <span className="font-bold text-text-primary">{report.actualElo}</span>
                      {' '}({report.estimate - report.actualElo >= 0 ? '+' : ''}{report.estimate - report.actualElo})
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-6 mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">Accuracy</div>
                    <div className="text-3xl font-bold text-accent font-mono">{report.accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">Avg. loss</div>
                    <div className="text-3xl font-bold text-text-primary font-mono">{report.acpl}</div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-text-secondary uppercase mb-1">Playing Style</h3>
                  <h4 className="text-xl font-bold text-text-primary">{report.style}</h4>
                  <p className="text-sm text-text-secondary mt-1 leading-relaxed">{report.styleDesc}</p>
                </div>
                <div className="space-y-3 pt-2">
                  {bar('Opening accuracy (moves 1–10)', report.opening)}
                  {bar('Middlegame accuracy (moves 11–30)', report.middlegame)}
                  {bar('Endgame accuracy (moves 31+)', report.endgame)}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-2">
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-green-600 text-lg">{report.best}</div>Best</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-yellow-600 text-lg">{report.inaccuracies}</div>Inaccuracies</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-orange-500 text-lg">{report.mistakes}</div>Mistakes</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-red-500 text-lg">{report.blunders}</div>Blunders</div>
                </div>
              </div>
            </div>

            {report.games.length > 1 && (
              <div className="bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-primary mb-3">Game by game</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-left text-xs text-text-secondary uppercase">
                        <th className="py-1">Game</th><th>Result</th><th className="text-right">Accuracy</th><th className="text-right">Estimate</th><th className="text-right">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.games.map((g, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-1.5 text-text-primary">{g.white} – {g.black} <span className="text-text-secondary text-xs">{g.date}</span></td>
                          <td className="font-mono">{g.result}</td>
                          <td className="text-right font-mono">{g.summary.accuracy}%</td>
                          <td className="text-right font-mono font-bold">{g.estimate}</td>
                          <td className="text-right font-mono text-text-secondary">{g.actualElo ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.games.some((g) => g.moves.some((m) => m.color === g.side && (m.category === 'mistake' || m.category === 'blunder'))) && (
              <div className="bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-primary mb-3">🔍 Key moments</h3>
                <ul className="space-y-1.5 text-sm">
                  {report.games.flatMap((g, gi) =>
                    g.moves.map((m, i) =>
                      m.color === g.side && (m.category === 'mistake' || m.category === 'blunder') ? (
                        <li key={`${gi}-${i}`} className="flex justify-between gap-4">
                          <span className="font-mono text-text-primary">
                            {report.games.length > 1 && <span className="text-text-secondary">Game {gi + 1} · </span>}
                            {Math.floor(i / 2) + 1}{m.color === 'w' ? '.' : '...'} {m.san}
                          </span>
                          <span className={m.category === 'blunder' ? 'text-red-500 font-bold' : 'text-orange-500 font-bold'}>
                            {m.category} (−{(m.loss / 100).toFixed(1)})
                          </span>
                        </li>
                      ) : null
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
