"""
Chess Hub Elo prediction API (same model as the website, on the server).

POST /api/predict-elo   {"features": [42 numbers or null, in the order of /api/health]}
GET  /api/health

The 42 features describe a PLAYER PROFILE (several games). They are computed by the
website (src/elo/features.ts) and documented in docs/MODELE_ELO.md.

Model loading order:
1. ELO_MODEL_PATH (default: modele_elo.joblib at the repo root), the original LightGBM
   model. Needs requirements-full.txt (lightgbm, scikit-learn, joblib, numpy).
2. elo_lgbm.json, the exact export of the same trees (scripts/export_lgbm_model.py),
   evaluated in pure Python: this is what runs on Render.
If neither is available the API answers 503 and the website keeps its own copy.

Important: the trees split on RAW values. The StandardScaler stored in the .joblib is
for a linear variant only (is_linear False) and is not applied. A missing value (null)
is replaced by the training mean.
"""
import json
import math
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FULL_MODEL_PATH = os.environ.get("ELO_MODEL_PATH", os.path.join(ROOT, "modele_elo.joblib"))
JSON_CANDIDATES = [
    os.environ.get("ELO_JSON_MODEL_PATH", ""),
    os.path.join(ROOT, "public", "models", "elo_lgbm.json"),
    os.path.join(HERE, "elo_lgbm.json"),
]

app = Flask(__name__)
CORS(app)


class JsonModel:
    method = "ml_model"

    def __init__(self, path):
        with open(path, encoding="utf-8") as fh:
            m = json.load(fh)
        self.features = m["features"]
        self.means = m["scaler"]["mean"]
        self.trees = m["trees"]
        self.meta = m.get("meta", {})

    def predict(self, x):
        total = 0.0
        for t in self.trees:
            i = 0
            while t["l"][i] != -1:
                i = t["l"][i] if x[t["f"][i]] <= t["t"][i] else t["r"][i]
            total += t["v"][i]
        return total


class JoblibModel(JsonModel):
    method = "ml_model_joblib"

    def __init__(self, path):  # noqa: D107 (no super call: different source)
        import joblib  # noqa: PLC0415

        bundle = joblib.load(path)
        self.model = bundle["model"]
        self.features = list(bundle["features"])
        self.means = list(bundle["scaler"].mean_)
        self.meta = {"min_games": bundle.get("min_games"), "elo_range": list(bundle.get("elo_range", [])), "cv_mae": bundle.get("cv_mae")}

    def predict(self, x):
        return float(self.model.predict([x])[0])


def load_model():
    if os.path.exists(FULL_MODEL_PATH):
        try:
            model = JoblibModel(FULL_MODEL_PATH)
            print(f"LightGBM model loaded from {FULL_MODEL_PATH}")
            return model
        except Exception as exc:  # noqa: BLE001
            print(f"Could not load {FULL_MODEL_PATH} ({exc}), trying the JSON export")
    for path in JSON_CANDIDATES:
        if path and os.path.exists(path):
            print(f"JSON export of the model loaded from {path}")
            return JsonModel(path)
    print("No model found")
    return None


MODEL = load_model()


@app.route("/api/predict-elo", methods=["POST"])
def predict_elo():
    if MODEL is None:
        return jsonify({"error": "model not available"}), 503
    data = request.get_json(silent=True) or {}
    features = data.get("features")
    n = len(MODEL.features)
    if not isinstance(features, list) or len(features) != n:
        return jsonify({"error": f"features must be a list of {n} values (numbers or null)", "features": MODEL.features}), 400
    x = []
    for value, mean in zip(features, MODEL.means):
        if value is None:
            x.append(mean)
            continue
        try:
            v = float(value)
        except (TypeError, ValueError):
            return jsonify({"error": "features must be numbers or null"}), 400
        x.append(v if math.isfinite(v) else mean)
    elo = MODEL.predict(x)
    return jsonify({"predicted_elo": round(elo, 1), "status": "success", "method": MODEL.method})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "healthy",
            "model_loaded": MODEL is not None,
            "method": MODEL.method if MODEL else None,
            "features": MODEL.features if MODEL else None,
            "meta": MODEL.meta if MODEL else None,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
