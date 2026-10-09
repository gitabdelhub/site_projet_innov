import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { SignInGate, Notice, ErrorText, ShareBox, Spinner } from '../components/TogetherParts';
import { PUZZLES, type Puzzle } from '../data/puzzles';
import { buildStart } from './CoachTactics';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { duelAnswer, fetchDuel, joinDuel, normalizeCode, shareLink, type Duel } from '../lib/together';
import { soundEffects } from '../utils/soundEffects';
import { useI18n } from '../i18n/I18nProvider';

const POLL_MS = 1500;

// One puzzle of the duel: a single try, the first wrong move ends it
const DuelPuzzle: React.FC<{ puzzle: Puzzle; onDone: (solved: boolean) => void }> = ({ puzzle, onDone }) => {
  const { t } = useI18n();
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState('');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [locked, setLocked] = useState(false);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const start = buildStart(puzzle);
    chessRef.current = new Chess(start.fen);
    setFen(start.fen);
    setLastMove(start.lastMove);
    setStep(0);
    setLocked(false);
    setFlash(null);
    return () => timers.current.forEach(clearTimeout);
  }, [puzzle]);

  const player = fen ? new Chess(buildStart(puzzle).fen).turn() : 'w';

  const finish = (solved: boolean) => {
    setLocked(true);
    setFlash(solved ? 'right' : 'wrong');
    if (solved) soundEffects.playSuccess();
    else soundEffects.playError();
    timers.current.push(window.setTimeout(() => onDone(solved), 900));
  };

  const onSquareClick = (square: string) => {
    if (locked) return;
    const chess = chessRef.current;
    if (chess.turn() !== player) return;
    if (selected && possible.includes(square)) {
      const move = chess.move({ from: selected, to: square, promotion: 'q' });
      setFen(chess.fen());
      setLastMove({ from: move.from, to: move.to });
      setSelected(null);
      setPossible([]);
      const expected = puzzle.solution[step];
      const correct = move.san === expected || (expected.includes('#') && chess.isCheckmate());
      if (!correct) return finish(false);
      soundEffects.playMove();
      const next = step + 1;
      if (next >= puzzle.solution.length) return finish(true);
      setLocked(true);
      timers.current.push(window.setTimeout(() => {
        const reply = chess.move(puzzle.solution[next]);
        setFen(chess.fen());
        setLastMove({ from: reply.from, to: reply.to });
        setStep(next + 1);
        if (next + 1 >= puzzle.solution.length) finish(true);
        else setLocked(false);
      }, 450));
      return;
    }
    const piece = chess.get(square as never);
    if (piece && piece.color === player && square !== selected) {
      setSelected(square);
      setPossible(chess.moves({ square: square as never, verbose: true }).map((m) => m.to));
    } else {
      setSelected(null);
      setPossible([]);
    }
  };

  if (!fen) return null;
  return (
    <div className="w-full">
      <div className={`text-center text-sm font-bold mb-2 h-5 ${flash === 'right' ? 'text-green-600' : flash === 'wrong' ? 'text-red-500' : 'text-text-secondary'}`}>
        {flash === 'right' ? t('duel.right') : flash === 'wrong' ? t('duel.wrong') : t('common.toMove', { side: t(player === 'w' ? 'common.white' : 'common.black') })}
      </div>
      <ChessBoard
        gameState={{ fen, turn: chessRef.current.turn(), moves: [], status: 'playing', selectedSquare: selected, possibleMoves: possible, lastMove }}
        onSquareClick={onSquareClick}
        pendingPromotion={null}
        onPromoteSelect={() => {}}
        onPromoteCancel={() => {}}
        flipped={player === 'b'}
      />
    </div>
  );
};

export const DuelPage: React.FC = () => {
  const { t } = useI18n();
  const { code: raw = '' } = useParams();
  const code = normalizeCode(raw);
  return (
    <div className="min-h-screen bg-bg-dark py-6 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="puzzle" title={t('duel.title')} />
        <SignInGate>
          <DuelBody code={code} />
        </SignInGate>
      </div>
    </div>
  );
};

const DuelBody: React.FC<{ code: string }> = ({ code }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0); // database clock minus browser clock
  const sendingRef = useRef(false);
  const answeredAtRef = useRef(0); // a refresh started before this moment is out of date

  // Join, then follow the duel
  useEffect(() => {
    let active = true;
    let id: string | null = null;
    const sent = Date.now();
    supabase.rpc('server_now').then(({ data }) => {
      if (data) offsetRef.current = new Date(data as string).getTime() - (sent + Date.now()) / 2;
    });
    const refresh = async () => {
      if (!id || sendingRef.current) return;
      const askedAt = Date.now();
      const d = await fetchDuel(id);
      if (active && d && askedAt > answeredAtRef.current) setDuel(d);
    };
    joinDuel(code).then((res) => {
      if (!active) return;
      if (res.error !== undefined) return setError(res.error);
      id = res.data;
      refresh();
    });
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [code]);

  if (error) {
    return (
      <Notice icon="close" text={t(error as never)}>
        <Link to="/together" className="text-accent font-bold hover:underline">{t('together.backHub')}</Link>
      </Notice>
    );
  }
  if (!duel || !user) return <div className="text-center py-10"><Spinner /></div>;

  const host = duel.host_id === user.id;
  const me = host
    ? { name: duel.host_username, step: duel.host_step, score: duel.host_score, finished: duel.host_finished_at }
    : { name: duel.guest_username ?? '', step: duel.guest_step, score: duel.guest_score, finished: duel.guest_finished_at };
  const them = host
    ? { name: duel.guest_username, step: duel.guest_step, score: duel.guest_score, finished: duel.guest_finished_at }
    : { name: duel.host_username, step: duel.host_step, score: duel.host_score, finished: duel.host_finished_at };
  const total = duel.puzzle_ids.length;
  const serverNow = now + offsetRef.current;
  const startsIn = duel.started_at ? Math.ceil((new Date(duel.started_at).getTime() - serverNow) / 1000) : null;

  const answer = async (solved: boolean) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    // Show the answer at once, the server confirms on the next refresh
    setDuel((d) => d && (host
      ? { ...d, host_step: d.host_step + 1, host_score: d.host_score + Number(solved), host_finished_at: d.host_step + 1 === total ? new Date().toISOString() : null }
      : { ...d, guest_step: d.guest_step + 1, guest_score: d.guest_score + Number(solved), guest_finished_at: d.guest_step + 1 === total ? new Date().toISOString() : null }));
    answeredAtRef.current = Date.now();
    const res = await duelAnswer(duel.id, me.step, solved);
    answeredAtRef.current = Date.now();
    sendingRef.current = false;
    if (res.error !== undefined) setError(res.error);
  };

  const Score: React.FC<{ who: typeof me; label: string; mine?: boolean }> = ({ who, label, mine }) => (
    <div className={`bg-bg-card border rounded-2xl p-4 ${mine ? 'border-accent/40' : 'border-gray-200/80'}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="font-bold text-text-primary truncate">{who.name || '…'}</div>
      <div className="flex items-end justify-between mt-2">
        <span className="text-3xl font-extrabold text-accent">{who.score}</span>
        <span className="text-xs text-text-secondary font-semibold">{t('duel.progress', { done: who.step, total })}</span>
      </div>
      <div className="flex gap-1 mt-2">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < who.step ? 'bg-accent' : 'bg-bg-darker'}`} />
        ))}
      </div>
    </div>
  );

  // Waiting for the friend
  if (duel.status === 'waiting') {
    return (
      <div className="max-w-xl mx-auto bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <p className="text-sm text-text-primary text-center">{t('duel.share', { n: total })}</p>
        <ShareBox code={duel.code} link={shareLink(`/duel/${duel.code}`)} />
        <p className="text-sm font-semibold text-text-primary text-center inline-flex items-center justify-center gap-2 w-full">
          <Spinner /> {t('together.waitingFriend')}
        </p>
      </div>
    );
  }

  const bothDone = duel.status === 'finished' || (me.step >= total && them.step >= total);
  const scores = (
    <div className="grid grid-cols-2 gap-3">
      <Score who={me} label={t('duel.you')} mine />
      <Score who={them as typeof me} label={t('duel.opponent')} />
    </div>
  );

  if (bothDone) {
    const myTime = me.finished ? new Date(me.finished).getTime() : Infinity;
    const theirTime = them.finished ? new Date(them.finished).getTime() : Infinity;
    const won = me.score > them.score || (me.score === them.score && myTime < theirTime);
    const draw = me.score === them.score && myTime === theirTime;
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm text-center">
          <span className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-2 ${won ? 'bg-green-500/10 text-green-700' : 'bg-bg-darker text-text-secondary'}`}>
            <Icon name={won ? 'trophy' : 'flag'} className="w-6 h-6" />
          </span>
          <h2 className="text-2xl font-extrabold text-text-primary">{draw ? t('duel.draw') : won ? t('duel.won') : t('duel.lost')}</h2>
          {me.score === them.score && !draw && <p className="text-sm text-text-secondary mt-1">{t('duel.tieBreak')}</p>}
        </div>
        {scores}
        <Link to="/together" className="block text-center text-accent font-bold hover:underline">{t('duel.again')}</Link>
      </div>
    );
  }

  if (startsIn !== null && startsIn > 0) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 shadow-sm text-center">
          <p className="text-sm text-text-secondary mb-2">{t('duel.startsIn')}</p>
          <div className="text-6xl font-extrabold text-accent">{startsIn}</div>
          <p className="text-xs text-text-secondary mt-3">{t('duel.rules', { n: total })}</p>
        </div>
        {scores}
      </div>
    );
  }

  const puzzle = me.step < total ? PUZZLES.find((p) => p.id === duel.puzzle_ids[me.step]) : undefined;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
      <div className="lg:col-span-7 order-2 lg:order-1">
        {puzzle ? (
          <DuelPuzzle key={`${me.step}-${puzzle.id}`} puzzle={puzzle} onDone={answer} />
        ) : me.step < total ? (
          // Unknown puzzle id (older version of the site): count it as missed
          <Notice icon="close" text={t('together.errGeneric')}><button onClick={() => answer(false)} className="text-accent font-bold">{t('common.next')}</button></Notice>
        ) : (
          <Notice icon="clock" text={t('duel.waitingOpponent', { name: them.name ?? '' })} />
        )}
      </div>
      <div className="lg:col-span-5 space-y-3 order-1 lg:order-2">
        {scores}
        <ErrorText error={error} />
        <p className="text-xs text-text-secondary">{t('duel.rules', { n: total })}</p>
      </div>
    </div>
  );
};
