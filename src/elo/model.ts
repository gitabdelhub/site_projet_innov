/**
 * Our Elo model running in the browser.
 *
 * public/models/elo_model.json is exported from modele_elo_optimise_final.pkl by
 * scripts/export_compact_model.py:
 *   prediction = intercept + c_rf * RF(x) + c_gb * GB(x) + c_ridge * Ridge(x)
 * with x = MinMax scaled features [ACPL, Blunders, ExcellentRate, GoodMoveRate].
 * GB and Ridge are exact, RF is a 4D grid with multilinear interpolation.
 */

interface Tree {
  f: number[];
  t: number[];
  l: number[];
  r: number[];
  v: number[];
}

export interface CompactModel {
  features: string[];
  scaler: { min: number[]; max: number[] };
  stack: { intercept: number; coef: [number, number, number] };
  rf_grid: { axes: number[][]; values: number[] };
  gb: { init: number; lr: number; trees: Tree[] };
  ridge: { coef: number[]; intercept: number };
  meta: { source: string; r2: number; fidelity_mae: number };
}

export interface BrowserModel {
  predict: (features: number[]) => Promise<number>;
  margin: number;
  features: string[];
}

const scale = (m: CompactModel, x: number[]) =>
  x.map((v, i) => {
    const lo = m.scaler.min[i];
    const hi = m.scaler.max[i];
    return hi === lo ? 0 : (v - lo) / (hi - lo);
  });

const treeValue = (t: Tree, xs: number[]) => {
  let node = 0;
  while (t.l[node] !== -1) node = xs[t.f[node]] <= t.t[node] ? t.l[node] : t.r[node];
  return t.v[node];
};

/** RF grid lookup in raw (unscaled) feature space, values clamped to the grid. */
const rfValue = (m: CompactModel, x: number[]) => {
  const { axes, values } = m.rf_grid;
  const dims = axes.map((a) => a.length);
  const idx: number[] = [];
  const w: number[] = [];
  axes.forEach((a, i) => {
    const v = Math.min(Math.max(x[i], a[0]), a[a.length - 1]);
    let j = 0;
    while (j < a.length - 2 && a[j + 1] <= v) j++;
    idx.push(j);
    w.push((v - a[j]) / (a[j + 1] - a[j]));
  });
  let out = 0;
  for (let c = 0; c < 1 << axes.length; c++) {
    let flat = 0;
    let weight = 1;
    for (let i = 0; i < axes.length; i++) {
      const b = (c >> i) & 1;
      flat = flat * dims[i] + idx[i] + b;
      weight *= b ? w[i] : 1 - w[i];
    }
    if (weight > 0) out += weight * values[flat];
  }
  return out;
};

export const evaluate = (m: CompactModel, x: number[]): number => {
  const xs = scale(m, x);
  const gb = m.gb.init + m.gb.lr * m.gb.trees.reduce((s, t) => s + treeValue(t, xs), 0);
  const ridge = m.ridge.intercept + m.ridge.coef.reduce((s, c, i) => s + c * xs[i], 0);
  const rf = rfValue(m, x);
  const [crf, cgb, cridge] = m.stack.coef;
  return m.stack.intercept + crf * rf + cgb * gb + cridge * ridge;
};

let loading: Promise<BrowserModel | null> | null = null;

export const browserModel = (): Promise<BrowserModel | null> => {
  loading ??= fetch('/models/elo_model.json')
    .then((r) => (r.ok ? (r.json() as Promise<CompactModel>) : null))
    .then((m) =>
      m
        ? {
            features: m.features,
            margin: 200,
            predict: async (features: number[]) => evaluate(m, features),
          }
        : null,
    )
    .catch(() => null);
  return loading;
};
