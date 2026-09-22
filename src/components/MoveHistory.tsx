import React, { useRef, useEffect } from 'react';
import type { Move } from '../types/chess';

interface MoveHistoryProps {
  moves: Move[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const movePairs: { white: Move | null; black: Move | null; number: number }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i] || null,
      black: moves[i + 1] || null,
    });
  }

  // Scroll to bottom when moves list changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1" ref={containerRef}>
      <div className="space-y-0.5">
        {movePairs.map((pair, idx) => (
          <div
            key={pair.number}
            className={`flex items-center py-1.5 px-3 text-sm rounded ${
              idx % 2 === 0 ? 'bg-bg-darker/50' : 'bg-transparent'
            }`}
          >
            <span className="w-10 text-text-secondary font-semibold font-mono">{pair.number}.</span>
            <span className="flex-1 text-text-primary font-semibold font-mono hover:text-accent cursor-pointer transition-colors">
              {pair.white?.san || ''}
            </span>
            <span className="flex-1 text-text-primary font-semibold font-mono hover:text-accent cursor-pointer transition-colors">
              {pair.black?.san || ''}
            </span>
          </div>
        ))}
        {moves.length === 0 && (
          <p className="text-text-secondary text-sm italic text-center py-8">No moves yet</p>
        )}
      </div>
    </div>
  );
};
