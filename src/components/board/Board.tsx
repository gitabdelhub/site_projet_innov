import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Chess, type Square as Sq } from 'chess.js';
import type { Color } from '../../lib/chessGame';
import { useI18n } from '../../i18n';

export interface Arrow {
  from: string;
  to: string;
  color?: string;
}

export interface SquareMark {
  square: string;
  /** Short text shown in a badge on the top right of the square (e.g. "??"). */
  badge: string;
  color: string;
}

interface BoardProps {
  fen: string;
  orientation?: Color;
  /** Which side the user can move. null = read only board. */
  movable?: Color | 'both' | null;
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  mark?: SquareMark | null;
  className?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const pieceSrc = (color: string, type: string) => `/pieces/${color}${type.toUpperCase()}.svg`;

export const Board = ({
  fen,
  orientation = 'w',
  movable = null,
  onMove,
  lastMove,
  arrows = [],
  mark,
  className = '',
}: BoardProps) => {
  const { t } = useI18n();
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; moved: boolean; wasSelected: boolean } | null>(
    null,
  );
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [lastFen, setLastFen] = useState(fen);

  // Reset local selection whenever the position changes from outside.
  if (lastFen !== fen) {
    setLastFen(fen);
    setSelected(null);
    setDrag(null);
    setPromotion(null);
  }

  const turn = chess.turn();
  const canMoveColor = (c: Color) => !!onMove && (movable === 'both' || movable === c) && c === turn;
  const gameOver = chess.isGameOver();

  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(chess.moves({ square: selected as Sq, verbose: true }).map((m) => m.to));
  }, [selected, chess]);

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'w' ? FILES : [...FILES].reverse();

  const squareAt = (clientX: number, clientY: number): string | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return `${files[col]}${ranks[row]}`;
  };

  const tryMove = (from: string, to: string) => {
    setSelected(null);
    const piece = chess.get(from as Sq);
    if (!piece || !onMove) return;
    const isPromotion = piece.type === 'p' && (to[1] === '8' || to[1] === '1');
    if (isPromotion) {
      setPromotion({ from, to });
      return;
    }
    onMove(from, to);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (promotion || gameOver || e.button > 0) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    const piece = chess.get(sq as Sq);
    if (selected && targets.has(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (piece && canMoveColor(piece.color)) {
      boardRef.current?.setPointerCapture(e.pointerId);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false, wasSelected: selected === sq });
      setSelected(sq);
      return;
    }
    setSelected(null);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (drag.moved) {
      if (sq && sq !== drag.from && targets.has(sq)) tryMove(drag.from, sq);
    } else if (drag.wasSelected) {
      setSelected(null);
    }
    setDrag(null);
  };

  const rect = boardRef.current?.getBoundingClientRect();
  const sqSize = rect ? rect.width / 8 : 0;
  const board = chess.board();
  const inCheck = chess.inCheck();

  const squareCenter = (sq: string) => {
    const col = files.indexOf(sq[0]);
    const row = ranks.indexOf(Number(sq[1]));
    return { x: col + 0.5, y: row + 0.5 };
  };

  return (
    <div
      ref={boardRef}
      className={`relative aspect-square w-full select-none touch-none rounded-lg overflow-hidden shadow-xl border-4 border-bg-darker ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      role="grid"
      aria-label={t('board.label')}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank, r) =>
          files.map((file, c) => {
            const sq = `${file}${rank}`;
            const piece = board[8 - rank][file.charCodeAt(0) - 97];
            const light = (file.charCodeAt(0) - 97 + rank) % 2 === 1;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isSel = selected === sq;
            const isTarget = targets.has(sq);
            const isCheckedKing = inCheck && piece?.type === 'k' && piece.color === turn;
            const dragging = drag?.moved && drag.from === sq;
            return (
              <div
                key={sq}
                data-square={sq}
                className={`relative ${light ? 'bg-board-light' : 'bg-board-dark'} ${
                  piece && canMoveColor(piece.color) ? 'cursor-grab' : ''
                }`}
              >
                {isLast && <div className="absolute inset-0 bg-board-highlight" />}
                {isSel && <div className="absolute inset-0 bg-board-selected" />}
                {isCheckedKing && <div className="absolute inset-0 radial-check" />}
                {piece && (
                  <img
                    src={pieceSrc(piece.color, piece.type)}
                    alt={`${piece.color}${piece.type}`}
                    draggable={false}
                    className={`absolute inset-0 w-full h-full p-[4%] pointer-events-none ${
                      dragging ? 'opacity-30' : ''
                    }`}
                  />
                )}
                {isTarget && !piece && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[30%] h-[30%] rounded-full bg-black/20" />
                  </div>
                )}
                {isTarget && piece && (
                  <div className="absolute inset-[3%] rounded-full border-[5px] border-black/20 pointer-events-none" />
                )}
                {c === 0 && (
                  <span
                    className={`absolute top-0.5 left-1 text-[9px] sm:text-[10px] font-bold ${
                      light ? 'text-board-dark' : 'text-board-light'
                    }`}
                  >
                    {rank}
                  </span>
                )}
                {r === 7 && (
                  <span
                    className={`absolute bottom-0 right-1 text-[9px] sm:text-[10px] font-bold ${
                      light ? 'text-board-dark' : 'text-board-light'
                    }`}
                  >
                    {file}
                  </span>
                )}
                {mark && mark.square === sq && (
                  <span
                    className="absolute -top-0 right-0 z-10 translate-x-[15%] -translate-y-[15%] min-w-[38%] h-[38%] px-1 rounded-full text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-md border-2 border-white"
                    style={{ background: mark.color }}
                  >
                    {mark.badge}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {arrows.length > 0 && (
        <svg viewBox="0 0 8 8" className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            {arrows.map((a, i) => (
              <marker
                key={i}
                id={`ah-${i}`}
                markerWidth="4"
                markerHeight="4"
                refX="2.2"
                refY="2"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L4,2 L0,4 z" fill={a.color ?? '#15803d'} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const p1 = squareCenter(a.from);
            const p2 = squareCenter(a.to);
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const k = (len - 0.35) / len;
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p1.x + (p2.x - p1.x) * k}
                y2={p1.y + (p2.y - p1.y) * k}
                stroke={a.color ?? '#15803d'}
                strokeOpacity={0.8}
                strokeWidth={0.16}
                strokeLinecap="round"
                markerEnd={`url(#ah-${i})`}
              />
            );
          })}
        </svg>
      )}

      {drag?.moved && rect && (
        <img
          src={pieceSrc(chess.get(drag.from as Sq)?.color ?? 'w', chess.get(drag.from as Sq)?.type ?? 'p')}
          alt=""
          draggable={false}
          className="absolute pointer-events-none z-20 drop-shadow-lg"
          style={{
            width: sqSize * 1.1,
            height: sqSize * 1.1,
            left: drag.x - rect.left - (sqSize * 1.1) / 2,
            top: drag.y - rect.top - (sqSize * 1.1) / 2,
          }}
        />
      )}

      {promotion && (
        <div
          className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] flex items-center justify-center animate-fade-in"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-bg-card rounded-xl shadow-2xl p-4 text-center">
            <p className="text-sm font-bold text-text-primary mb-3">{t('board.promote')}</p>
            <div className="flex gap-2">
              {['q', 'r', 'b', 'n'].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const { from, to } = promotion;
                    setPromotion(null);
                    onMove?.(from, to, p);
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-bg-darker hover:bg-accent/15 border border-gray-200 hover:border-accent transition-colors"
                  aria-label={p}
                >
                  <img src={pieceSrc(turn, p)} alt="" className="w-full h-full p-1" draggable={false} />
                </button>
              ))}
            </div>
            <button
              onClick={() => setPromotion(null)}
              className="mt-3 text-xs text-text-secondary hover:text-text-primary underline"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
