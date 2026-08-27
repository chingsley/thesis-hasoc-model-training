### Step 4.1: Backend Development

- [x] Develop API for model inference (`/predict`, `/predict/batch`, per-language routing)
- [x] Implement real-time text processing pipeline (predictions logged to SQLite, live volume/drift analytics)
- [x] Create database schema for logged content and decisions (`app/db.py`: predictions, triage, alerts)
- [x] Build explanation generation service (`/explain`: LIME, SHAP, attention rollout, integrated gradients)
