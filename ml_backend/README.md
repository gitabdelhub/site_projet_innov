# ML Backend for Elo Prediction

This Python Flask backend provides an API endpoint for Elo prediction using the machine learning model.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the backend:
```bash
python app.py
```

The backend will start on `http://localhost:5000`

## API Endpoints

### POST /api/predict-elo
Predict Elo rating from game features.

**Request:**
```json
{
  "features": [array of numerical features]
}
```

**Response:**
```json
{
  "predicted_elo": 1450.5,
  "status": "success"
}
```

### GET /api/health
Check if the backend and model are loaded.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

## Model

The ML model is located in `../modele_elo_optimise_final/modele_elo_optimise_final.pkl` and is automatically loaded on startup.

## Integration with Frontend

The React frontend (CoachElo.tsx) calls this API to get Elo predictions. If the backend is not available, it falls back to simulated analysis.
