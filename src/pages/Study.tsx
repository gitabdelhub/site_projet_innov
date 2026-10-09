import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { CoachHint } from '../components/CoachHint';
import { SignInGate, Notice, ErrorText, ShareBox, Spinner } from '../components/TogetherParts';
import { supabase } from '../lib/supabase';
import { fetchStudy, fetchStudyMembers, joinStudy, normalizeCode, shareLink, studyUpdate, type StudyRoom } from '../lib/together';
import { soundEffects } from '../utils/soundEffects';
import { useI18n } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';

const POLL_MS = 4000; // safety net if the live connection drops

// Position after the first `cursor` moves of the room
const positionOf = (room: StudyRoom, cursor = room.cursor) => {
  const chess = new Chess(room.start_fen);
  for (const san of room.moves.slice(0, cursor)) {
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return chess;
};

export const StudyPage: React.FC = () => {
  const { t } = useI18n();
  const { code: raw = '' } = useParams();
  const code = normalizeCode(raw);
  return (
    <div className="min-h-screen bg-bg-dark py-6 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <PageHeader icon="book" title={t('study.title')} subtitle={t('study.subtitle')} />
        <SignInGate>
          <StudyBody code={code} />
        </SignInGate>
      </div>
    </div>
  );
};

const StudyBody: React.FC<{ code: string }> = ({ code }) => {
  const { t, lang } = useI18n();
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const roomRef = useRef<StudyRoom | null>(null);
  const [members, setMembers] = useState<{ username: string; last_seen: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Keep only newer versions (live updates, polling and our own writes can cross)
  const accept = (next: StudyRoom | null) => {
    if (!next) return;
    if (roomRef.current && next.version < roomRef.current.version) return;
    if (roomRef.current && next.version > roomRef.current.version && next.moves.length > roomRef.current.moves.length) soundEffects.playMove();
    roomRef.current = next;
    setRoom(next);
  };

  useEffect(() => {
    let active = true;
    roomRef.current = null;
    joinStudy(code).then(async (res) => {
      if (!active) return;
      if (res.error !== undefined) return setError(res.error);
      accept(await fetchStudy(code));
      setMembers(await fetchStudyMembers(code));
    });
    const channel = supabase
      .channel(`study-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'study_rooms', filter: `code=eq.${code}` }, (payload) => {
        if (active) accept(payload.new as StudyRoom);
      })
      .subscribe();
    const poll = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      accept(await fetchStudy(code));
    }, POLL_MS);
    const who = setInterval(async () => setMembers(await fetchStudyMembers(code)), 15_000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(who);
      supabase.removeChannel(channel);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const chess = useMemo(() => (room ? positionOf(room) : null), [room]);

  // Change the shared board: shown at once, then saved; on a clash, take the server's version
  const push = async (moves: string[], cursor: number) => {
    const current = roomRef.current;
    if (!current) return;
    const optimistic = { ...current, moves, cursor, version: current.version + 1 };
    roomRef.current = optimistic;
    setRoom(optimistic);
    const res = await studyUpdate(code, moves, cursor, current.version);
    if (res.error !== undefined) setError(res.error);
    if (res.error !== undefined || res.data === -1) {
      roomRef.current = null;
      accept(await fetchStudy(code));
    }
  };

  if (error && !room) {
    return (
      <Notice icon="close" text={t(error as never)}>
        <Link to="/together" className="text-accent font-bold hover:underline">{t('together.backHub')}</Link>
      </Notice>
    );
  }
  if (!room || !chess) return <div className="text-center py-10"><Spinner /></div>;

  const onSquareClick = (square: string) => {
    if (selected && possible.includes(square)) {
      const move = chess.move({ from: selected, to: square, promotion: 'q' });
      setSelected(null);
      setPossible([]);
      soundEffects.playMove();
      // Playing the move that comes next in the line just steps forward
      if (room.moves[room.cursor] === move.san) push(room.moves, room.cursor + 1);
      else push([...room.moves.slice(0, room.cursor), move.san], room.cursor + 1);
      return;
    }
    const piece = chess.get(square as never);
    if (piece && piece.color === chess.turn() && square !== selected) {
      setSelected(square);
      setPossible(chess.moves({ square: square as never, verbose: true }).map((m) => m.to));
    } else {
      setSelected(null);
      setPossible([]);
    }
  };

  const goTo = (cursor: number) => push(room.moves, Math.max(0, Math.min(room.moves.length, cursor)));
  const history = positionOf(room, room.moves.length).history({ verbose: true });
  const last = room.cursor > 0 ? history[room.cursor - 1] : null;
  const btn = 'w-9 h-9 bg-bg-dark hover:bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center text-text-primary disabled:opacity-40 transition-colors';
  const startMove = parseInt(room.start_fen.split(' ')[5], 10) || 1;
  const startsWhite = room.start_fen.split(' ')[1] === 'w';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
      <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
        <div className="game-board-container flex flex-col items-center w-full">
          <ChessBoard
            gameState={{ fen: chess.fen(), turn: chess.turn(), moves: [], status: 'playing', selectedSquare: selected, possibleMoves: possible, lastMove: last ? { from: last.from, to: last.to } : null }}
            onSquareClick={onSquareClick}
            pendingPromotion={null}
            onPromoteSelect={() => {}}
            onPromoteCancel={() => {}}
            flipped={flipped}
          />
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <button onClick={() => goTo(0)} disabled={room.cursor === 0} className={btn} aria-label={t('review.first')}><Icon name="skipBack" className="w-4 h-4" /></button>
            <button onClick={() => goTo(room.cursor - 1)} disabled={room.cursor === 0} className={btn} aria-label={t('review.prev')}><Icon name="stepBack" className="w-4 h-4" /></button>
            <button onClick={() => goTo(room.cursor + 1)} disabled={room.cursor >= room.moves.length} className={btn} aria-label={t('review.next')}><Icon name="stepForward" className="w-4 h-4" /></button>
            <button onClick={() => goTo(room.moves.length)} disabled={room.cursor >= room.moves.length} className={btn} aria-label={t('review.last')}><Icon name="skipForward" className="w-4 h-4" /></button>
            <button onClick={() => setFlipped((f) => !f)} className={btn} aria-label={t('study.flip')} title={t('study.flip')}><Icon name="refresh" className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-3 order-1 lg:order-2">
        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('together.code')}</div>
              <div className="font-mono text-xl font-extrabold tracking-[0.2em] text-text-primary">{room.code}</div>
            </div>
            <button onClick={() => setShowShare((s) => !s)} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline">
              <Icon name="link" className="w-4 h-4" /> {t('study.invite')}
            </button>
          </div>
          {showShare && <ShareBox code={room.code} link={shareLink(`/study/${room.code}`)} />}
          <div className="flex flex-wrap items-center gap-1.5">
            <Icon name="users" className="w-4 h-4 text-text-secondary" />
            {members.map((m) => (
              <span key={m.username} className="text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">{m.username}</span>
            ))}
          </div>
          {room.updated_by && room.version > 0 && <p className="text-[11px] text-text-secondary">{t('study.lastBy', { name: room.updated_by })}</p>}
          <p className="text-xs text-text-secondary">{t('study.howTo')}</p>
          <ErrorText error={error} />
        </div>

        <CoachHint fen={chess.fen()} />

        <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-bold text-text-primary">{t('study.moves')}</h2>
            {room.moves.length > 0 && (
              <button onClick={() => push([], 0)} className="text-[11px] font-bold text-text-secondary hover:text-red-600">{t('study.clear')}</button>
            )}
          </div>
          {room.moves.length === 0 ? (
            <p className="text-xs text-text-secondary px-1 pb-1">{t('study.empty')}</p>
          ) : (
            <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-wrap gap-1 text-xs font-mono">
              {room.moves.map((san, i) => {
                const ply = i + (startsWhite ? 0 : 1);
                const number = startMove + Math.floor(ply / 2);
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i + 1)}
                    className={`px-1.5 py-1 rounded font-semibold transition-colors ${
                      room.cursor === i + 1 ? 'bg-accent text-white' : i < room.cursor ? 'text-text-primary hover:bg-bg-darker' : 'text-text-secondary hover:bg-bg-darker'
                    }`}
                  >
                    {ply % 2 === 0 ? `${number}. ` : i === 0 ? `${number}… ` : ''}{localSan(san, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
