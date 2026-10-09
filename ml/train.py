"""Trains and measures the Elo model.

    python ml/train.py

Input : ml/data/features.csv (built by ml/build-features.ts)
Output: src/data/eloModel.json (model used by the website)
        ml/RESULTS.md          (measured accuracy, to quote in the report)

Every score below is measured on players the model never saw during training
(5-fold cross-validation grouped by player).
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
# Same order as FEATURE_NAMES in src/lib/eloFeatures.ts.
# The time control is deliberately left out: in our sample it is linked to how
# players were found, not to their strength, so it would inflate the scores.
FEATURES = [
    "my_acpl", "my_accuracy", "my_best_rate", "my_inaccuracy_rate", "my_mistake_rate",
    "my_blunder_rate", "my_opening_loss", "my_balanced_acpl", "my_balanced_blunder_rate",
    "my_loss_p75", "opp_acpl", "opp_accuracy", "opp_best_rate", "opp_blunder_rate",
    "opp_balanced_acpl", "my_moves", "my_score",
]
GAMES_PER_ESTIMATE = [1, 3, 5, 10]
SEED = 7

data = pd.read_csv(ROOT / "ml/data/features.csv")
X = data[FEATURES].to_numpy()
y = data["rating"].to_numpy(dtype=float)
groups = data["collected_user"].to_numpy()


def acpl_formula(acpl):
    """The formula the website used before this model (src/lib/analysis.ts, eloFromAcpl)."""
    return np.clip(3100 * np.exp(-0.01 * acpl), 400, 2800)


def make_gbr():
    return GradientBoostingRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8,
        min_samples_leaf=20, loss="huber", random_state=SEED,
    )


models = {
    "Average rating (no information)": None,
    "Old formula (ACPL only)": "formula",
    "Linear model (ridge)": lambda: make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
    "Gradient boosting (chosen)": make_gbr,
}

predictions = {name: np.zeros(len(y)) for name in models}
folds = list(GroupKFold(n_splits=5).split(X, y, groups))
for train, test in folds:
    for name, factory in models.items():
        if factory is None:
            predictions[name][test] = y[train].mean()
        elif factory == "formula":
            predictions[name][test] = acpl_formula(data["my_acpl"].to_numpy()[test])
        else:
            model = factory().fit(X[train], y[train])
            predictions[name][test] = model.predict(X[test])


def scores(pred, truth):
    err = np.abs(pred - truth)
    return {
        "mae": float(err.mean()),
        "within200": float((err <= 200).mean()),
        "r2": float(1 - ((pred - truth) ** 2).sum() / ((truth - truth.mean()) ** 2).sum()),
    }


single = {name: scores(p, y) for name, p in predictions.items()}

# Several games of the same player: average the per-game estimates
rng = np.random.default_rng(SEED)
best = predictions["Gradient boosting (chosen)"]
own = data["player"] == data["collected_user"]
multi = {}
for n in GAMES_PER_ESTIMATE:
    errors = []
    for user, idx in data[own].groupby("collected_user").groups.items():
        idx = np.array(list(idx))
        if len(idx) < n:
            continue
        for _ in range(20):
            pick = rng.choice(idx, size=n, replace=False)
            errors.append(best[pick].mean() - y[pick].mean())
    errors = np.abs(np.array(errors))
    multi[n] = {
        "mae": float(errors.mean()),
        "p80": float(np.quantile(errors, 0.8)),
        "within200": float((errors <= 200).mean()),
        "samples": int(len(errors)),
    }

# Error by level, single game
bands = []
for lo in range(600, 3000, 400):
    mask = (y >= lo) & (y < lo + 400)
    if mask.sum():
        bands.append((lo, lo + 399, int(mask.sum()), float(np.abs(best[mask] - y[mask]).mean())))

# Final model on all the data, exported for the browser
final = make_gbr().fit(X, y)


def export_tree(tree):
    t = tree.tree_
    return {
        "f": t.feature.tolist(),
        "t": [round(v, 6) for v in t.threshold.tolist()],
        "l": t.children_left.tolist(),
        "r": t.children_right.tolist(),
        "v": [round(v[0][0], 4) for v in t.value.tolist()],
    }


# A few reference predictions so a test can check the browser gives the same numbers
check_rows = X[:: max(1, len(X) // 25)][:25]
model_json = {
    "version": 1,
    "trainedOn": f"{data['game'].nunique()} rated Lichess games ({len(data)} player-games), ratings {int(y.min())}-{int(y.max())}",
    "features": FEATURES,
    "init": float(final.init_.constant_[0][0]) if hasattr(final.init_, "constant_") else float(np.median(y)),
    "learningRate": final.learning_rate,
    "trees": [export_tree(est[0]) for est in final.estimators_],
    # Measured error (80% of estimates fall within this many points), by number of games
    "error80": {str(n): round(m["p80"]) for n, m in multi.items()},
    "mae": {str(n): round(m["mae"]) for n, m in multi.items()},
    "check": {"inputs": check_rows.round(5).tolist(), "outputs": final.predict(check_rows.round(5)).round(2).tolist()},
}
(ROOT / "src/data/eloModel.json").write_text(json.dumps(model_json, separators=(",", ":")))

importance = sorted(zip(FEATURES, final.feature_importances_), key=lambda p: -p[1])

lines = [
    "# Elo model: measured results",
    "",
    f"Data: {model_json['trainedOn']}, downloaded with `ml/collect-lichess.mjs` "
    "(games already analysed by Lichess's Stockfish, spread evenly from 600 to 3000).",
    "Every number is measured on players the model never saw (5-fold cross-validation grouped by player).",
    "Ratings are Lichess ratings of the game's time control (blitz, rapid or classical).",
    "",
    "## One game",
    "",
    "| Method | Mean error | Within ±200 | R² |",
    "|---|---|---|---|",
]
for name, s in single.items():
    lines.append(f"| {name} | {s['mae']:.0f} | {s['within200'] * 100:.0f}% | {s['r2']:.2f} |")
lines += [
    "",
    "## Several games of the same player (chosen model, estimates averaged)",
    "",
    "| Games | Mean error | 80% of estimates within | Within ±200 |",
    "|---|---|---|---|",
]
for n, m in multi.items():
    lines.append(f"| {n} | {m['mae']:.0f} | ±{m['p80']:.0f} | {m['within200'] * 100:.0f}% |")
lines += ["", "## Error by level (one game)", "", "| Rating | Player-games | Mean error |", "|---|---|---|"]
for lo, hi, count, mae in bands:
    lines.append(f"| {lo}-{hi} | {count} | {mae:.0f} |")

# Real website conditions: the same games re-analysed with the website's engine
# (ml/browser-engine-check.ts). The model used here never saw these players.
browser_file = ROOT / "ml/data/browser-features.csv"
if browser_file.exists():
    browser = pd.read_csv(browser_file)
    held_out = set(browser["collected_user"])
    keep = ~data["collected_user"].isin(held_out) & ~data["player"].isin(held_out)
    model = make_gbr().fit(X[keep.to_numpy()], y[keep.to_numpy()])
    reference = data.set_index(["game", "side"]).loc[browser.set_index(["game", "side"]).index]
    truth = browser["rating"].to_numpy(dtype=float)
    p_lichess = model.predict(reference[FEATURES].to_numpy())
    p_browser = model.predict(browser[FEATURES].to_numpy())
    lines += [
        "",
        "## In the website's real conditions",
        "",
        f"{browser['game'].nunique()} games of {len(held_out)} players left out of training, analysed twice:",
        "with Lichess's evaluations, and with the website's own engine (Stockfish 18 lite, depth 12).",
        "",
        "| Evaluations from | Mean error (one game) | Within ±200 |",
        "|---|---|---|",
        f"| Lichess analysis | {np.abs(p_lichess - truth).mean():.0f} | {(np.abs(p_lichess - truth) <= 200).mean() * 100:.0f}% |",
        f"| Website engine | {np.abs(p_browser - truth).mean():.0f} | {(np.abs(p_browser - truth) <= 200).mean() * 100:.0f}% |",
        "",
        f"Average gap between the two estimates for the same game: {np.abs(p_browser - p_lichess).mean():.0f} points.",
    ]

lines += ["", "## What the model looks at most", "", "| Feature | Importance |", "|---|---|"]
for name, imp in importance:
    lines.append(f"| {name} | {imp * 100:.1f}% |")
(ROOT / "ml/RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
