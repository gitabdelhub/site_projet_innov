/**
 * Elo prediction with our ML model (LightGBM, modele_elo.joblib).
 *
 * The model reads a PLAYER PROFILE built from one or more games (src/elo/features.ts).
 * It was trained on profiles of 20 games or more: with fewer games the prediction is
 * still given, with a wider margin and a reliability label.
 *
 * Order of attempts:
 *  1. our model running in the browser (no network needed)
 *  2. the Flask API (VITE_API_URL), same model on the server
 *  3. a local estimate from the Stockfish analysis, clearly labelled as such
 */
import type { GameAnalysis } from "../engine/analysis";
import type { Color, PlayedMove } from "../lib/chessGame";
import {
  buildProfile,
  computeGameStats,
  initialFromHeaders,
  marginFor,
  reliabilityOf,
  type GameStats,
  type Reliability,
} from "./features";
import { evaluateLgbm, loadLgbmModel } from "./model";

export type PredictionMethod = "model-browser" | "model-api" | "estimate";

export interface EloPrediction {
  elo: number;
  method: PredictionMethod;
  /** Typical error, shown as "± x". */
  margin: number;
  /** Number of games in the profile. */
  nGames: number;
  reliability: Reliability;
  /** Statistics of the analysed game (to store and reuse in the player's profile). */
  stats?: GameStats;
}

export interface PredictInput {
  startFen: string;
  moves: PlayedMove[];
  analysis: GameAnalysis;
  color: Color;
  headers?: Record<string, string>;
  /** Starting clock in seconds (games played on the site). */
  initialSec?: number;
  /** Statistics of the player's previous games, added to the profile. */
  history?: GameStats[];
}

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "";

const clampElo = (x: number) => Math.round(Math.max(400, Math.min(2800, x)));

/**
 * Fallback estimate from accuracy and average centipawn loss.
 * Simple monotonic curve: it is NOT our model and is labelled "estimate" in the UI.
 */
export const estimateFromAnalysis = (
  analysis: GameAnalysis,
  color: Color,
): number => {
  const s = color === "w" ? analysis.white : analysis.black;
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

/** Runs the model on a profile: browser first, then the API. Null if both fail. */
const runModel = async (
  features: number[],
): Promise<{ elo: number; method: PredictionMethod } | null> => {
  try {
    const model = await loadLgbmModel();
    if (model) {
      const elo = evaluateLgbm(model, features);
      if (Number.isFinite(elo))
        return { elo: clampElo(elo), method: "model-browser" };
    }
  } catch (e) {
    console.warn("Browser model failed, trying the API", e);
  }
  if (API_URL) {
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/predict-elo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // NaN is not valid JSON: missing values are sent as null.
          body: JSON.stringify({
            features: features.map((v) => (Number.isFinite(v) ? v : null)),
          }),
        },
        6000,
      );
      if (res.ok) {
        const data = await res.json();
        if (
          String(data.method).startsWith("ml_model") &&
          Number.isFinite(data.predicted_elo)
        ) {
          return { elo: clampElo(data.predicted_elo), method: "model-api" };
        }
      }
    } catch {
      /* API asleep or unreachable */
    }
  }
  return null;
};

/** Prediction from the statistics of several games of the same player. */
export const predictFromStats = async (
  games: GameStats[],
): Promise<EloPrediction | null> => {
  if (games.length === 0) return null;
  const res = await runModel(buildProfile(games));
  if (!res) return null;
  return {
    ...res,
    margin: marginFor(games.length),
    nGames: games.length,
    reliability: reliabilityOf(games.length),
  };
};

/** Statistics of one analysed game for one player. */
export const statsOfGame = (
  input: Pick<
    PredictInput,
    "analysis" | "moves" | "color" | "headers" | "initialSec"
  >,
) =>
  computeGameStats({
    analysis: input.analysis,
    moves: input.moves,
    color: input.color,
    initialSec: input.initialSec ?? initialFromHeaders(input.headers),
  });

/** Prediction after a game: this game plus the player's previous games (if given). */
export const predictElo = async (
  input: PredictInput,
): Promise<EloPrediction> => {
  const stats = statsOfGame(input) ?? undefined;
  if (stats) {
    const games = [stats, ...(input.history ?? [])].slice(0, 50);
    const pred = await predictFromStats(games);
    if (pred) return { ...pred, stats };
  }
  return {
    elo: estimateFromAnalysis(input.analysis, input.color),
    method: "estimate",
    margin: 300,
    nGames: 1,
    reliability: "low",
    stats,
  };
};
