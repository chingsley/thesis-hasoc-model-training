# Testing Tools module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/testing` · **Page:** `frontend_dashboard/src/pages/Testing.tsx`

Tabs: Single Text Tester · Batch Scanner

---

## Single Text Tester tab

**User action:** Paste text, click **Analyze** (`TextTester.tsx`).

**Requests (sequential):**

1. `POST /predict`  
   Body: `{ "text": "<trimmed text>", "language": "igbo"|"yoruba" }`  
   Header: `Authorization: Bearer <token>`

2. `POST /explain` (optional, for highlighting)  
   Body: `{ "text": "<same>", "language": "...", "methods": ["shap"] }`  
   Same auth. Skipped silently if this fails.

**Backend — `/predict`:** `main.py` → auth via `get_caller_user` → the model router selects the **already-loaded** language model (all models load once at server startup; if the language model is missing, the joint model is used and `used_fallback: true`) → runs inference → **`db.log_predictions`** inserts one row into SQLite `predictions` (timestamp, `user_id`, text, label, probabilities, `source: "single"`). Returns `predicted_label`, `probabilities`, `model_id`, `language`, `used_fallback`.

**Validation:** `text` must be 1–5000 characters (`schemas.py`); invalid bodies or missing auth → `422` / `401`.

**Backend — `/explain`:** Runs SHAP only; results are cached per `(language, methods, text)` in the SQLite `explanations` table, so re-analyzing the same text is instant. Returns token scores for highlighting.

**Frontend after success:** Shows label badge, Normal/Abuse/Hate percentages, model id (with “joint fallback” note when `used_fallback`). If SHAP tokens exist, `ToxicTextHighlighter` colors toxic words. Invalidates `overview-stats` and `volume` queries so Overview and Analysis charts update. On failure: “Classification failed. Is the backend running and reachable via the Vite proxy?”

**Side effect:** This logged row becomes `pred_<id>` elsewhere (Explainability list, word cloud, drift, clusters).

---

## Batch Scanner tab

**User action:** Click **Upload CSV** (or `.txt`). File is read in the browser; each line’s **last comma-separated column** is treated as the text (`BatchScanner.tsx`). Classification starts immediately — no separate submit button.

**Request:** One or more `POST /predict/batch` calls — texts sent in chunks of **256** (`BATCH_SIZE`).  
Body: `{ "texts": ["line1", "line2", …], "language": "igbo"|"yoruba" }`  
Header: `Authorization: Bearer <token>`

**Backend:** `main.py` → auth via `get_caller_user` → texts are stripped and empty ones dropped → model inference on all texts in the chunk (internal batches of 16) → **`db.log_predictions`** inserts one SQLite row per text (`source: "batch"`, your `user_id`). Returns `results[]` with label and probabilities per text, plus `model_id`, `language`, `used_fallback`.

**Validation:** each request accepts **1–256 texts**, each 1–5000 characters (`schemas.py`) — the client's 256-chunking matches the server cap. Invalid bodies or missing auth → `422` / `401`.

**Frontend processing:** Builds local `BatchResult[]` with ids like `batch_0`, `batch_1`. Summary badges show per-label **counts**; each row shows the label badge, text preview, and N/A/H **percentages**. **Download Results** exports CSV client-side (no extra API call). Invalidates `overview-stats` and `volume` on success.

**Data note:** Batch rows also feed Analysis, Explainability, and Overview stats — same prediction log as single tester.
