# Classify Posts module

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

2. `POST /explain` (optional, for highlighting) — **not called** when `use_openai_moderation` is true on the `/predict` response. Otherwise SHAP only: `{ "text": "<same>", "language": "...", "methods": ["shap"] }`. Same auth. Skipped silently if this fails.

**Backend — `/predict`:** `main.py` → auth via `get_caller_user` → unless `USE_OPEN_AI_MODERATION_API=true` (OpenAI Moderation API; needs `OPENAI_API_KEY`), the model router selects the **already-loaded** language model (joint fallback when missing → `used_fallback: true`) → inference → **`db.log_predictions`** inserts one row (`source: "single"`). OpenAI mode maps moderation results to Normal/Abuse/Hate: if OpenAI flags **hate** (or hate/threatening), the HASOC label is **Hate** even when harassment scores are higher; otherwise abuse flags/scores → **Abuse**. Probabilities use hate strength plus non-overlapping abuse mass (not the old sum-to-one renormalize of two full toxic scores). Sets `model_id` like `openai/moderation:omni-moderation-latest` and `use_openai_moderation: true`. Response: `predicted_label`, `probabilities`, `model_id`, `language`, `used_fallback`, `use_openai_moderation`.

**Dashboard when OpenAI mode is on:** `GET /health` exposes `use_openai_moderation` and `openai_moderation_model`; the header shows an **OpenAI Moderation** chip (Settings has the full notice). Single-text classify skips `/explain` so Analyze stays fast and does not load local XAI.

**Validation:** `text` must be 10–5000 characters, with real message content (`text_validation.py` + `schemas.py`): not only digits, not a label name, not `pred_<id>`, at least two words or 20+ characters. Invalid bodies → `422`; missing auth → `401`.

**Backend — `/explain`:** Runs SHAP only; results are cached per `(language, methods, text)` in the SQLite `explanations` table, so re-analyzing the same text is instant. Returns token scores for highlighting.

**Frontend after success:** Shows label badge, Normal/Abuse/Hate percentages, model id (with “joint fallback” note when `used_fallback`). If SHAP tokens exist, `ToxicTextHighlighter` colors toxic words. Invalidates `overview-stats` and `volume` queries so Overview and Analysis charts update. On failure: “Classification failed. Is the backend running and reachable via the Vite proxy?”

**Side effect:** This logged row becomes `pred_<id>` elsewhere (Explainability list, word cloud, drift).

---

## Batch Scanner tab

**User action:** Click **Upload CSV** (or `.txt`). The browser parses and validates the file (`batch-csv.ts`) before any API call. Accepted: one message per line, or a CSV **header** with a `text` / `tweet` / `message` column (quoted commas supported). Rejected: dashboard export files (`predicted_label`, `hate_probability`, …), numeric-only cells, labels, and rows that fail the same rules as single predict. Classification starts only after validation passes.

**Request:** One or more `POST /predict/batch` calls — texts sent in chunks of **256** (`BATCH_SIZE`).  
Body: `{ "texts": ["line1", "line2", …], "language": "igbo"|"yoruba" }`  
Header: `Authorization: Bearer <token>`

**Backend:** Same classifier routing as single predict (local model or OpenAI Moderation when env is set). Texts stripped; inference per chunk (local internal batches of 16, or one OpenAI request per API chunk) → **`db.log_predictions`** per text (`source: "batch"`). Returns `results[]`, `model_id`, `language`, `used_fallback`, `use_openai_moderation`.

**Validation:** each request accepts **1–256 texts**, each passing `validate_prediction_text` (10–5000 characters, same content rules as single predict). The client's 256-chunking matches the server cap. Invalid bodies or missing auth → `422` / `401`.

**Model note:** Labels on nonsense input (e.g. a lone digit) are **out of distribution** and not meaningful for accuracy evaluation; validation blocks new junk rows. Existing bad rows in Review & Report are historical test data.

**Frontend processing:** Builds local `BatchResult[]` with ids like `batch_0`, `batch_1`. Summary badges show per-label **counts**; each row shows the label badge, text preview, and N/A/H **percentages**. **Download Results** exports CSV client-side (no extra API call). Invalidates `overview-stats` and `volume` on success.

**Data note:** Batch rows also feed Analysis, Explainability, and Overview stats — same prediction log as single tester.
