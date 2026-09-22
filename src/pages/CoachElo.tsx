import React, { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { evaluatePositions, judgeMoves, summarize, eloFromAcpl, type AnalyzedMove, type SideSummary } from '../lib/analysis';
import { updateProgress } from '../lib/progress';

// Optional Python backend (ml_backend/app.py), e.g. VITE_ML_API_URL=http://localhost:5000
const ML_API_URL: string | undefined = import.meta.env.VITE_ML_API_URL;

interface GameInfo {
  white: string;
  black: string;
  date: string;
  result: string;
  whiteElo: string;
  blackElo: string;
  movesCount: number;
}

interface Assessment {
  side: 'w' | 'b';
  predictedElo: number;
  method: 'ml' | 'acpl';
  summary: SideSummary;
  opening: number | null;
  middlegame: number | null;
  endgame: number | null;
  tacticalVision: number;
  style: string;
  styleDesc: string;
}

const SAMPLE_PGN = `[Event "Casual game"]
[Site "Chess Hub"]
[Date "2026.05.20"]
[White "GuestPlayer"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1420"]
[BlackElo "1380"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 11. Rxe4 d6 12. Bg5 Bxg5 13. Nxg5 h6 14. Qe2 hxg5 15. Re1 Be6 16. dxe6 f6 17. Re3 c6 18. Rh3 Rxh3 19. gxh3 g6 20. Qf3 Qa5 21. Rd1 Qf5 22. Qb3 O-O-O 23. Qa3 Qc5 24. Qb4 1-0`;

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

// Try the optional Python ML backend (ml_backend/app.py); resolve null if unreachable
const predictWithBackend = async (features: number[]): Promise<number | null> => {
  if (!ML_API_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${ML_API_URL}/api/predict-elo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.method === 'ml_model' ? Math.round(data.predicted_elo) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchLichessGame = async (username: string) => {
  const user = encodeURIComponent(username);
  const headers = { Accept: 'application/x-chess-pgn' };
  // current-game returns the ongoing game or, if none, the last one played
  let res = await fetch(`https://lichess.org/api/user/${user}/current-game`, { headers });
  if (!res.ok && res.status !== 404) res = await fetch(`https://lichess.org/api/games/user/${user}?max=1`, { headers });
  if (res.status === 404) throw new Error(`Lichess user "${username}" not found, or no games played yet.`);
  if (!res.ok) throw new Error('Lichess is unavailable right now.');
  const pgn = (await res.text()).trim();
  if (!pgn.startsWith('[')) throw new Error(`No games found for "${username}" on Lichess.`);
  return pgn;
};

const fetchChessComGame = async (username: string) => {
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  if (res.status === 404) throw new Error(`Chess.com user "${username}" not found.`);
  if (!res.ok) throw new Error('Chess.com is unavailable right now.');
  const { archives } = await res.json();
  for (let i = archives.length - 1; i >= 0; i--) {
    const month = await (await fetch(archives[i])).json();
    const standard = (month.games || []).filter((g: any) => g.rules === 'chess' && g.pgn);
    if (standard.length) return standard[standard.length - 1].pgn as string;
  }
  throw new Error(`No games found for "${username}" on Chess.com.`);
};

export const CoachElo: React.FC = () => {
  const [pgnText, setPgnText] = useState('');
  const [username, setUsername] = useState('');
  const [source, setSource] = useState<'lichess' | 'chesscom'>('lichess');
  const [importing, setImporting] = useState(false);
  const [side, setSide] = useState<'w' | 'b'>('w');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [moves, setMoves] = useState<AnalyzedMove[]>([]);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const handleImport = async () => {
    if (!username.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const pgn = source === 'lichess' ? await fetchLichessGame(username.trim()) : await fetchChessComGame(username.trim());
      setPgnText(pgn);
      const black = pgn.match(/\[Black "([^"]*)"\]/)?.[1] ?? '';
      setSide(black.toLowerCase() === username.trim().toLowerCase() ? 'b' : 'w');
    } catch (e: any) {
      // Network/CORS failures surface as TypeError ("Failed to fetch")
      setError(
        e instanceof TypeError
          ? `${source === 'lichess' ? 'Lichess' : 'Chess.com'} refused the request from the browser. Download the game's PGN from the site and paste it below.`
          : e.message || 'Import failed.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    const chess = new Chess();
    try {
      chess.loadPgn(pgnText.trim());
    } catch {
      setError('This PGN could not be read. Check that it is a complete, valid game.');
      return;
    }
    const history = chess.history({ verbose: true });
    if (history.length < 2) {
      setError('The game needs at least a couple of moves to be analyzed.');
      return;
    }

    const headers = chess.getHeaders();
    const fens = [history[0].before, ...history.map((m) => m.after)];
    const startColor = history[0].color;

    setAnalyzing(true);
    setProgress({ done: 0, total: fens.length });
    const job = evaluatePositions(fens, (done) => setProgress({ done, total: fens.length }));
    cancelRef.current = job.cancel;
    const evals = await job.promise;
    cancelRef.current = null;
    if (evals.length !== fens.length) {
      setAnalyzing(false);
      return;
    }

    const judged = judgeMoves(history.map((m) => m.san), evals, startColor);
    const mine = judged.filter((m) => m.color === side);
    const summary = summarize(judged, side);
    const phase = (from: number, to: number) => avg(mine.filter((_, i) => i >= from && i < to).map((m) => m.accuracy));
    const myHistory = history.filter((m) => m.color === side);
    const aggression = myHistory.filter((m) => m.captured || m.san.includes('+')).length / Math.max(1, myHistory.length);

    // Features expected by ml_backend/app.py
    const features = [
      history.length,
      chess.turn() === 'w' ? 1 : 0,
      history.filter((m) => m.captured).length,
      history.filter((m) => m.san.includes('+')).length,
      history.filter((m) => m.san.includes('#')).length,
      ...(['p', 'n', 'b', 'r', 'q', 'k'] as const).map((p) => history.filter((m) => m.piece === p).length),
    ];
    const mlElo = await predictWithBackend(features);

    setGameInfo({
      white: headers.White || 'White',
      black: headers.Black || 'Black',
      date: headers.Date || '—',
      result: headers.Result || (chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : '*'),
      whiteElo: headers.WhiteElo || '—',
      blackElo: headers.BlackElo || '—',
      movesCount: history.length,
    });
    setAssessment({
      side,
      predictedElo: mlElo ?? eloFromAcpl(summary.acpl),
      method: mlElo ? 'ml' : 'acpl',
      summary,
      opening: phase(0, 10),
      middlegame: phase(10, 30),
      endgame: phase(30, Infinity),
      tacticalVision: Math.round(((summary.moves - summary.mistakes - summary.blunders) / Math.max(1, summary.moves)) * 100),
      style: aggression > 0.35 ? 'Aggressive' : aggression < 0.15 ? 'Positional' : 'Balanced',
      styleDesc:
        aggression > 0.35
          ? 'You look for captures and checks and keep the initiative.'
          : aggression < 0.15
            ? 'You build your position patiently and avoid early exchanges.'
            : 'You mix quiet manoeuvres with tactical strikes when they appear.',
    });
    setMoves(judged);
    setAnalyzing(false);
    updateProgress((p) => ({ ...p, gamesAnalyzed: p.gamesAnalyzed + 1 }));
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

  const playerName = gameInfo ? (assessment?.side === 'w' ? gameInfo.white : gameInfo.black) : '';

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">📊 Elo Prediction</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Import or paste a game: Stockfish reviews every move and estimates the playing strength behind it.
          </p>
        </div>

        {!assessment ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">Import your latest game</h3>
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
                <button
                  onClick={handleImport}
                  disabled={importing || !username.trim()}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200 text-text-primary font-bold py-3 px-5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Import last game'}
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">Or paste a PGN</h3>
              <textarea
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                placeholder="Paste your Chess.com or Lichess game PGN here..."
                className="w-full h-40 bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 font-mono text-xs focus:border-accent focus:outline-none resize-none"
                disabled={analyzing}
              />
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

              {error && <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-2">{error}</p>}

              {analyzing && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">🤖 Stockfish is reviewing the game… {progress.done}/{progress.total} positions</p>
                  <div className="w-full h-2 bg-bg-darker rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !pgnText.trim()}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25 disabled:opacity-50"
                >
                  {analyzing ? 'Analyzing…' : 'Analyze Game'}
                </button>
                <button
                  onClick={() => { setPgnText(SAMPLE_PGN); setSide('w'); }}
                  disabled={analyzing}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200/80 text-text-primary font-bold py-3.5 px-4 rounded-xl text-sm transition-all"
                >
                  Load Sample
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs text-xs">
              <div><span className="font-bold text-text-secondary">Game:</span> <span className="text-text-primary font-semibold">{gameInfo?.white} ({gameInfo?.whiteElo}) vs {gameInfo?.black} ({gameInfo?.blackElo})</span></div>
              <div><span className="font-bold text-text-secondary">Result:</span> <span className="text-text-primary font-semibold">{gameInfo?.result}</span></div>
              <div><span className="font-bold text-text-secondary">Date:</span> <span className="text-text-primary font-semibold">{gameInfo?.date}</span></div>
              <div><span className="font-bold text-text-secondary">Moves:</span> <span className="text-text-primary font-semibold">{Math.ceil((gameInfo?.movesCount || 0) / 2)}</span></div>
              <button onClick={() => { setAssessment(null); setMoves([]); }} className="font-semibold text-accent hover:underline">Analyze another game</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-5 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-center">
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 rounded-full text-accent text-[10px] font-extrabold uppercase tracking-wide mb-4">
                    {assessment.method === 'ml' ? '🔮 ML model' : '🤖 Engine estimate'}
                  </span>
                  <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-1">Estimated level of {playerName}</h3>
                  <div className="text-5xl font-black text-text-primary font-mono tracking-tight mb-2">
                    {assessment.predictedElo} <span className="text-xs text-text-secondary font-sans font-normal">Elo</span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {assessment.method === 'ml'
                      ? 'Predicted by the trained model.'
                      : `Based on an average loss of ${assessment.summary.acpl} centipawns per move. One game gives a rough estimate — analyze several for a reliable picture.`}
                  </p>
                </div>
                <div className="border-t border-gray-100 pt-6 mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">Accuracy</div>
                    <div className="text-3xl font-bold text-accent font-mono">{assessment.summary.accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">Avg. loss</div>
                    <div className="text-3xl font-bold text-text-primary font-mono">{assessment.summary.acpl}</div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-text-secondary uppercase mb-1">Playing Style</h3>
                  <h4 className="text-xl font-bold text-text-primary">{assessment.style}</h4>
                  <p className="text-sm text-text-secondary mt-1 leading-relaxed">{assessment.styleDesc}</p>
                </div>
                <div className="space-y-3 pt-2">
                  {bar('Tactical vision (moves without mistakes)', assessment.tacticalVision)}
                  {bar('Opening accuracy (moves 1–10)', assessment.opening)}
                  {bar('Middlegame accuracy (moves 11–30)', assessment.middlegame)}
                  {bar('Endgame accuracy (moves 31+)', assessment.endgame)}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-2">
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-green-600 text-lg">{assessment.summary.best}</div>Best</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-yellow-600 text-lg">{assessment.summary.inaccuracies}</div>Inaccuracies</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-orange-500 text-lg">{assessment.summary.mistakes}</div>Mistakes</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-red-500 text-lg">{assessment.summary.blunders}</div>Blunders</div>
                </div>
              </div>
            </div>

            {moves.some((m) => m.color === assessment.side && (m.category === 'mistake' || m.category === 'blunder')) && (
              <div className="bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-primary mb-3">🔍 Key moments</h3>
                <ul className="space-y-1.5 text-sm">
                  {moves.map((m, i) =>
                    m.color === assessment.side && (m.category === 'mistake' || m.category === 'blunder') ? (
                      <li key={i} className="flex justify-between gap-4">
                        <span className="font-mono text-text-primary">{Math.floor(i / 2) + 1}{m.color === 'w' ? '.' : '...'} {m.san}</span>
                        <span className={m.category === 'blunder' ? 'text-red-500 font-bold' : 'text-orange-500 font-bold'}>
                          {m.category} (−{(m.loss / 100).toFixed(1)})
                        </span>
                      </li>
                    ) : null
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
