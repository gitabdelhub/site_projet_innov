import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  User,
  Undo2,
  Flag,
  RefreshCw,
  LogOut,
  Loader2,
  Trophy,
  Handshake,
  Frown,
  LineChart,
  Gauge,
  Dices,
  Users,
  Timer,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Board } from '../components/board/Board';
import { MoveList } from '../components/board/MoveList';
import { GameReview } from '../components/analysis/GameReview';
import { EloPanel } from '../components/analysis/EloPanel';
import type { GameAnalysis } from '../engine/analysis';
import { useEngineGame, TIME_CONTROLS } from '../hooks/useEngineGame';
import { ENGINE_LEVELS, levelForElo } from '../engine/levels';
import { materialFromFen, outcomeFor, START_FEN, type Color } from '../lib/chessGame';
import { latestElo, useProgress } from '../lib/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { pieceSrc } from '../components/board/Board';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';

const LEVEL_NAME: Record<number, MessageKey> = {
  1: 'level.1',
  2: 'level.2',
  3: 'level.3',
  4: 'level.4',
  5: 'level.5',
  6: 'level.6',
  7: 'level.7',
  8: 'level.8',
  9: 'level.9',
};

const formatClock = (ms: number) => {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  if (total < 10000) return `0:0${sec}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const Captured = ({ pieces, color, diff }: { pieces: string[]; color: Color; diff: number }) => (
  <div className="flex items-center gap-0.5 h-4">
    {pieces.map((p, i) => (
      <img key={i} src={pieceSrc(color, p)} alt="" className="w-4 h-4 -mr-1 opacity-80" />
    ))}
    {diff > 0 && <span className="ml-2 text-[11px] font-bold text-text-secondary">+{diff}</span>}
  </div>
);

const Setup = ({ onStart }: { onStart: (c: Color, level: number, timeControlId: string) => void }) => {
  const { t } = useI18n();
  const progress = useProgress();
  const elo = latestElo(progress);
  const recommended = elo ? levelForElo(elo).id : 3;
  const [level, setLevel] = useState(recommended);
  const [color, setColor] = useState<Color | 'random'>('w');
  const [tc, setTc] = useState('rapid');
  const online = isSupabaseConfigured();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-2">{t('play.title')}</h1>
        <p className="text-text-secondary">{t('play.subtitle')}</p>
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">{t('play.vsEngine')}</h2>
              <p className="text-xs text-text-secondary">{t('play.vsEngineDesc')}</p>
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-1.5">
            <Gauge size={14} /> {t('play.level')}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mb-2">
            {ENGINE_LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`relative rounded-xl border px-2 py-2.5 text-left transition-all ${
                  level === l.id
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-gray-200 hover:border-accent/50 bg-bg-dark'
                }`}
              >
                <span className="block text-sm font-bold text-text-primary">{t(LEVEL_NAME[l.id])}</span>
                <span className="block text-[11px] text-text-secondary font-mono">~{l.elo} Elo</span>
                {l.id === recommended && elo && (
                  <span className="absolute -top-2 right-1 text-[9px] font-bold bg-accent text-white rounded-full px-1.5 py-0.5">
                    {t('play.forYou')}
                  </span>
                )}
              </button>
            ))}
          </div>
          {elo && <p className="text-xs text-text-secondary mb-4">{t('play.recommendedHint', { elo })}</p>}

          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mt-4 mb-2">{t('play.color')}</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['w', 'random', 'b'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                  color === c ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-gray-200 hover:border-accent/50 bg-bg-dark'
                }`}
              >
                {c === 'random' ? (
                  <Dices size={28} className="text-text-secondary" />
                ) : (
                  <img src={pieceSrc(c, 'k')} alt="" className="w-8 h-8" />
                )}
                <span className="text-xs font-semibold text-text-primary">
                  {c === 'w' ? t('common.white') : c === 'b' ? t('common.black') : t('play.random')}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-1.5">
            <Timer size={14} /> {t('play.timeControl')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {TIME_CONTROLS.map((x) => (
              <button
                key={x.id}
                onClick={() => setTc(x.id)}
                className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                  tc === x.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-gray-200 hover:border-accent/50 bg-bg-dark'
                }`}
              >
                <span className="block text-sm font-bold text-text-primary">{t(`tc.${x.id}` as MessageKey)}</span>
                <span className="flex items-center justify-center text-[11px] text-text-secondary font-mono h-4">
                  {x.initial ? `${x.initial / 60} min${x.increment ? ` + ${x.increment} s` : ''}` : <InfinityIcon size={14} />}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => onStart(color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color, level, tc)}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3.5 rounded-xl shadow-sm shadow-accent/25 transition-colors"
          >
            {t('play.start')}
          </button>
        </div>

        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-3">
            <Users size={22} />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-1">{t('play.online')}</h2>
          <p className="text-sm text-text-secondary mb-4 flex-1">{t('play.onlineDesc')}</p>
          {online ? (
            <Link
              to="/online"
              className="w-full text-center bg-bg-dark border border-gray-200 hover:bg-bg-darker text-text-primary font-bold py-3 rounded-xl text-sm"
            >
              {t('play.onlineGo')}
            </Link>
          ) : (
            <span className="w-full text-center bg-bg-darker text-text-secondary font-semibold py-3 rounded-xl text-sm">
              {t('play.onlineSoon')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const Play = () => {
  const { t } = useI18n();
  const g = useEngineGame();
  const [flipped, setFlipped] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);

  if (!g.game) {
    return (
      <Setup
        onStart={(c, level, timeControlId) => {
          setFlipped(false);
          setReviewing(false);
          g.start({ playerColor: c, levelId: level, timeControlId });
        }}
      />
    );
  }

  const { game, over, level } = g;
  const player = game.playerColor;
  const orientation: Color = flipped ? (player === 'w' ? 'b' : 'w') : player;
  const material = materialFromFen(g.fen);
  const engineColor: Color = player === 'w' ? 'b' : 'w';
  const outcome = over ? outcomeFor(over.result, player) : null;

  const PlayerBar = ({ who }: { who: 'engine' | 'player' }) => {
    const c = who === 'engine' ? engineColor : player;
    const captured = c === 'w' ? material.capturedByWhite : material.capturedByBlack;
    const diff = c === 'w' ? material.balance : -material.balance;
    const active = !over && g.turn === c;
    return (
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
          active ? 'bg-accent/10 border-accent/40' : 'bg-bg-card border-gray-200/80'
        }`}
      >
        <div className="w-9 h-9 rounded-lg bg-bg-darker flex items-center justify-center text-text-secondary">
          {who === 'engine' ? <Bot size={20} /> : <User size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">
            {who === 'engine' ? `Stockfish · ${t(LEVEL_NAME[level.id])}` : t('play.you')}
            {who === 'engine' && <span className="ml-2 text-[11px] font-mono text-text-secondary">~{level.elo}</span>}
          </p>
          <Captured pieces={captured} color={c === 'w' ? 'b' : 'w'} diff={diff} />
        </div>
        {who === 'engine' && g.thinking && <Loader2 size={18} className="animate-spin text-accent" />}
        {g.clocks && (
          <span
            className={`font-mono font-bold text-lg sm:text-xl px-3 py-1 rounded-lg tabular-nums ${
              g.clocks[c] < 20000 && !over
                ? 'bg-red-100 text-danger'
                : active
                  ? 'bg-accent text-white'
                  : 'bg-bg-darker text-text-primary'
            }`}
          >
            {formatClock(g.clocks[c])}
          </span>
        )}
      </div>
    );
  };

  if (reviewing && over) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-black text-text-primary">{t('review.title')}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setReviewing(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-bg-card text-sm font-semibold hover:bg-bg-darker"
            >
              {t('review.back')}
            </button>
            <button
              onClick={() => {
                setReviewing(false);
                g.quit();
              }}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold"
            >
              {t('game.newGame')}
            </button>
          </div>
        </div>
        <GameReview
          startFen={game.startFen ?? START_FEN}
          moves={game.moves}
          orientation={player}
          playerColor={player}
          whiteName={player === 'w' ? t('play.you') : `Stockfish ~${level.elo}`}
          blackName={player === 'b' ? t('play.you') : `Stockfish ~${level.elo}`}
          onAnalysed={setAnalysis}
          aside={
            <EloPanel
              startFen={game.startFen}
              moves={game.moves}
              analysis={analysis}
              color={player}
              source="game"
              gameId={game.id}
              initialSec={g.timeControl.initial ?? undefined}
            />
          }
        />
      </div>
    );
  }

  const status = over
    ? null
    : g.thinking
      ? t('game.engineThinking')
      : g.turn === player
        ? g.inCheck
          ? t('game.youInCheck')
          : t('game.yourTurn')
        : t('game.engineTurn');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 items-start">
        <div className="flex flex-col gap-2 w-full max-w-[min(100%,calc(100vh-170px))] lg:max-w-[min(640px,calc(100vh-170px))] mx-auto">
          <PlayerBar who="engine" />
          <div className="relative">
            <Board
              fen={g.fen}
              orientation={orientation}
              movable={over ? null : player}
              onMove={g.playerMove}
              lastMove={g.lastMove}
            />
            {over && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[1px] rounded-lg animate-fade-in p-4">
                <div className="bg-bg-card rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-xs text-center">
                  <div
                    className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                      outcome === 'win' ? 'bg-green-100 text-green-600' : outcome === 'draw' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-danger'
                    }`}
                  >
                    {outcome === 'win' ? <Trophy size={28} /> : outcome === 'draw' ? <Handshake size={28} /> : <Frown size={28} />}
                  </div>
                  <h2 className="text-xl font-black text-text-primary">
                    {outcome === 'win' ? t('result.win') : outcome === 'draw' ? t('result.draw') : t('result.loss')}
                  </h2>
                  <p className="text-sm text-text-secondary mb-4">
                    {over.result} · {t(`reason.${over.reason}` as MessageKey)}
                  </p>
                  <button
                    onClick={() => {
                      setAnalysis(null);
                      setReviewing(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl mb-2"
                  >
                    <LineChart size={18} /> {t('result.analyse')}
                  </button>
                  <button
                    onClick={() => g.quit()}
                    className="w-full bg-bg-darker hover:bg-gray-200 text-text-primary font-semibold py-2.5 rounded-xl text-sm"
                  >
                    {t('game.newGame')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <PlayerBar who="player" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <p className="text-center text-base font-bold text-text-primary bg-bg-darker rounded-xl py-3 mb-3 min-h-[48px]">
              {status ?? `${over?.result}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={g.undo}
                disabled={!g.canUndo}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-bg-darker hover:bg-gray-200 disabled:opacity-40 text-sm font-semibold text-text-primary"
              >
                <Undo2 size={16} /> {t('game.undo')}
              </button>
              <button
                onClick={() => setFlipped((f) => !f)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-bg-darker hover:bg-gray-200 text-sm font-semibold text-text-primary"
              >
                <RefreshCw size={16} /> {t('game.flip')}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('game.resignConfirm'))) g.resign();
                }}
                disabled={!!over || game.moves.length < 2}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-40 text-sm font-semibold text-danger"
              >
                <Flag size={16} /> {t('game.resign')}
              </button>
              <button
                onClick={() => {
                  if (over || game.moves.length === 0 || window.confirm(t('game.quitConfirm'))) g.quit();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-bg-darker hover:bg-gray-200 text-sm font-semibold text-text-primary"
              >
                <LogOut size={16} /> {t('game.leave')}
              </button>
            </div>
          </div>

          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 px-1">{t('moves.title')}</p>
            <MoveList sans={game.moves.map((m) => m.san)} className="max-h-48 lg:max-h-[340px]" />
          </div>
        </div>
      </div>
    </div>
  );
};
