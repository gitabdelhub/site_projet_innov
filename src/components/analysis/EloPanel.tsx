import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Puzzle, Swords, Loader2, Info } from 'lucide-react';
import type { GameAnalysis } from '../../engine/analysis';
import { predictElo, type EloPrediction } from '../../elo/predict';
import type { Color, PlayedMove } from '../../lib/chessGame';
import { addPrediction, patchGame } from '../../lib/storage';
import { useI18n } from '../../i18n';

interface EloPanelProps {
  startFen: string;
  moves: PlayedMove[];
  analysis: GameAnalysis | null;
  color: Color;
  source: 'game' | 'pgn';
  /** Id of the saved game to attach the prediction to. */
  gameId?: string;
  headers?: Record<string, string>;
  name?: string;
}

const saved = new Set<string>();

export const EloPanel = ({ startFen, moves, analysis, color, source, gameId, headers, name }: EloPanelProps) => {
  const { t } = useI18n();
  const [pred, setPred] = useState<EloPrediction | null>(null);

  useEffect(() => {
    if (!analysis) return;
    let alive = true;
    setPred(null);
    predictElo({ startFen, moves, analysis, color, headers }).then((p) => {
      if (!alive) return;
      setPred(p);
      const key = `${color}|${moves.map((m) => m.uci).join(' ')}`;
      if (!saved.has(key)) {
        saved.add(key);
        addPrediction({ date: new Date().toISOString(), elo: p.elo, source, method: p.method });
        if (gameId) {
          const s = color === 'w' ? analysis.white : analysis.black;
          patchGame(gameId, { predictedElo: p.elo, accuracy: s.accuracy });
        }
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, color]);

  const tooShort = moves.filter((m) => m.color === color).length < 10;

  return (
    <div className="bg-gradient-to-br from-accent/10 to-bg-card border border-accent/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center">
          <Brain size={18} />
        </div>
        <p className="text-sm font-bold text-text-primary">
          {pred?.method === 'estimate' ? t('elo.titleEstimate') : t('elo.title')}
          {name ? <span className="font-normal text-text-secondary"> · {name}</span> : null}
        </p>
      </div>

      {!pred ? (
        <p className="flex items-center gap-2 text-sm text-text-secondary py-3">
          <Loader2 size={16} className="animate-spin" />
          {analysis ? t('elo.predicting') : t('elo.waitAnalysis')}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-accent">{pred.elo}</span>
            <span className="text-sm text-text-secondary">± {pred.margin}</span>
          </div>
          <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5 mb-3">
            <Info size={12} />
            {t(`elo.method.${pred.method}`)}
            {tooShort && ` · ${t('elo.shortGame')}`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/coach/puzzles?elo=${pred.elo}`}
              className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold py-2.5 rounded-lg"
            >
              <Puzzle size={16} /> {t('elo.trainCta')}
            </Link>
            <Link
              to="/game"
              className="flex items-center justify-center gap-1.5 bg-bg-card border border-gray-200 hover:bg-bg-darker text-text-primary text-sm font-semibold py-2.5 rounded-lg"
            >
              <Swords size={16} /> {t('elo.playCta')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
