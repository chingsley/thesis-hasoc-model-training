# Backend API reference

FastAPI service for hate-speech classification, dashboard data, analytics, and explainability.

| Item | Value |
|------|--------|
| App entry | `backend_api_server/app/main.py` |
| Default base URL | `http://localhost:8080` |
| Start command | `uvicorn app.main:app --reload --port 8080` (from `backend_api_server/`) |
| OpenAPI docs | `http://localhost:8080/docs` |
| Frontend proxy | Vite maps `/api/*` → `http://localhost:8080/*` when the dashboard runs locally |

**Source layout**

| Module | Role |
|--------|------|
| `app/main.py` | All HTTP routes |
| `app/schemas.py` | Request/response models |
| `app/model_service.py` | Model loading and inference |
| `app/metrics_service.py` | Test-set metrics (`test_metrics.json`) |
| `app/posts_service.py` | Test posts + predictions (`predictions_test.csv`) |
| `app/analytics_service.py` | Volume, drift, clusters, word cloud, alerts, CSV export |
| `app/explain_service.py` | LIME / SHAP / attention / integrated gradients |
| `app/auth.py` | Password hashing, session tokens, API keys, auth dependencies |
| `app/db.py` | SQLite (users, API keys, sessions, prediction logs, triage, alerts) |
| `scripts/create_user.py` | Admin CLI: create users and API keys |

---

## Authentication

All endpoints except `GET /health` require credentials. Two credential types, both tied to a user account:

| Credential | Header | Used by |
|------------|--------|---------|
| API key (`hgk_...`) | `X-API-Key: hgk_...` | Machine clients (platforms calling from code, Postman, curl) |
| Session token | `Authorization: Bearer <token>` | Dashboard after login |

Create accounts and keys with the admin CLI (no public signup):

```bash
cd backend_api_server
python scripts/create_user.py --email ops@platform.com --org "Platform X" --key-name prod
# prints the API key plaintext once — store it immediately
```

Every `/predict` and `/predict/batch` call is logged with the caller's `user_id` and `language`;
`/stats/overview`, `/analytics/volume`, `/analytics/drift`, and `/alerts` return only the
authenticated user's data. Missing/invalid credentials return `401`:

```json
{
  "detail": "Missing credentials: pass X-API-Key or Authorization: Bearer <token>"
}
```

---

## Shared types

| Name | Allowed values |
|------|----------------|
| `language` | `igbo`, `yoruba` |
| `label` | `Normal`, `Abuse`, `Hate` |
| `triage_status` | `new`, `reviewed`, `reported` |

**Labels:** `Normal` = not toxic, `Abuse` = offensive, `Hate` = hateful.

---

## Errors

| HTTP status | When |
|-------------|------|
| `401` | Missing/invalid/expired credentials (API key, session token, or login) |
| `404` | Missing model, metrics file, post id, alert id, or API key id |
| `422` | Invalid JSON or query parameter (e.g. wrong `language`) |
| `503` | Clustering unavailable (scikit-learn not installed) |

Example error body:

```json
{
  "detail": "Unknown post_id=test_igbo_99999"
}
```

---

## Endpoints

> **Auth convention:** every example below assumes `KEY=hgk_...` (an API key from
> `scripts/create_user.py` or `POST /auth/keys`). Add `-H "X-API-Key: $KEY"` to every call
> except `GET /health` and `POST /auth/login`. The dashboard instead sends
> `Authorization: Bearer <session token>`; both work on all endpoints marked authenticated.

### `GET /health`

Check that models loaded and which device is used.

**Handler:** `main.py` lines 73–80 · **Logic:** `model_service.py`

```bash
curl -s http://localhost:8080/health
```

```json
{
  "status": "ok",
  "device": "cpu",
  "models": {
    "igbo": "chingsley/afro-xlmr-igbo-hate",
    "yoruba": "chingsley/afro-xlmr-yoruba-hate"
  },
  "routing": "per_language"
}
```

---

### `POST /auth/login`

Exchange dashboard credentials for a session token (default lifetime `SESSION_TTL_HOURS=168`).

```bash
curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "ops@platform.com", "password": "..."}'
```

```json
{
  "token": "BuX1iAv3pV3P...",
  "user": { "id": 1, "email": "ops@platform.com", "org_name": "Platform X" }
}
```

`401` on unknown email, wrong password, or deactivated user.

---

### `GET /auth/me` · `POST /auth/logout`

Return the current user / end the session. Both require `Authorization: Bearer <token>`.

```bash
curl -s http://localhost:8080/auth/me -H "Authorization: Bearer $TOKEN"
# {"id": 1, "email": "ops@platform.com", "org_name": "Platform X"}
curl -s -X POST http://localhost:8080/auth/logout -H "Authorization: Bearer $TOKEN"
```

---

### `GET /auth/keys` · `POST /auth/keys` · `DELETE /auth/keys/{id}`

Manage the logged-in user's API keys (session auth only). `POST` returns the plaintext key
exactly once; `DELETE` revokes (only your own keys; `404` otherwise).

```bash
curl -s http://localhost:8080/auth/keys -H "Authorization: Bearer $TOKEN"
# [{"id": 1, "name": "prod", "prefix": "hgk_SjoCDJxe", "created_at": "...",
#   "last_used_at": "...", "revoked_at": null}]

curl -s -X POST http://localhost:8080/auth/keys \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name": "staging"}'
# {"key": {...}, "api_key": "hgk_..."}   <- store api_key now; never shown again

curl -s -X DELETE http://localhost:8080/auth/keys/2 -H "Authorization: Bearer $TOKEN"
```

---

### `GET /stats/overview`

Per-user classification counts from the prediction log — the source of the dashboard's
Post Statistics cards.

**Query:** `language` — `igbo` or `yoruba` (default `igbo`)

```bash
curl -s "http://localhost:8080/stats/overview?language=igbo" -H "X-API-Key: $KEY"
```

```json
{ "language": "igbo", "total": 4, "normal": 3, "abuse": 1, "hate": 0 }
```

Counts only rows logged with the caller's `user_id`; pre-auth rows (user_id NULL) are excluded.

---

### `GET /predictions`

The authenticated user's own processed texts (from the prediction log) in the same shape as
`GET /posts`. Powers the dashboard's Triage Queue, Explainability picker, and Reports.

**Query:**

| Param | Description |
|-------|-------------|
| `language` | `igbo` or `yoruba` (default `igbo`) |
| `limit` | Max rows, 1–5000 (default `500`, newest first) |
| `offset` | Skip N matching rows for pagination (default `0`) |
| `label` | Comma-separated label filter, e.g. `label=Hate,Abuse` (invalid values → `422`) |
| `hate_min` / `hate_max` | Hate-probability range filter, 0.0–1.0 (e.g. `hate_min=0.4&hate_max=0.6` for borderline review) |

Filters are applied in SQL **before** the limit, so matching rows outside the newest-500
window still appear.

```bash
curl -s "http://localhost:8080/predictions?language=igbo&label=Hate,Abuse" -H "X-API-Key: $KEY"
```

```json
[
  {
    "id": "pred_5",
    "tweet": "text the user submitted via /predict",
    "label": "Abuse",
    "label_id": 1,
    "language": "igbo",
    "split": "single",
    "length": 45,
    "predicted_label": "Abuse",
    "predicted_label_id": 1,
    "probabilities": { "normal": 0.46, "abuse": 0.54, "hate": 0.0001 },
    "flagged": false,
    "triage_status": "new",
    "timestamp": "2026-08-27T20:52:46+00:00"
  }
]
```

Notes: ids are `pred_<prediction id>`; `label` mirrors `predicted_label` (no ground truth for
user submissions); `split` is the call source (`single`/`batch`); `timestamp` is the processing time.

---

### `POST /predictions/{id}/flag` · `POST /predictions/{id}/triage`

Flag (`status=reported`) or set triage status (`new`/`reviewed`/`reported`) on one of the
caller's own predictions. `404` for unknown ids, malformed ids, or another user's prediction.

```bash
curl -s -X POST http://localhost:8080/predictions/pred_5/flag -H "X-API-Key: $KEY"
curl -s -X POST http://localhost:8080/predictions/pred_5/triage \
  -H "X-API-Key: $KEY" -H 'Content-Type: application/json' -d '{"status": "reviewed"}'
```

---

### `GET /predictions/wordcloud` · `GET /predictions/clusters` · `GET /predictions/incidents.csv` · `GET /predictions/toxic-terms`

Per-user variants of the test-set analytics, computed from the caller's own Hate/Abuse
predictions. Same response shapes as `/posts/wordcloud`, `/analytics/clusters`, and
`/reports/incidents.csv` (clusters returns `[]` until enough Hate/Abuse rows exist).

`toxic-terms` ranks words by **model-measured toxicity**: each candidate word is removed
from each Hate/Abuse post (leave-one-out, newest 80 posts, `TOXIC_TERMS_MAX_POSTS`) and the
post re-classified; `contribution` = drop in toxic probability per occurrence,
`value` = contribution × count. Returns `[{text, value, count, contribution}]`, cached
in-memory per user+language until new toxic predictions arrive.

```bash
curl -s "http://localhost:8080/predictions/wordcloud?language=igbo" -H "X-API-Key: $KEY"
curl -s "http://localhost:8080/predictions/toxic-terms?language=igbo" -H "X-API-Key: $KEY"
curl -s "http://localhost:8080/predictions/clusters?language=igbo" -H "X-API-Key: $KEY"
curl -s "http://localhost:8080/predictions/incidents.csv?language=igbo&start=2026-08-01" -H "X-API-Key: $KEY"
```

---

### `GET /metrics`

Return evaluation metrics from `test_metrics.json` (local path or Hugging Face repo).

**Query:** `language` — `igbo` or `yoruba` (default `igbo`)

**Handler:** `main.py` lines 83–88 · **Logic:** `metrics_service.py`

```bash
curl -s "http://localhost:8080/metrics?language=igbo"
```

```json
{
  "accuracy": 0.877,
  "macro_precision": 0.84,
  "macro_recall": 0.883,
  "macro_f1": 0.86,
  "weighted_precision": 0.881,
  "weighted_recall": 0.877,
  "weighted_f1": 0.878,
  "mcc": 0.734,
  "support": 717.0,
  "per_class": {
    "Normal": { "precision": 0.759, "recall": 0.806, "f1": 0.782, "support": 180.0 },
    "Abuse": { "precision": 0.928, "recall": 0.898, "f1": 0.913, "support": 500.0 },
    "Hate": { "precision": 0.833, "recall": 0.946, "f1": 0.886, "support": 37.0 }
  },
  "confusion_matrix": [[145, 34, 1], [45, 449, 6], [1, 1, 35]],
  "classification_report": { "...": "..." },
  "roc_auc_ovr": null
}
```

---

### `POST /predict`

Classify one text. Result is logged to SQLite for volume/drift/alerts.

**Body:** `{ "text": string (1–5000 chars), "language": "igbo" | "yoruba" }`

**Handler:** `main.py` lines 91–129 · **Logic:** `model_service.py`, `db.py`

```bash
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"example post text","language":"igbo"}'
```

```json
{
  "predicted_label": "Normal",
  "probabilities": {
    "normal": 0.92,
    "abuse": 0.05,
    "hate": 0.03
  },
  "model_id": "chingsley/afro-xlmr-igbo-hate",
  "language": "igbo",
  "used_fallback": false
}
```

`used_fallback` is `true` when the per-language model is missing and the joint model is used instead.

---

### `POST /predict/batch`

Classify up to 256 texts in one request. Each result is logged to SQLite.

**Body:** `{ "texts": string[], "language": "igbo" | "yoruba" }`

**Handler:** `main.py` lines 132–179 · **Logic:** `model_service.py`, `db.py`

```bash
curl -s http://localhost:8080/predict/batch \
  -H 'Content-Type: application/json' \
  -d '{"texts":["first post","second post"],"language":"igbo"}'
```

```json
{
  "results": [
    {
      "text": "first post",
      "predicted_label": "Normal",
      "probabilities": { "normal": 0.88, "abuse": 0.08, "hate": 0.04 }
    },
    {
      "text": "second post",
      "predicted_label": "Abuse",
      "probabilities": { "normal": 0.02, "abuse": 0.95, "hate": 0.03 }
    }
  ],
  "model_id": "chingsley/afro-xlmr-igbo-hate",
  "language": "igbo",
  "used_fallback": false
}
```

---

### `GET /posts`

List test-set posts with model predictions and triage state (shared model-evaluation view —
the dashboard uses the per-user `GET /predictions` instead; this endpoint remains for
inspecting the model's test set).

**Query:** `language` — `igbo` or `yoruba` (default `igbo`)

**Data source:** `predictions_test.csv` (local `PREDICTIONS_PATH_*` or Hugging Face repo)

**Handler:** `main.py` lines 185–190 · **Logic:** `posts_service.py`, `db.py`

```bash
curl -s "http://localhost:8080/posts?language=igbo" | head -c 800
```

```json
[
  {
    "id": "test_igbo_00001",
    "tweet": "example tweet text",
    "label": "Abuse",
    "label_id": 1,
    "language": "igbo",
    "split": "test",
    "length": 131,
    "predicted_label": "Abuse",
    "predicted_label_id": 1,
    "probabilities": {
      "normal": 0.003,
      "abuse": 0.996,
      "hate": 0.001
    },
    "flagged": false,
    "triage_status": "new",
    "timestamp": ""
  }
]
```

---

### `POST /posts/{post_id}/flag`

Flag a post and set triage status to `reported`.

**Handler:** `main.py` lines 193–198 · **Logic:** `posts_service.py`, `db.py`

```bash
curl -s -X POST http://localhost:8080/posts/test_igbo_00001/flag
```

Returns the updated post object (same shape as one item from `GET /posts`).

---

### `POST /posts/{post_id}/triage`

Update triage status for a post.

**Body:** `{ "status": "new" | "reviewed" | "reported" }`

**Handler:** `main.py` lines 201–208 · **Logic:** `posts_service.py`, `db.py`

```bash
curl -s -X POST http://localhost:8080/posts/test_igbo_00001/triage \
  -H 'Content-Type: application/json' \
  -d '{"status":"reviewed"}'
```

Returns the updated post object. Status `reported` also sets `flagged: true`.

---

### `GET /posts/wordcloud`

Top word frequencies from posts predicted as Hate or Abuse.

**Query:** `language` — `igbo` or `yoruba` (default `igbo`)

**Handler:** `main.py` lines 211–216 · **Logic:** `analytics_service.py`

```bash
curl -s "http://localhost:8080/posts/wordcloud?language=igbo"
```

```json
[
  { "text": "stupid", "value": 42 },
  { "text": "idiot", "value": 38 }
]
```

---

### `GET /analytics/volume`

Prediction counts per hour from real `/predict` and `/predict/batch` usage (SQLite log).

**Query:** `hours` — integer 1–168 (default `24`)

**Handler:** `main.py` lines 219–221 · **Logic:** `analytics_service.py`, `db.py`

```bash
curl -s "http://localhost:8080/analytics/volume?hours=24&language=igbo" -H "X-API-Key: $KEY"
```

```json
[
  {
    "hour": "2026-08-27T15:00",
    "normal_count": 3,
    "abuse_count": 1,
    "hate_count": 0,
    "total": 4
  }
]
```

Only the authenticated user's predictions are counted. Optional `language=igbo|yoruba` filters
to one language; omit it for all languages combined.

---

### `GET /analytics/drift`

Average class probabilities per day from the prediction log (authenticated user's rows only).

**Query:** `days` — integer 1–365 (default `30`); optional `language` — `igbo` or `yoruba`

**Handler:** `main.py` lines 224–226 · **Logic:** `analytics_service.py`, `db.py`

```bash
curl -s "http://localhost:8080/analytics/drift?days=7&language=igbo" -H "X-API-Key: $KEY"
```

```json
[
  {
    "date": "2026-08-27",
    "normal_avg_confidence": 0.71,
    "abuse_avg_confidence": 0.18,
    "hate_avg_confidence": 0.11
  }
]
```

---

### `GET /analytics/clusters`

Group Hate/Abuse posts into TF-IDF + KMeans clusters.

**Query:** `language` — `igbo` or `yoruba` (default `igbo`)

**Handler:** `main.py` lines 229–236 · **Logic:** `analytics_service.py`

```bash
curl -s "http://localhost:8080/analytics/clusters?language=igbo"
```

```json
[
  {
    "cluster_id": 0,
    "size": 120,
    "representative_text": "example cluster center tweet",
    "posts": [
      {
        "id": "test_igbo_00042",
        "tweet": "example tweet",
        "predicted_label": "Hate",
        "probabilities": { "normal": 0.01, "abuse": 0.04, "hate": 0.95 },
        "triage_status": "new",
        "flagged": false
      }
    ]
  }
]
```

Each cluster includes up to 20 posts. Full post objects match `GET /posts` fields.

---

### `GET /alerts`

List alerts derived from the authenticated user's recent prediction activity. New alerts are
generated on each call.

**Handler:** `main.py` lines 239–241 · **Logic:** `analytics_service.py`, `db.py`

```bash
curl -s http://localhost:8080/alerts -H "X-API-Key: $KEY"
```

```json
[
  {
    "id": "u1_volume_spike_2026-08-27T16",
    "type": "volume_spike",
    "message": "Hate post volume spike: 45 posts detected in the last hour",
    "severity": "medium",
    "timestamp": "2026-08-27T16:30:00+00:00",
    "read": false
  },
  {
    "id": "u1_hate_threshold_2026-08-27T16:15:00_abc12345",
    "type": "hate_threshold",
    "message": "High-confidence hate detected (92%): example text…",
    "severity": "high",
    "timestamp": "2026-08-27T16:15:00+00:00",
    "read": false
  }
]
```

Alert types: `volume_spike`, `hate_threshold`, `model_drift`. Ids are prefixed with `u<user_id>_`.

---

### `POST /alerts/{alert_id}/read`

Mark one of your own alerts as read.

**Handler:** `main.py` lines 244–248 · **Logic:** `db.py`

```bash
curl -s -X POST http://localhost:8080/alerts/u1_volume_spike_2026-08-27T16/read -H "X-API-Key: $KEY"
```

```json
{
  "status": "ok"
}
```

---

### `POST /explain`

Token-level explanations for a classification. Runs the selected XAI methods against the loaded model.

**Body:**

```json
{
  "text": "string (1–5000 chars)",
  "language": "igbo" | "yoruba",
  "methods": ["lime", "shap", "attention_rollout", "integrated_gradients"],
  "post_id": "optional-id-for-caching"
}
```

If `methods` is omitted, all four methods are attempted. Missing optional deps return per-method errors inside the payload.

**Performance:** the selected methods run concurrently on a thread pool
(`EXPLAIN_MAX_WORKERS`, default 4), and responses are cached content-addressed on
`(language, methods, text)` — an identical request returns instantly. Tune cost with
`EXPLAIN_LIME_SAMPLES` (default 200; LIME runs twice for the stability metric) and
`EXPLAIN_IG_STEPS` (default 32). See `project_documentation/thesis/explainability-performance-architecture.md`
for the design and measurements.

**Handler:** `main.py` (`/explain`) · **Logic:** `explain_service.py`, `model_service.py`

```bash
curl -s http://localhost:8080/explain \
  -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"text":"example post","language":"igbo","methods":["shap"]}'
```

```json
{
  "id": "adhoc_a1b2c3d4",
  "label": "Abuse",
  "text": "example post",
  "methods": {
    "shap": {
      "method": "shap",
      "tokens": ["example", "post"],
      "scores": [0.12, -0.05],
      "predicted_label": "Abuse"
    }
  },
  "metrics": {
    "shap_sufficiency": 0.81,
    "cross_method_agreement": 0.0
  }
}
```

When a method fails (e.g. SHAP not installed):

```json
{
  "methods": {
    "shap": {
      "method": "shap",
      "error": "missing dependency: shap is required for SHAP explanations"
    }
  }
}
```

Install optional deps: `pip install "numpy>=1.26,<2" -r requirements-explain.txt`

---

### `GET /reports/incidents.csv`

Download a CSV of posts with triage status `reported`.

**Query:**

| Param | Description |
|-------|-------------|
| `language` | `igbo` or `yoruba` (default `igbo`) |
| `start` | Optional ISO date filter (`YYYY-MM-DD`) on reported date |
| `end` | Optional ISO date filter (`YYYY-MM-DD`) on reported date |

**Handler:** `main.py` lines 270–279 · **Logic:** `analytics_service.py`

```bash
curl -s "http://localhost:8080/reports/incidents.csv?language=igbo&start=2026-08-01&end=2026-08-31"
```

```csv
id,tweet,label,predicted_label,hate_probability,flagged,reported_date
test_igbo_00001,example tweet,Abuse,Abuse,0.001,true,2026-08-27
```

---

## Data sources summary

| Endpoint group | Primary source |
|----------------|----------------|
| `/predict`, `/predict/batch` | Live model inference (Hugging Face or local checkpoint) |
| `/metrics` | `test_metrics.json` (local or Hugging Face) |
| `/posts`, word cloud, clusters | `predictions_test.csv` (local or Hugging Face) |
| `/analytics/volume`, `/analytics/drift`, `/alerts` | SQLite prediction log (`DASHBOARD_DB_PATH`, default `dashboard.db`) |
| Triage / flag | SQLite triage table merged into post responses |

---

## Related guides

- [run-dashboard.md](./run-dashboard.md) — start backend + frontend together
- [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) — publish model, metrics, and predictions CSV
- [backend_api_server/README.md](../backend_api_server/README.md) — deployment and environment variables
