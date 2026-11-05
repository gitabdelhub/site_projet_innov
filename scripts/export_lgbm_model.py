"""
Exports our LightGBM Elo model (modele_elo.joblib) to a compact JSON file that the
browser and the Flask API evaluate exactly (same trees, same scaler).

Usage:
    pip install lightgbm scikit-learn joblib
    python scripts/export_lgbm_model.py modele_elo.joblib public/models/elo_lgbm.json
"""
import json
import sys

import joblib
import numpy as np


def compact_tree(node):
    """Flattens a LightGBM tree into parallel arrays (f, t, l, r, v, d)."""
    f, t, l, r, v, d = [], [], [], [], [], []

    def walk(n):
        i = len(f)
        f.append(-1), t.append(0.0), l.append(-1), r.append(-1), v.append(0.0), d.append(0)
        if "split_index" in n:
            if n.get("decision_type", "<=") != "<=":
                raise ValueError("only numerical <= splits are supported")
            f[i] = n["split_feature"]
            t[i] = n["threshold"]
            d[i] = 1 if n.get("default_left", True) else 0
            l[i] = walk(n["left_child"])
            r[i] = walk(n["right_child"])
        else:
            v[i] = n["leaf_value"]
        return i

    walk(node)
    return {"f": f, "t": t, "l": l, "r": r, "v": v, "d": d}


def main(src, dst):
    bundle = joblib.load(src)
    model, scaler = bundle["model"], bundle["scaler"]
    dump = model.booster_.dump_model()
    trees = [compact_tree(ti["tree_structure"]) for ti in dump["tree_info"]]
    out = {
        "type": "lgbm",
        "features": bundle["features"],
        "scaler": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "trees": trees,
        "meta": {
            "min_games": bundle.get("min_games"),
            "elo_range": list(bundle.get("elo_range", [])),
            "cv_mae": bundle.get("cv_mae"),
        },
    }
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))

    # Self check against LightGBM on random scaled inputs.
    rng = np.random.default_rng(0)
    X = rng.normal(size=(200, len(bundle["features"])))
    expected = model.predict(X)

    def predict(row):
        total = 0.0
        for tr in trees:
            i = 0
            while tr["l"][i] != -1:
                x = row[tr["f"][i]]
                i = tr["l"][i] if (x <= tr["t"][i] if not np.isnan(x) else tr["d"][i]) else tr["r"][i]
            total += tr["v"][i]
        return total

    got = np.array([predict(r) for r in X])
    print(f"{len(trees)} trees exported, max gap vs LightGBM: {np.abs(got - expected).max():.6f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
