import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { evaluatePositions, formatEval } from '../lib/analysis';
import { describeMove } from '../lib/explain';
import { useI18n } from '../i18n/I18nProvider';
import { localSan } from '../i18n/san';
import { Icon } from './Icon';

// "Ask the coach": Stockfish's move in the current position, with the evaluation
// and a plain-words explanation. Used in training games and in the study room.
export const CoachHint: React.FC<{ fen: string; disabled?: boolean }> = ({ fen, disabled = false }) => {
  const { t, lang } = useI18n();
  const [hint, setHint] = useState<{ fen: string; san: string; score: number; why: string[] } | null>(null);
  const [thinking, setThinking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // A hint only applies to the position it was asked for
  useEffect(() => {
    cancelRef.current?.();
    setThinking(false);
    setHint((h) => (h && h.fen === fen ? h : null));
  }, [fen]);
  useEffect(() => () => cancelRef.current?.(), []);

  const ask = () => {
    let over = false;
    try {
      over = new Chess(fen).isGameOver();
    } catch {
      return;
    }
    if (over) return;
    setThinking(true);
    const job = evaluatePositions([fen]);
    cancelRef.current = job.cancel;
    job.promise.then(([score]) => {
      cancelRef.current = null;
      setThinking(false);
      const uci = job.bestMoves[0];
      if (score === undefined || !uci) return;
      try {
        const san = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
        setHint({ fen, san, score, why: describeMove(fen, san, t) });
      } catch {
        // position changed meanwhile
      }
    });
  };

  return (
    <div className="bg-bg-card border border-gray-200/80 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
          <Icon name="bulb" className="w-4 h-4 text-accent" /> {t('hint.title')}
        </span>
        <button
          onClick={ask}
          disabled={disabled || thinking}
          className="text-xs font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          {thinking ? t('hint.thinking') : t('hint.ask')}
        </button>
      </div>
      {hint && (
        <p className="text-xs text-text-primary leading-relaxed">
          <span className="font-bold text-green-700">{t('hint.suggests', { move: localSan(hint.san, lang) })}</span>{' '}
          <span className="font-mono text-text-secondary">({formatEval(hint.score)})</span> {hint.why.join(' ')}
        </p>
      )}
    </div>
  );
};
