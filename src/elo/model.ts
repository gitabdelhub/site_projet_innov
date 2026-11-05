/**
 * Our Elo model running in the browser.
 */

/* ------------------------------------------------------------------ */
/* LightGBM model (modele_elo.joblib), exported exactly by            */
/* scripts/export_lgbm_model.py.                                      */
/*                                                                    */
/* The trees split on RAW feature values: the StandardScaler stored   */
/* in the .joblib is only meant for a linear variant (is_linear is    */
/* False), so it must NOT be applied. A missing value (for instance   */
/* the clock variables of a PGN without clocks) is replaced by the    */
/* training mean, which is stored as scaler.mean.                     */
/* ------------------------------------------------------------------ */

interface LgbmTree {
  f: number[];
  t: number[];
  l: number[];
  r: number[];
  v: number[];
  /** 1 if a missing value goes left (unused: the model never saw missing values). */
  d: number[];
}

export interface LgbmModel {
  type: "lgbm";
  features: string[];
  scaler: { mean: number[]; scale: number[] };
  trees: LgbmTree[];
  meta: { min_games: number; elo_range: [number, number]; cv_mae: number };
}

export const evaluateLgbm = (m: LgbmModel, raw: number[]): number => {
  const x = raw.map((v, i) => (Number.isFinite(v) ? v : m.scaler.mean[i]));
  let total = 0;
  for (const t of m.trees) {
    let i = 0;
    while (t.l[i] !== -1) i = x[t.f[i]] <= t.t[i] ? t.l[i] : t.r[i];
    total += t.v[i];
  }
  return total;
};

let lgbmLoading: Promise<LgbmModel | null> | null = null;

export const loadLgbmModel = (): Promise<LgbmModel | null> => {
  lgbmLoading ??= fetch("/models/elo_lgbm.json")
    .then((r) => (r.ok ? (r.json() as Promise<LgbmModel>) : null))
    .catch(() => null);
  return lgbmLoading;
};
