from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load the ML model
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'modele_elo_optimise_final', 'modele_elo_optimise_final.pkl')

model = None
model_loaded = False

try:
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    model_loaded = True
    print("ML Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    print("Using fallback prediction method")
    model = None

def fallback_prediction(features):
    """Fallback prediction when ML model is not available"""
    # Simple heuristic based on game features
    base_elo = 1200
    
    # Number of moves (longer games usually indicate higher level)
    move_bonus = min(features[0] * 5, 200) if len(features) > 0 else 0
    
    # Captures (more captures = more tactical play)
    capture_bonus = min(features[2] * 10, 100) if len(features) > 2 else 0
    
    # Checks (more checks = more aggressive play)
    check_bonus = min(features[3] * 15, 150) if len(features) > 3 else 0
    
    predicted_elo = base_elo + move_bonus + capture_bonus + check_bonus
    return min(max(predicted_elo, 800), 2800)  # Clamp between 800 and 2800

@app.route('/api/predict-elo', methods=['POST'])
def predict_elo():
    """
    Predict Elo rating from game data
    Expected JSON payload:
    {
        "features": [array of numerical features from the game]
    }
    """
    try:
        data = request.json
        features = data.get('features', [])
        
        if not features:
            return jsonify({"error": "No features provided"}), 400
        
        # Convert to numpy array and reshape for prediction
        features_array = np.array(features).reshape(1, -1)
        
        if model_loaded and model is not None:
            # Use ML model
            prediction = model.predict(features_array)[0]
            return jsonify({
                "predicted_elo": float(prediction),
                "status": "success",
                "method": "ml_model"
            })
        else:
            # Use fallback prediction
            prediction = fallback_prediction(features)
            return jsonify({
                "predicted_elo": float(prediction),
                "status": "success",
                "method": "fallback"
            })
    except Exception as e:
        # If ML prediction fails, use fallback
        try:
            prediction = fallback_prediction(features)
            return jsonify({
                "predicted_elo": float(prediction),
                "status": "success",
                "method": "fallback_error"
            })
        except:
            return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": model_loaded
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
