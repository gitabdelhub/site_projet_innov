/**
 * Elo prediction for one side of a game.
 *
 * Order of attempts:
 *  1. our ML model running in the browser (no network needed)
 *  2. the Flask API (VITE_API_URL), same model on the server
 *  3. a local estimate from the Stockfish analysis, clearly labelled as such
 *
 * The feature vector is built in ./features.ts, which must match the training
 * notebook EXACTLY (names and order).
 */
import type { GameAnalysis } from '../engine/analysis';
import type { Color, PlayedMove } from '../lib/chessGame';
import { buildFeatures, FEATURES_READY } from './features';
import { browserModel } from './model';

export type PredictionMethod = 'model-browser' | 'model-api' | 'estimate';

export interface EloPrediction {
  elo: number;
  method: PredictionMethod;
  /** Rough uncertainty, shown as "± x". */
  margin: number;
}

export interface PredictInput {
  startFen: string;
  moves: PlayedMove[];
  analysis: GameAnalysis;
  color: Color;
  headers?: Record<string, string>;
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const clampElo = (x: number) => Math.round(Math.max(400, Math.min(2800, x)));

/**
 * Fallback estimate from accuracy and average centipawn loss.
 * Simple monotonic curve: it is NOT our model and is labelled "estimate" in the UI.
 */
export const estimateFromAnalysis = (analysis: GameAnalysis, color: Color): number => {
  const s = color === 'w' ? analysis.white : analysis.black;
  if (s.moves === 0) return 1200;
  const fromAcpl = 3000 * Math.exp(-0.0105 * Math.max(5, s.acpl)) + 300;
  const fromAccuracy = 400 + Math.max(0, s.accuracy - 40) * 38;
  return clampElo(0.5 * fromAcpl + 0.5 * fromAccuracy - s.blunder * 25);
};

const fetchWithTimeout = async (url: string, init: RequestInit, ms: number) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
};

export const predictElo = async (input: PredictInput): Promise<EloPrediction> => {
  if (FEATURES_READY) {
    const features = buildFeatures(input);

    // 1. Model in the browser.
    try {
      const model = await browserModel();
      if (model) return { elo: clampElo(await model.predict(features)), method: 'model-browser', margin: model.margin };
    } catch (e) {
      console.warn('Browser model failed, trying the API', e);
    }

    // 2. Flask API.
    if (API_URL) {
      try {
        const res = await fetchWithTimeout(
          `${API_URL}/api/predict-elo`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features }) },
          6000,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.method === 'ml_model' && Number.isFinite(data.predicted_elo)) {
            return { elo: clampElo(data.predicted_elo), method: 'model-api', margin: 200 };
          }
        }
      } catch {
        /* API asleep or unreachable: fall through */
      }
    }
  }

  // 3. Local estimate.
  return { elo: estimateFromAnalysis(input.analysis, input.color), method: 'estimate', margin: 300 };
};
