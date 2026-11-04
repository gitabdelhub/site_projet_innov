"""
Exports a compact version of our Elo model for the browser and for small servers.

The original modele_elo_optimise_final.pkl (629 MB) is a StackingRegressor:
    final = LinearRegression(rf, gb, ridge) on MinMax scaled features.
- GradientBoosting and Ridge are exported EXACTLY (trees and coefficients).
- The RandomForest (the 600 MB part) is sampled on a 4D grid and evaluated by
  multilinear interpolation.
The script prints the fidelity (mean absolute gap, in Elo points) against the
full model on random inputs.

Usage:
    pip install scikit-learn==1.6.1 joblib pandas
    python scripts/export_compact_model.py <path/to/modele_elo_optimise_final.pkl> public/models/elo_model.json
"""
import sys
import joblib, numpy as np, json, warnings, pandas as pd, os
warnings.filterwarnings('ignore')
o = joblib.load(sys.argv[1])
s, m = o['scaler'], o['model']
names = list(s.feature_names_in_); lo, hi = s.data_min_, s.data_max_
rf, gb, ridge = m.estimators_
fe = m.final_estimator_
sizes = [61, 11, 46, 31]
axes = [np.linspace(lo[i], hi[i], sizes[i]) for i in range(4)]; axes[1] = np.arange(0, 11, dtype=float)
G = np.stack(np.meshgrid(*axes, indexing='ij'), -1).reshape(-1, 4)
Gs = s.transform(pd.DataFrame(G, columns=names))
rfgrid = rf.predict(Gs).reshape(sizes)
def interp(grid, x):
    idx=[]; w=[]
    for i in range(4):
        a=axes[i]; v=min(max(x[i],a[0]),a[-1]); j=max(min(np.searchsorted(a,v,side='right')-1,len(a)-2),0)
        idx.append(j); w.append((v-a[j])/(a[j+1]-a[j]))
    out=0.0
    for c in range(16):
        ii=[]; ww=1.0
        for i in range(4):
            b=(c>>i)&1; ii.append(idx[i]+b); ww*= w[i] if b else 1-w[i]
        out+=ww*grid[tuple(ii)]
    return out
rng=np.random.default_rng(0); N=3000
X = np.column_stack([rng.uniform(lo[0],hi[0],N), rng.integers(0,11,N), rng.uniform(lo[2],hi[2],N), rng.uniform(lo[3],hi[3],N)])
Xs = s.transform(pd.DataFrame(X, columns=names))
y = m.predict(Xs)
hyb = fe.intercept_ + fe.coef_[0]*np.array([interp(rfgrid,x) for x in X]) + fe.coef_[1]*gb.predict(Xs) + fe.coef_[2]*ridge.predict(Xs)
e=np.abs(y-hyb); print('hybrid MAE', e.mean(), 'p95', np.percentile(e,95), 'max', e.max())
# export GB trees
trees=[]
for est in gb.estimators_[:,0]:
    t=est.tree_
    trees.append({'f':t.feature.tolist(),'t':np.round(t.threshold,6).tolist(),'l':t.children_left.tolist(),'r':t.children_right.tolist(),'v':np.round(t.value[:,0,0],4).tolist()})
init = float(gb.init_.constant_[0][0]) if hasattr(gb.init_,'constant_') else float(gb._raw_predict_init(Xs[:1])[0][0])
out = {'features': names, 'scaler': {'min': lo.tolist(), 'max': hi.tolist()},
  'stack': {'intercept': float(fe.intercept_), 'coef': fe.coef_.tolist()},
  'rf_grid': {'axes': [np.round(a,4).tolist() for a in axes], 'values': np.round(rfgrid.ravel(),1).tolist()},
  'gb': {'init': init, 'lr': gb.learning_rate, 'trees': trees},
  'ridge': {'coef': ridge.coef_.tolist(), 'intercept': float(ridge.intercept_)},
  'meta': {'source': 'modele_elo_optimise_final.pkl', 'r2': o['r2_score'], 'fidelity_mae': float(e.mean())}}
json.dump(out, open(sys.argv[2],'w'), separators=(',',':'))
print('size', os.path.getsize(sys.argv[2]))
# check gb init path
print('gb init', init, 'check', gb.predict(Xs[:2]))
