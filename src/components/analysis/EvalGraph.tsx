import { winPercent } from '../../engine/engine';
import { CLASS_COLORS, type GameAnalysis } from '../../engine/analysis';

interface EvalGraphProps {
  analysis: GameAnalysis;
  index: number; // current ply (0 = start)
  onSelect: (index: number) => void;
}

/** Winning chances curve over the game. Click to jump to a move. */
export const EvalGraph = ({ analysis, index, onSelect }: EvalGraphProps) => {
  const n = analysis.positions.length;
  const W = 600;
  const H = 90;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (cp: number) => H - (winPercent(cp) / 100) * H;
  const pts = analysis.positions.map((p, i) => `${x(i).toFixed(1)},${y(p.cp).toFixed(1)}`).join(' ');
  const area = `0,${H} ${pts} ${W},${H}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20 rounded-lg bg-[#262626] cursor-pointer"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        onSelect(Math.round(ratio * (n - 1)));
      }}
      role="img"
    >
      <polygon points={area} fill="#ffffff" opacity={0.92} />
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 4" />
      {analysis.moves
        .filter((m) => m.cls === 'mistake' || m.cls === 'blunder')
        .map((m) => (
          <circle
            key={m.ply}
            cx={x(m.ply)}
            cy={y(m.cpAfter)}
            r={4}
            fill={CLASS_COLORS[m.cls]}
            stroke="#fff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      <line x1={x(index)} x2={x(index)} y1={0} y2={H} stroke="#3273f5" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
