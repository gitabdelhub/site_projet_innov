import { formatScore, winPercent, type Score } from '../../engine/engine';
import type { Color } from '../../lib/chessGame';

interface EvalBarProps {
  score: Score | null;
  cp: number; // White POV
  orientation?: Color;
  loading?: boolean;
}

/** Vertical evaluation bar. White's share grows from the bottom when White is at the bottom. */
export const EvalBar = ({ score, cp, orientation = 'w', loading }: EvalBarProps) => {
  const white = winPercent(cp);
  const label = formatScore(score);
  const whiteAhead = cp >= 0;
  return (
    <div
      className={`relative w-3 sm:w-6 self-stretch shrink-0 rounded-md overflow-hidden border border-gray-300 bg-[#262626] flex ${
        orientation === 'w' ? 'flex-col-reverse' : 'flex-col'
      } ${loading ? 'opacity-60' : ''}`}
      aria-label={label}
    >
      <div className="w-full bg-white transition-all duration-500 ease-out" style={{ height: `${white}%` }} />
      <span
        className={`hidden sm:block absolute left-0 right-0 text-center text-[9px] font-bold ${
          whiteAhead === (orientation === 'w') ? 'bottom-1' : 'top-1'
        } ${whiteAhead ? 'text-gray-800' : 'text-white'}`}
      >
        {label.replace('+', '')}
      </span>
    </div>
  );
};
