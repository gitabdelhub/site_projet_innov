import React from 'react';

// Tiny progress curve (no axes): enough to see whether a number goes up or down
export const Sparkline: React.FC<{ values: number[]; className?: string; label?: string }> = ({ values, className = 'w-full h-10', label }) => {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} role="img" aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? '#16a34a' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
