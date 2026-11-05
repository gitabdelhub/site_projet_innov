import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Info, Loader2, Play, Puzzle, Square, Users } from 'lucide-react';
import { analyseGame, cancelAnalysis } from '../../engine/analysis';
import { initialFromHeaders, MIN_GAMES, type GameStats } from '../../elo/features';
import { predictFromStats, statsOfGame, type EloPrediction } from '../../elo/predict';
import type { Color, ParsedPgn } from '../../lib/chessGame';
import { addPrediction } from '../../lib/storage';
import { useI18n } from '../../i18n';

/** Depth used for a batch of games: a bit lower than a single review to stay fast. */
const BATCH_DEPTH = 12;
const MAX_GAMES = 50;

interface Row {
  index: number;
  game: ParsedPgn;
  color: Color;
  opponent: string;
  result: string;
  accuracy?: number;
}

interface ProfileBatchProps {
  games: ParsedPgn[];
  onOpen: (game: ParsedPgn, color: Color) => void;
}

/** Candidate players of a multi game PGN, most frequent first. */
const playersOf = (games: ParsedPgn[]) => {
  const count = new Map<string, number>();
  for (const g of games) {
    for (const n of [g.headers.White, g.headers.Black]) if (n && n !== '?') count.set(n, (count.get(n) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
};

export const ProfileBatch = ({ games, onOpen }: ProfileBatchProps) => {
  const { t } = useI18n();
  const players = useMemo(() => playersOf(games), [games]);
  const [player, setPlayer] = useState(players[0]?.[0] ?? '');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [plyProgress, setPlyProgress] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [pred, setPred] = useState<EloPrediction | null>(null);
  const stop = useRef(false);

  const selected = useMemo<Row[]>(
    () =>
      games
        .map((game, index) => {
          const color: Color | null = game.headers.White === player ? 'w' : game.headers.Black === player ? 'b' : null;
          if (!color) return null;
          const opponent = (color === 'w' ? game.headers.Black : game.headers.White) ?? '?';
          return {
            index,
            game,
            color,
            opponent,
            result: game.headers.Result ?? '*',
          };
        })
        .filter((r): r is Row => r !== null)
        .slice(0, MAX_GAMES),
    [games, player],
  );

  useEffect(() => () => cancelAnalysis(), []);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setRows([]);
    setPred(null);
    setDone(0);
    const stats: GameStats[] = [];
    let last: EloPrediction | null = null;
    for (const row of selected) {
      if (stop.current) break;
      setPlyProgress(0);
      const analysis = await analyseGame(row.game.startFen, row.game.moves, {
        depth: BATCH_DEPTH,
        onProgress: (d, total) => setPlyProgress(d / total),
      });
      if (!analysis || stop.current) break;
      const s = statsOfGame({
        analysis,
        moves: row.game.moves,
        color: row.color,
        headers: row.game.headers,
      });
      if (s) stats.push(s);
      const summary = row.color === 'w' ? analysis.white : analysis.black;
      setRows((r) => [...r, { ...row, accuracy: summary.accuracy }]);
      setDone((d) => d + 1);
      // The prediction is refreshed after every game: it gets more precise as games add up.
      if (stats.length) {
        last = await predictFromStats(stats);
        setPred(last);
      }
    }
    setRunning(false);
    if (last)
      addPrediction({
        date: new Date().toISOString(),
        elo: last.elo,
        source: 'pgn',
        method: last.method,
      });
  };

  const halt = () => {
    stop.current = true;
    cancelAnalysis();
  };

  const timed = selected.some((r) => initialFromHeaders(r.game.headers) !== undefined);
  const pct = selected.length ? ((done + (running ? plyProgress : 0)) / selected.length) * 100 : 0;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
          <Users size={16} /> {t('batch.whichPlayer')}
        </p>
        <p className="text-xs text-text-secondary mb-3">{t('batch.gamesFound', { n: games.length })}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {players.slice(0, 6).map(([name, n]) => (
            <button
              key={name}
              disabled={running}
              onClick={() => {
                setPlayer(name);
                setRows([]);
                setPred(null);
                setDone(0);
              }}
              className={`px-3 py-1.5 rounded-full border text-sm font-semibold disabled:opacity-60 ${
                player === name ? 'bg-accent text-white border-accent' : 'border-gray-200 text-text-primary bg-bg-card'
              }`}
            >
              {name} <span className="opacity-70 font-normal">· {n}</span>
            </button>
          ))}
        </div>

        {!running ? (
          <button
            onClick={run}
            disabled={selected.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-3 rounded-xl"
          >
            <Play size={16} /> {t('batch.run', { n: selected.length })}
          </button>
        ) : (
          <button
            onClick={halt}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-3 rounded-xl"
          >
            <Square size={14} /> {t('batch.stop')}
          </button>
        )}
        <p className="text-[11px] text-text-secondary mt-2">
          {t('batch.note', { depth: BATCH_DEPTH })} {!timed && t('batch.noClock')}
        </p>

        {(running || done > 0) && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>{t('batch.progress', { done, total: selected.length })}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-bg-darker overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-gray-100">
            {rows.map((r) => (
              <button
                key={r.index}
                onClick={() => onOpen(r.game, r.color)}
                disabled={running}
                className="disabled:cursor-wait flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-bg-darker text-left"
              >
                <span className="text-sm text-text-primary truncate">
                  {r.color === 'w' ? t('batch.withWhite') : t('batch.withBlack')} {t('batch.vs')} {r.opponent} ·{' '}
                  {r.result}
                </span>
                <span className="text-xs font-semibold text-text-secondary shrink-0">
                  {r.accuracy !== undefined ? `${Math.round(r.accuracy)}%` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-accent/10 to-bg-card border border-accent/30 rounded-xl p-4 lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center">
            <Brain size={18} />
          </div>
          <p className="text-sm font-bold text-text-primary">
            {t('elo.title')}
            {player ? <span className="font-normal text-text-secondary"> · {player}</span> : null}
          </p>
        </div>
        {!pred ? (
          <p className="flex items-center gap-2 text-sm text-text-secondary py-3">
            {running && <Loader2 size={16} className="animate-spin" />}
            {running ? t('elo.predicting') : t('batch.idle')}
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-accent">{pred.elo}</span>
              <span className="text-sm text-text-secondary">± {pred.margin}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] font-semibold text-text-primary bg-bg-card border border-gray-200 rounded-full px-2 py-0.5">
                {t(pred.nGames > 1 ? 'elo.profileMany' : 'elo.profileOne', {
                  n: pred.nGames,
                })}
              </span>
              <span
                className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                  pred.reliability === 'good'
                    ? 'bg-emerald-100 text-emerald-800'
                    : pred.reliability === 'medium'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {t(`elo.reliability.${pred.reliability}`)}
              </span>
            </div>
            {pred.nGames < MIN_GAMES && !running && (
              <p className="text-[11px] text-text-secondary mt-1.5">
                {t('elo.moreGames', { n: MIN_GAMES - pred.nGames })}
              </p>
            )}
            <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-1.5 mb-3">
              <Info size={12} />
              {t(`elo.method.${pred.method}`)}
            </p>
            <Link
              to={`/coach/puzzles?elo=${pred.elo}`}
              className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold py-2.5 rounded-lg"
            >
              <Puzzle size={16} /> {t('elo.trainCta')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
