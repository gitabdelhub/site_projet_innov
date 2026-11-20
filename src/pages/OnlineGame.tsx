import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  Copy,
  Flag,
  Frown,
  Handshake,
  LineChart,
  Loader2,
  MessageSquare,
  RefreshCw,
  Repeat,
  Send,
  Swords,
  Trophy,
  User,
  X,
  Eye,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Board, pieceSrc } from '../components/board/Board';
import { MoveList } from '../components/board/MoveList';
import { GameReview } from '../components/analysis/GameReview';
import { EloPanel } from '../components/analysis/EloPanel';
import { AuthCard } from '../components/online/AuthCard';
import type { GameAnalysis } from '../engine/analysis';
import { useAuth } from '../online/auth';
import { useOnlineGame } from '../online/useOnlineGame';
import { tcLabel, type OnlineGame as Game } from '../online/api';
import { materialFromFen, outcomeFor, type Color } from '../lib/chessGame';
import { OnlineChecking, OnlineUnavailable, useOnlineAvailable } from './OnlineLobby';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/messages';

const formatClock = (ms: number) => {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  if (total < 10000) return `0:0${sec}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const reasonText = (t: (k: MessageKey) => string, reason: string | null) => {
  if (!reason) return '';
  const own = `og.reason.${reason}` as MessageKey;
  const common = `reason.${reason}` as MessageKey;
  const a = t(own);
  if (a !== own) return a;
  const b = t(common);
  return b !== common ? b : reason;
};

const Captured = ({ pieces, color, diff }: { pieces: string[]; color: Color; diff: number }) => (
  <div className="flex items-center gap-0.5 h-4">
    {pieces.map((p, i) => (
      <img key={i} src={pieceSrc(color, p)} alt="" className="w-4 h-4 -mr-1 opacity-80" />
    ))}
    {diff > 0 && <span className="ml-2 text-[11px] font-bold text-text-secondary">+{diff}</span>}
  </div>
);

interface BarProps {
  game: Game;
  color: Color;
  clock: number;
  active: boolean;
  online: boolean | null;
  isMe: boolean;
}

const PlayerBar = ({ game, color, clock, active, online, isMe }: BarProps) => {
  const { t } = useI18n();
  const material = materialFromFen(game.fen);
  const name = (color === 'w' ? game.white_name : game.black_name) ?? '...';
  const rating = color === 'w' ? game.white_rating : game.black_rating;
  const delta = color === 'w' ? game.white_delta : game.black_delta;
  const captured = color === 'w' ? material.capturedByWhite : material.capturedByBlack;
  const diff = color === 'w' ? material.balance : -material.balance;
  const running = active && game.status === 'active' && game.ply >= 2;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${
        active && game.status === 'active' ? 'bg-accent/10 border-accent/40' : 'bg-bg-card border-gray-200/80'
      }`}
    >
      <div className="relative w-9 h-9 rounded-lg bg-bg-darker flex items-center justify-center text-text-secondary">
        <User size={20} />
        {online !== null && (
          <span
            title={online ? t('og.connected') : t('og.disconnected')}
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-card ${
              online ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">
          {name}
          {isMe && <span className="ml-1 text-[11px] font-semibold text-text-secondary">({t('play.you')})</span>}
          {rating !== null && <span className="ml-2 text-[11px] font-mono text-text-secondary">{rating}</span>}
          {delta !== null && (
            <span className={`ml-1 text-[11px] font-mono font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-danger'}`}>
              {delta >= 0 ? `+${delta}` : delta}
            </span>
          )}
          {online === false && game.status === 'active' && (
            <span className="ml-2 text-[11px] font-semibold text-amber-700">{t('og.disconnected')}</span>
          )}
        </p>
        <Captured pieces={captured} color={color === 'w' ? 'b' : 'w'} diff={diff} />
      </div>
      <span
        className={`font-mono font-bold text-lg sm:text-xl px-3 py-1 rounded-lg tabular-nums ${
          clock < 20000 && game.status === 'active' && game.ply >= 2
            ? running
              ? 'bg-danger text-white'
              : 'bg-red-100 text-danger'
            : running
              ? 'bg-accent text-white'
              : 'bg-bg-darker text-text-primary'
        }`}
      >
        {formatClock(clock)}
      </span>
    </div>
  );
};

const Chat = ({
  messages,
  me,
  onSend,
}: {
  messages: { id: number; user_id: string; username: string; body: string }[];
  me: string;
  onSend: (body: string) => void;
}) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages.length]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 px-1 flex items-center gap-1.5">
        <MessageSquare size={14} /> {t('og.chat')}
      </p>
      <div ref={box} className="h-28 overflow-y-auto space-y-1 px-1 mb-2 text-sm">
        {messages.length === 0 ? (
          <p className="text-xs text-text-secondary">{t('og.noMessages')}</p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="break-words">
              <span className={`font-bold ${m.user_id === me ? 'text-accent' : 'text-text-primary'}`}>{m.username}</span>{' '}
              <span className="text-text-primary">{m.body}</span>
            </p>
          ))
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={t('og.chatPlaceholder')}
          className="flex-1 min-w-0 bg-bg-dark rounded-xl px-3 py-2 text-sm border border-gray-200 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          aria-label={t('og.send')}
          className="px-3 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-50"
          disabled={!text.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

/** Screen of a challenge that nobody has accepted yet. */
const Waiting = ({ game, isCreator, onCancel, onJoin }: { game: Game; isCreator: boolean; onCancel: () => void; onJoin: () => void }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/online/${game.id}`;
  const creatorName = game.white_name ?? game.black_name ?? '?';
  const creatorRating = game.white_rating ?? game.black_rating;
  const myColor: Color = game.white_id ? 'b' : 'w';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.getElementById('share-url') as HTMLInputElement | null;
      el?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tcInfo = (
    <p className="text-sm text-text-secondary">
      <span className="font-mono font-bold text-text-primary">{tcLabel(game.initial_ms, game.increment_ms)}</span> ·{' '}
      {game.rated ? t('online.rated') : t('online.casual')}
    </p>
  );

  if (isCreator) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm text-center">
          <Loader2 size={32} className="mx-auto mb-3 animate-spin text-accent" />
          <h1 className="text-xl font-black text-text-primary">{t('og.shareTitle')}</h1>
          <p className="text-sm text-text-secondary mb-4">{t('og.shareDesc')}</p>
          <div className="flex gap-2 mb-3">
            <input
              id="share-url"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 bg-bg-dark rounded-xl px-3 py-2.5 text-sm font-mono border border-gray-200"
            />
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t('og.copied') : t('og.copy')}
            </button>
          </div>
          {tcInfo}
          <p className="text-xs text-text-secondary mt-4">{t('og.waitingOpponent')}</p>
          <button onClick={onCancel} className="mt-4 text-sm font-semibold text-danger hover:underline">
            {t('og.cancelChallenge')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-5">
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm text-center w-full">
        <Swords size={32} className="mx-auto mb-3 text-accent" />
        <h1 className="text-xl font-black text-text-primary">{t('og.challengeFrom', { name: creatorName })}</h1>
        {creatorRating !== null && <p className="text-xs font-mono text-text-secondary mb-2">Elo {creatorRating}</p>}
        {tcInfo}
        <div className="flex items-center justify-center gap-2 my-4 text-sm text-text-primary">
          <img src={pieceSrc(myColor, 'k')} alt="" className="w-7 h-7" />
          {myColor === 'w' ? t('common.white') : t('common.black')}
        </div>
        {user ? (
          <button onClick={onJoin} className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl">
            {t('og.accept')}
          </button>
        ) : (
          <p className="text-sm text-text-secondary">{t('og.signInToAccept')}</p>
        )}
      </div>
      {!user && <AuthCard compact />}
    </div>
  );
};

export const OnlineGame = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const available = useOnlineAvailable();
  const { user, refreshProfile } = useAuth();
  const g = useOnlineGame(available ? id : undefined, user?.id);
  const [flipped, setFlipped] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const game = g.game;

  // Follow the rematch, refresh my rating at the end.
  useEffect(() => {
    if (game?.rematch_game) {
      setReviewing(false);
      setOverlay(true);
      setAnalysis(null);
      navigate(`/online/${game.rematch_game}`);
    }
  }, [game?.rematch_game, navigate]);
  const finished = game?.status === 'finished' || game?.status === 'aborted';
  useEffect(() => {
    if (finished && g.myColor) void refreshProfile();
  }, [finished, g.myColor, refreshProfile]);
  useEffect(() => {
    setOverlay(true);
    setFlipped(false);
  }, [id]);

  if (available === null) return <OnlineChecking />;
  if (!available) return <OnlineUnavailable />;
  if (g.notFound) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary mb-4">{t('og.notFound')}</p>
        <Link to="/online" className="text-accent font-bold">
          {t('og.backLobby')}
        </Link>
      </div>
    );
  }
  if (!game || !g.clocks) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-text-secondary">
        <Loader2 size={20} className="animate-spin" /> {t('og.loading')}
      </div>
    );
  }

  if (game.status === 'waiting') {
    return <Waiting game={game} isCreator={game.created_by === user?.id} onCancel={g.abort} onJoin={g.join} />;
  }
  if (game.status === 'aborted' && game.ply === 0 && game.reason === 'cancelled') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary mb-4">{t('og.challengeClosed')}</p>
        <Link to="/online" className="text-accent font-bold">
          {t('og.backLobby')}
        </Link>
      </div>
    );
  }

  const me = g.myColor;
  const bottom: Color = (me ?? 'w') === 'w' ? (flipped ? 'b' : 'w') : flipped ? 'w' : 'b';
  const top: Color = bottom === 'w' ? 'b' : 'w';
  const names = { w: game.white_name ?? '?', b: game.black_name ?? '?' };
  const opponentName = me ? names[me === 'w' ? 'b' : 'w'] : '';
  const lastUci = game.moves[game.moves.length - 1];
  const lastMove = lastUci ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) } : null;
  const active = game.status === 'active';
  const outcome = game.result && me ? outcomeFor(game.result, me) : null;
  const myDelta = me === 'w' ? game.white_delta : me === 'b' ? game.black_delta : null;
  const drawIn = active && game.draw_offer && me && game.draw_offer !== user?.id;
  const drawOut = active && game.draw_offer && game.draw_offer === user?.id;
  const rematchIn = finished && game.rematch_offer && me && game.rematch_offer !== user?.id;
  const rematchOut = finished && game.rematch_offer === user?.id;
  const firstSeconds = g.clocks.firstMove !== null ? Math.ceil(g.clocks.firstMove / 1000) : null;

  if (reviewing && finished && game.moves.length > 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-black text-text-primary">{t('og.reviewTitle')}</h1>
          <button
            onClick={() => setReviewing(false)}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-bg-card text-sm font-semibold hover:bg-bg-darker"
          >
            {t('review.back')}
          </button>
        </div>
        <GameReview
          startFen={game.start_fen}
          moves={g.played}
          orientation={me ?? 'w'}
          playerColor={me}
          whiteName={names.w}
          blackName={names.b}
          onAnalysed={setAnalysis}
          aside={
            me ? (
              <EloPanel
                startFen={game.start_fen}
                moves={g.played}
                analysis={analysis}
                color={me}
                source="game"
                initialSec={game.initial_ms / 1000}
              />
            ) : undefined
          }
        />
      </div>
    );
  }

  let status: string;
  if (game.status === 'finished') {
    status = `${game.result} · ${reasonText(t, game.reason)}`;
  } else if (game.status === 'aborted') {
    status = `${t('og.aborted')} · ${reasonText(t, game.reason)}`;
  } else if (firstSeconds !== null && g.turn) {
    status = g.turn === me ? t('og.firstMove', { s: firstSeconds }) : t('og.firstMoveThem', { s: firstSeconds });
  } else if (!me) {
    status = g.turn === 'w' ? t('og.whiteToPlay') : t('og.blackToPlay');
  } else {
    status = g.turn === me ? t('og.yourTurn') : t('og.theirTurn');
  }

  const btn = 'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 items-start">
        <div className="flex flex-col gap-2 w-full max-w-[min(100%,calc(100vh-170px))] lg:max-w-[min(640px,calc(100vh-170px))] mx-auto">
          <PlayerBar
            game={game}
            color={top}
            clock={g.clocks[top]}
            active={g.turn === top}
            online={g.isOnline(top === 'w' ? game.white_id : game.black_id)}
            isMe={me === top}
          />
          <div className="relative">
            <Board
              fen={game.fen}
              orientation={bottom}
              movable={active && me ? me : null}
              onMove={g.playMove}
              lastMove={lastMove}
            />
            {finished && overlay && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[1px] rounded-lg animate-fade-in p-4">
                <div className="relative bg-bg-card rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-xs text-center">
                  <button
                    onClick={() => setOverlay(false)}
                    aria-label={t('og.close')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-text-secondary hover:bg-bg-darker"
                  >
                    <X size={18} />
                  </button>
                  <div
                    className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                      outcome === 'win'
                        ? 'bg-green-100 text-green-600'
                        : outcome === 'loss'
                          ? 'bg-red-100 text-danger'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {outcome === 'win' ? <Trophy size={28} /> : outcome === 'loss' ? <Frown size={28} /> : <Handshake size={28} />}
                  </div>
                  <h2 className="text-xl font-black text-text-primary">
                    {game.status === 'aborted'
                      ? t('og.aborted')
                      : outcome === 'win'
                        ? t('result.win')
                        : outcome === 'loss'
                          ? t('result.loss')
                          : game.result === '1/2-1/2'
                            ? t('result.draw')
                            : game.result === '1-0'
                              ? t('og.whiteWins')
                              : t('og.blackWins')}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {game.result ? `${game.result} · ` : ''}
                    {reasonText(t, game.reason)}
                  </p>
                  {myDelta !== null && (
                    <p className={`text-sm font-bold font-mono mt-1 ${myDelta >= 0 ? 'text-emerald-700' : 'text-danger'}`}>
                      {t('og.ratingChange', { delta: myDelta >= 0 ? `+${myDelta}` : myDelta })}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    {me && rematchIn ? (
                      <div className="rounded-xl bg-accent/10 p-2">
                        <p className="text-sm font-bold text-text-primary mb-2">{t('og.rematchIn', { name: opponentName })}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={g.offerRematch} className="bg-accent hover:bg-accent-hover text-white font-bold py-2 rounded-lg text-sm">
                            {t('og.acceptDraw')}
                          </button>
                          <button onClick={g.declineRematch} className="bg-bg-darker hover:bg-gray-200 font-semibold py-2 rounded-lg text-sm">
                            {t('og.decline')}
                          </button>
                        </div>
                      </div>
                    ) : me ? (
                      <button
                        onClick={g.offerRematch}
                        disabled={!!rematchOut}
                        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-70 text-white font-bold py-3 rounded-xl"
                      >
                        {rematchOut ? <Loader2 size={18} className="animate-spin" /> : <Repeat size={18} />}
                        {rematchOut ? t('og.rematchSent') : t('og.rematch')}
                      </button>
                    ) : null}
                    {game.moves.length > 0 && (
                      <button
                        onClick={() => {
                          setAnalysis(null);
                          setReviewing(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-bg-darker hover:bg-gray-200 text-text-primary font-bold py-2.5 rounded-xl text-sm"
                      >
                        <LineChart size={18} /> {t('og.analyse')}
                      </button>
                    )}
                    <Link
                      to="/online"
                      className="w-full bg-bg-darker hover:bg-gray-200 text-text-primary font-semibold py-2.5 rounded-xl text-sm"
                    >
                      {t('og.newOpponent')}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <PlayerBar
            game={game}
            color={bottom}
            clock={g.clocks[bottom]}
            active={g.turn === bottom}
            online={g.isOnline(bottom === 'w' ? game.white_id : game.black_id)}
            isMe={me === bottom}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
              <span className="font-mono font-bold">
                {tcLabel(game.initial_ms, game.increment_ms)} · {game.rated ? t('online.rated') : t('online.casual')}
              </span>
              <span className="flex items-center gap-1">
                {g.live ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-amber-600" />}
                {g.live ? t('online.live') : t('online.reconnecting')}
              </span>
            </div>
            <p
              className={`text-center text-base font-bold rounded-xl py-3 mb-3 min-h-[48px] px-2 ${
                active && me && g.turn === me ? 'bg-accent text-white' : 'bg-bg-darker text-text-primary'
              }`}
            >
              {status}
            </p>
            {!me && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary mb-3">
                <Eye size={14} /> {t('og.spectating')}
              </p>
            )}
            {g.error && (
              <p className="text-xs text-danger bg-red-50 rounded-lg px-2 py-1.5 mb-3">
                {t(`og.err.${g.error}` as MessageKey) !== `og.err.${g.error}` ? t(`og.err.${g.error}` as MessageKey) : t('og.err.network')}
              </p>
            )}

            {drawIn && (
              <div className="rounded-xl bg-accent/10 border border-accent/30 p-3 mb-3">
                <p className="text-sm font-bold text-text-primary mb-2">{t('og.drawOfferIn', { name: opponentName })}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={g.offerDraw} className="bg-accent hover:bg-accent-hover text-white font-bold py-2 rounded-lg text-sm">
                    {t('og.acceptDraw')}
                  </button>
                  <button onClick={g.declineDraw} className="bg-bg-card hover:bg-bg-darker font-semibold py-2 rounded-lg text-sm border border-gray-200">
                    {t('og.decline')}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {me && active && game.ply < 2 ? (
                <button onClick={g.abort} className={`${btn} col-span-2 bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <X size={16} /> {t('og.abort')}
                </button>
              ) : me && active ? (
                <>
                  <button
                    onClick={g.offerDraw}
                    disabled={!!drawOut || !!drawIn}
                    className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}
                  >
                    <Handshake size={16} /> {drawOut ? t('og.drawOffered') : t('og.offerDraw')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('og.resignConfirm'))) void g.resign();
                    }}
                    className={`${btn} bg-red-50 hover:bg-red-100 text-danger`}
                  >
                    <Flag size={16} /> {t('og.resign')}
                  </button>
                </>
              ) : null}
              <button onClick={() => setFlipped((f) => !f)} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                <RefreshCw size={16} /> {t('og.flip')}
              </button>
              {finished ? (
                <button onClick={() => setOverlay(true)} className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  <Trophy size={16} /> {game.result ?? t('og.aborted')}
                </button>
              ) : (
                <Link to="/online" className={`${btn} bg-bg-darker hover:bg-gray-200 text-text-primary`}>
                  {t('og.backLobby')}
                </Link>
              )}
            </div>
          </div>

          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 px-1">{t('moves.title')}</p>
            <MoveList sans={game.sans} className="max-h-40 lg:max-h-[240px]" />
          </div>

          {me && user && <Chat messages={g.messages} me={user.id} onSend={(b) => void g.sendMessage(user.username, b)} />}
        </div>
      </div>
    </div>
  );
};
