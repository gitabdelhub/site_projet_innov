import { useEffect, useRef } from 'react';
import { CLASS_COLORS, CLASS_BADGE, type MoveClass } from '../../engine/analysis';
import { useI18n } from '../../i18n';

interface MoveListProps {
  sans: string[];
  /** Index of the highlighted ply (1-based), 0 = start position. */
  current?: number;
  onSelect?: (ply: number) => void;
  classes?: (MoveClass | undefined)[];
  /** Number of the first move (for positions that start with Black to move, use startsWithBlack). */
  startsWithBlack?: boolean;
  className?: string;
}

export const MoveList = ({ sans, current, onSelect, classes, startsWithBlack, className = '' }: MoveListProps) => {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector('[data-current="true"]') as HTMLElement | null;
    if (el && ref.current) {
      const box = ref.current;
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 32) box.scrollTop = top - box.clientHeight / 2;
    } else if (ref.current && current === undefined) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [current, sans.length]);

  const plies = startsWithBlack ? [null, ...sans] : sans;
  const rows: { n: number; w: number | null; b: number | null }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    const wIdx = plies[i] === null ? null : startsWithBlack ? i : i + 1;
    const bIdx = i + 1 < plies.length ? (startsWithBlack ? i + 1 : i + 2) : null;
    rows.push({ n: i / 2 + 1, w: wIdx, b: bIdx });
  }

  const cell = (ply: number | null) => {
    if (ply === null) return <span className="flex-1 text-text-secondary">...</span>;
    const cls = classes?.[ply - 1];
    const active = current === ply;
    const showBadge = cls && cls !== 'good' && cls !== 'best';
    return (
      <button
        type="button"
        data-current={active}
        onClick={() => onSelect?.(ply)}
        disabled={!onSelect}
        className={`flex-1 text-left px-2 py-1 rounded-md font-mono font-semibold text-sm transition-colors flex items-center gap-1 ${
          active ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent/10'
        } ${onSelect ? '' : 'cursor-default'}`}
      >
        {sans[ply - 1]}
        {showBadge && (
          <span className="text-[11px] font-black" style={{ color: active ? '#fff' : CLASS_COLORS[cls] }}>
            {CLASS_BADGE[cls]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div ref={ref} className={`overflow-y-auto custom-scrollbar pr-1 ${className}`}>
      {rows.length === 0 ? (
        <p className="text-text-secondary text-sm italic text-center py-6">{t('moves.none')}</p>
      ) : (
        rows.map((r, idx) => (
          <div key={r.n} className={`flex items-center gap-1 px-1 py-0.5 rounded ${idx % 2 === 0 ? 'bg-bg-darker/60' : ''}`}>
            <span className="w-8 text-text-secondary text-xs font-semibold font-mono">{r.n}.</span>
            {cell(r.w)}
            {r.b !== null ? cell(r.b) : <span className="flex-1" />}
          </div>
        ))
      )}
    </div>
  );
};
