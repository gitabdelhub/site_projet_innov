import React, { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { evaluatePositions, judgeMoves, summarize, type AnalyzedMove, type SideSummary } from '../lib/analysis';
import { eloFeatures } from '../lib/eloFeatures';
import { predictElo, errorFor, MODEL_GAMES, MODEL_RANGE } from '../lib/eloModel';
import { updateProgress } from '../lib/progress';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';
import { explainMove } from '../lib/explain';

// An error whose message is a translation key (so it follows the language switch)
class KeyedError extends Error {
  constructor(public key: MessageKey, public vars: Record<string, string> = {}) {
    super(key);
  }
}

type Side = 'w' | 'b';

interface GameReport {
  white: string;
  black: string;
  result: string;
  date: string;
  side: Side;
  actualElo: number | null; // rating written in the PGN, when there is one
  moves: AnalyzedMove[];
  fens: string[]; // position before each move
  best: (string | null)[]; // the engine's move in each position (UCI)
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
  style: 'aggressive' | 'positional' | 'balanced';
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
  if (res.status === 404) throw new KeyedError('elo.errUserLichess', { user: username });
  if (!res.ok) throw new KeyedError('elo.errDown', { site: 'Lichess' });
  const pgn = (await res.text()).trim();
  if (!pgn.startsWith('[')) throw new KeyedError('elo.errNoGames', { user: username, site: 'Lichess' });
  return pgn;
};

const fetchChessComGames = async (username: string, max: number) => {
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  if (res.status === 404) throw new KeyedError('elo.errUserChesscom', { user: username });
  if (!res.ok) throw new KeyedError('elo.errDown', { site: 'Chess.com' });
  const { archives } = await res.json();
  const found: string[] = [];
  for (let i = archives.length - 1; i >= 0 && found.length < max; i--) {
    const month = await (await fetch(archives[i])).json();
    const games = (month.games || []).filter((g: any) => g.rules === 'chess' && g.pgn && g.time_class !== 'bullet' && g.time_class !== 'daily');
    for (let j = games.length - 1; j >= 0 && found.length < max; j--) found.push(games[j].pgn);
  }
  if (!found.length) throw new KeyedError('elo.errNoGames', { user: username, site: 'Chess.com' });
  return found.join('\n\n');
};

export const CoachElo: React.FC = () => {
  const { t, lang } = useI18n();
  const [pgnText, setPgnText] = useState('');
  const [username, setUsername] = useState('');
  const [importedUser, setImportedUser] = useState<string | null>(null);
  const [source, setSource] = useState<'lichess' | 'chesscom'>('lichess');
  const [gameCount, setGameCount] = useState(5);
  const [importing, setImporting] = useState(false);
  const [side, setSide] = useState<Side>('w');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ game: 0, games: 0, done: 0, total: 0 });
  const [error, setError] = useState<{ key: MessageKey; vars?: Record<string, string | number> } | null>(null);
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
        e instanceof KeyedError
          ? { key: e.key, vars: e.vars }
          : e instanceof TypeError
            ? { key: 'elo.errBlocked', vars: { site: source === 'lichess' ? 'Lichess' : 'Chess.com' } }
            : { key: 'elo.errImport' }
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
        setError({ key: 'elo.errPgn', vars: { n: i + 1 } });
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
      setError({ key: 'elo.errShort', vars: { n: MIN_OWN_MOVES } });
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
        fens,
        best: [...job.bestMoves],
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
      style: aggressive > 0.35 ? 'aggressive' : aggressive < 0.15 ? 'positional' : 'balanced',
    });
    setAnalyzing(false);
    updateProgress((p) => ({ ...p, gamesAnalyzed: p.gamesAnalyzed + games.length }));
  };

  const bar = (label: string, value: number | null) => (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary">{value === null ? t('elo.notReached') : `${value}%`}</span>
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
        <PageHeader icon="chart" title={t('elo.title')} subtitle={t('elo.subtitle')} />

        {!report ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">{t('elo.importTitle')}</h3>
              <div className="flex flex-wrap gap-2">
                {(['lichess', 'chesscom'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${source === s ? 'bg-accent text-white border-accent' : 'bg-bg-dark text-text-primary border-gray-200 hover:bg-bg-darker'}`}
                  >
                    {s === 'lichess' ? 'Lichess' : 'Chess.com'}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder={t('elo.usernamePlaceholder', { site: source === 'lichess' ? 'Lichess' : 'Chess.com' })}
                  className="flex-1 bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 text-sm focus:border-accent focus:outline-none"
                />
                <select
                  value={gameCount}
                  onChange={(e) => setGameCount(Number(e.target.value))}
                  aria-label={t('elo.gameCount')}
                  className="bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-3 py-3 text-sm font-semibold focus:border-accent focus:outline-none"
                >
                  {GAME_COUNTS.map((n) => (
                    <option key={n} value={n}>{t(n > 1 ? 'elo.games' : 'elo.game', { n })} · ±{errorFor(n)}</option>
                  ))}
                </select>
                <button
                  onClick={handleImport}
                  disabled={importing || !username.trim()}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200 text-text-primary font-bold py-3 px-5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {importing ? t('elo.importing') : t('elo.import')}
                </button>
              </div>
              <p className="text-xs text-text-secondary">{t('elo.moreGames')}</p>
            </div>

            <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-text-primary">
                {t('elo.pasteTitle')}{pastedGames > 1 ? ` · ${t('elo.games', { n: pastedGames })}` : ''}
              </h3>
              <textarea
                value={pgnText}
                onChange={(e) => { setPgnText(e.target.value); setImportedUser(null); }}
                placeholder={t('elo.pastePlaceholder')}
                className="w-full h-40 bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 font-mono text-xs focus:border-accent focus:outline-none resize-none"
                disabled={analyzing}
              />
              {importedUser ? (
                <p className="text-xs text-text-secondary">{t('elo.ratingUser', { user: importedUser })}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-text-secondary uppercase">{t('elo.evaluate')}</span>
                  {(['w', 'b'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSide(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${side === c ? 'bg-accent text-white border-accent' : 'bg-bg-dark text-text-primary border-gray-200'}`}
                    >
                      {t(c === 'w' ? 'elo.white' : 'elo.black')}
                    </button>
                  ))}
                </div>
              )}

              {error && <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-2">{t(error.key, error.vars)}</p>}

              {analyzing && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">
                    {progress.games > 1 ? t('elo.progressMany', { game: progress.game, games: progress.games, done: progress.done, total: progress.total }) : t('elo.progressOne', { done: progress.done, total: progress.total })}
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
                  {analyzing ? t('elo.analysing') : pastedGames > 1 ? t('elo.analyseMany', { n: pastedGames }) : t('elo.analyseOne')}
                </button>
                <button
                  onClick={() => { setPgnText(SAMPLE_PGN); setImportedUser(null); setSide('w'); }}
                  disabled={analyzing}
                  className="bg-bg-darker hover:bg-bg-dark border border-gray-200/80 text-text-primary font-bold py-3.5 px-4 rounded-xl text-sm transition-all"
                >
                  {t('elo.sample')}
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-text-secondary leading-relaxed max-w-xl mx-auto">
              {t('elo.howItWorks', { games: MODEL_GAMES.toLocaleString(lang), min: MODEL_RANGE.min, max: MODEL_RANGE.max, one: errorFor(1), ten: errorFor(10) })}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-bg-card border border-gray-200/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs text-xs">
              <div><span className="font-bold text-text-secondary">{t('elo.player')}</span> <span className="text-text-primary font-semibold">{report.playerName}</span></div>
              <div><span className="font-bold text-text-secondary">{t('elo.gamesAnalysed')}</span> <span className="text-text-primary font-semibold">{report.games.length}</span></div>
              <div><span className="font-bold text-text-secondary">{t('elo.movesRated')}</span> <span className="text-text-primary font-semibold">{report.games.reduce((s, g) => s + g.summary.moves, 0)}</span></div>
              <button onClick={() => setReport(null)} className="font-semibold text-accent hover:underline">{t('elo.again')}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-5 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-center">
                <div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 rounded-full text-accent text-[10px] font-extrabold uppercase tracking-wide mb-4">
                    <Icon name="sparkle" className="w-3.5 h-3.5" /> {t('elo.badge')}
                  </span>
                  <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-1">{t('elo.estimated')}</h3>
                  <div className="text-5xl font-black text-text-primary font-mono tracking-tight mb-1">
                    {report.estimate} <span className="text-xs text-text-secondary font-sans font-normal">Elo</span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary mb-2">
                    {t('elo.range', { low: Math.max(400, report.estimate - report.margin), high: report.estimate + report.margin })}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t('elo.marginNote', { n: report.games.length, margin: report.margin })}
                    {report.games.length < 10 ? ` ${t('elo.moreToNarrow')}` : ''}
                  </p>
                  {report.actualElo !== null && (
                    <p className="text-xs mt-3 bg-bg-dark rounded-lg py-2 px-3 text-text-secondary">
                      {t('elo.recorded')} <span className="font-bold text-text-primary">{report.actualElo}</span>
                      {' '}({report.estimate - report.actualElo >= 0 ? '+' : ''}{report.estimate - report.actualElo})
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-6 mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">{t('common.accuracy')}</div>
                    <div className="text-3xl font-bold text-accent font-mono">{report.accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase mb-1">{t('elo.avgLoss')}</div>
                    <div className="text-3xl font-bold text-text-primary font-mono">{report.acpl}</div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-text-secondary uppercase mb-1">{t('elo.style')}</h3>
                  <h4 className="text-xl font-bold text-text-primary">{t(`elo.style.${report.style}` as MessageKey)}</h4>
                  <p className="text-sm text-text-secondary mt-1 leading-relaxed">{t(`elo.styleDesc.${report.style}` as MessageKey)}</p>
                </div>
                <div className="space-y-3 pt-2">
                  {bar(t('elo.phaseOpening'), report.opening)}
                  {bar(t('elo.phaseMiddle'), report.middlegame)}
                  {bar(t('elo.phaseEnd'), report.endgame)}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-2">
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-green-600 text-lg">{report.best}</div>{t('review.cat.best')}</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-yellow-600 text-lg">{report.inaccuracies}</div>{t('review.inaccuracies')}</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-orange-500 text-lg">{report.mistakes}</div>{t('review.mistakes')}</div>
                  <div className="bg-bg-dark rounded-lg py-2"><div className="text-red-500 text-lg">{report.blunders}</div>{t('review.blunders')}</div>
                </div>
              </div>
            </div>

            {report.games.length > 1 && (
              <div className="bg-bg-card border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-text-primary mb-3">{t('elo.byGame')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-left text-xs text-text-secondary uppercase">
                        <th className="py-1">{t('elo.colGame')}</th><th>{t('elo.colResult')}</th><th className="text-right">{t('common.accuracy')}</th><th className="text-right">{t('elo.colEstimate')}</th><th className="text-right">{t('elo.colRecorded')}</th>
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
                <h3 className="font-bold text-text-primary mb-3">{t('elo.keyMoments')}</h3>
                <ul className="space-y-2 text-sm">
                  {report.games.flatMap((g, gi) =>
                    g.moves.map((m, i) =>
                      m.color === g.side && (m.category === 'mistake' || m.category === 'blunder') ? (
                        <li key={`${gi}-${i}`} className="border-b border-gray-100 last:border-0 pb-2">
                          <div className="flex justify-between gap-4">
                            <span className="font-mono text-text-primary">
                              {report.games.length > 1 && <span className="text-text-secondary">{t('elo.gameN', { n: gi + 1 })} · </span>}
                              {Math.floor(i / 2) + 1}{m.color === 'w' ? '.' : '...'} {localSan(m.san, lang)}
                            </span>
                            <span className={m.category === 'blunder' ? 'text-red-500 font-bold' : 'text-orange-500 font-bold'}>
                              {t(m.category === 'blunder' ? 'review.cat.blunder' : 'review.cat.mistake')} (−{(m.loss / 100).toFixed(1)})
                            </span>
                          </div>
                          {(() => {
                            const ex = explainMove(g.fens[i], m, g.best[i] ?? null, t);
                            return (
                              <p className="text-xs text-text-secondary leading-relaxed mt-1">
                                {ex.facts.join(' ')}
                                {ex.better && (
                                  <span className="text-green-700 font-semibold"> {t('explain.better', { move: localSan(ex.better.san, lang) })} {ex.better.why.join(' ')}</span>
                                )}
                              </p>
                            );
                          })()}
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
