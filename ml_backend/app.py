"""
Chess Hub Elo prediction API.

POST /api/predict-elo   {"features": [ACPL, Blunders, ExcellentRate, GoodMoveRate]}
GET  /api/health

Model loading order:
1. modele_elo_optimise_final/modele_elo_optimise_final.pkl (full model, 629 MB, local mode)
   The file is a dict {"model": StackingRegressor, "scaler": MinMaxScaler, ...}.
2. public/models/elo_model.json (compact export, same model, a few MB, used on Render)
If neither is available the API answers 503: the website then computes the
prediction in the browser with the same compact model.
"""
import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL_MODEL_PATH = os.environ.get(
    "ELO_MODEL_PATH", os.path.join(ROOT, "modele_elo_optimise_final", "modele_elo_optimise_final.pkl")
)
COMPACT_MODEL_PATH = os.environ.get(
    "ELO_COMPACT_MODEL_PATH",
    os.path.join(ROOT, "public", "models", "elo_model.json")
    if os.path.exists(os.path.join(ROOT, "public", "models", "elo_model.json"))
    else os.path.join(os.path.dirname(os.path.abspath(__file__)), "elo_model.json"),
)
FEATURES = ["ACPL", "Blunders", "ExcellentRate", "GoodMoveRate"]

app = Flask(__name__)
CORS(app)


class FullModel:
    method = "ml_model"

    def __init__(self, path):
        import joblib  # noqa: PLC0415
        import pandas as pd  # noqa: PLC0415

        self._pd = pd
        bundle = joblib.load(path)
        self.model = bundle["model"]
        self.scaler = bundle["scaler"]
        self.features = list(getattr(self.scaler, "feature_names_in_", FEATURES))

    def predict(self, x):
        frame = self._pd.DataFrame([x], columns=self.features)
        return float(self.model.predict(self.scaler.transform(frame))[0])


class CompactModel:
    method = "ml_model_compact"

    def __init__(self, path):
        with open(path, encoding="utf-8") as fh:
            self.m = json.load(fh)
        self.features = self.m["features"]
        axes = self.m["rf_grid"]["axes"]
        self.dims = [len(a) for a in axes]

    def _scale(self, x):
        lo, hi = self.m["scaler"]["min"], self.m["scaler"]["max"]
        return [0.0 if h == l else (v - l) / (h - l) for v, l, h in zip(x, lo, hi)]

    def _rf(self, x):
        axes, values = self.m["rf_grid"]["axes"], self.m["rf_grid"]["values"]
        idx, w = [], []
        for i, a in enumerate(axes):
            v = min(max(x[i], a[0]), a[-1])
            j = 0
            while j < len(a) - 2 and a[j + 1] <= v:
                j += 1
            idx.append(j)
            w.append((v - a[j]) / (a[j + 1] - a[j]))
        out = 0.0
        for c in range(1 << len(axes)):
            flat, weight = 0, 1.0
            for i in range(len(axes)):
                b = (c >> i) & 1
                flat = flat * self.dims[i] + idx[i] + b
                weight *= w[i] if b else 1 - w[i]
            if weight > 0:
                out += weight * values[flat]
        return out

    def predict(self, x):
        xs = self._scale(x)
        gb = self.m["gb"]
        total = 0.0
        for t in gb["trees"]:
            node = 0
            while t["l"][node] != -1:
                node = t["l"][node] if xs[t["f"][node]] <= t["t"][node] else t["r"][node]
            total += t["v"][node]
        gb_value = gb["init"] + gb["lr"] * total
        ridge = self.m["ridge"]
        ridge_value = ridge["intercept"] + sum(c * v for c, v in zip(ridge["coef"], xs))
        c_rf, c_gb, c_ridge = self.m["stack"]["coef"]
        return self.m["stack"]["intercept"] + c_rf * self._rf(x) + c_gb * gb_value + c_ridge * ridge_value


def load_model():
    if os.path.exists(FULL_MODEL_PATH):
        try:
            model = FullModel(FULL_MODEL_PATH)
            print(f"Full ML model loaded from {FULL_MODEL_PATH}")
            return model
        except Exception as exc:  # noqa: BLE001
            print(f"Could not load the full model ({exc}), trying the compact one")
    if os.path.exists(COMPACT_MODEL_PATH):
        model = CompactModel(COMPACT_MODEL_PATH)
        print(f"Compact ML model loaded from {COMPACT_MODEL_PATH}")
        return model
    print("No model found")
    return None


MODEL = load_model()


@app.route("/api/predict-elo", methods=["POST"])
def predict_elo():
    data = request.get_json(silent=True) or {}
    features = data.get("features")
    if not isinstance(features, list) or len(features) != len(FEATURES):
        return jsonify({"error": f"features must be a list of {len(FEATURES)} numbers: {FEATURES}"}), 400
    try:
        x = [float(v) for v in features]
    except (TypeError, ValueError):
        return jsonify({"error": "features must be numbers"}), 400
    if MODEL is None:
        return jsonify({"error": "model not available"}), 503
    elo = MODEL.predict(x)
    return jsonify({"predicted_elo": round(elo, 1), "status": "success", "method": MODEL.method, "features": FEATURES})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {"status": "healthy", "model_loaded": MODEL is not None, "method": MODEL.method if MODEL else None, "features": FEATURES}
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
