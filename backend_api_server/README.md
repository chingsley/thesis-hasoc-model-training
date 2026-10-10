# Backend API server

FastAPI inference service for the fine-tuned hate-speech classifiers.

## Deployment options

| Approach | Best for | Notes |
|----------|----------|-------|
| **Hugging Face Hub + this API** (recommended) | Thesis demo, Mac dev, lab GPU | Upload checkpoint once; backend loads via `HF_MODEL_ID`. Private repos supported. Already implemented. |
| **Local checkpoint only (`MODEL_PATH`)** | Air-gapped lab server | No upload; point `MODEL_PATH` at `runs/.../<timestamp>/`. |
| **HF Inference Endpoints** | Managed GPU, no server ops | Pay-per-use hosted inference; you'd replace `ModelService` with HTTP calls to HF's endpoint. Overkill unless you need auto-scaling. |
| **AWS SageMaker / GCP Vertex** | Production at scale | Heavy setup; not needed for a thesis dashboard. |

**Per-language routing (v0.2):** The dashboard language selector (`igbo` / `yoruba`) picks the matching model. Configure `HF_MODEL_ID_IGBO`, `HF_MODEL_ID_YORUBA`, and optionally `HF_MODEL_ID_JOINT` (fallback only). After retraining, keep the original Hub IDs and add `HF_MODEL_ID_*_MERGED`; switch families with `HF_MODEL_SET=original|merged` and restart the API.

| Repo | Role |
|------|------|
| `afro-xlmr-igbo-hate` | Used when dashboard language = **Igbo** |
| `afro-xlmr-yoruba-hate` | Used when dashboard language = **Yoruba** |
| `afro-xlmr-joint-igbo-yoruba-hate` | **Fallback** if a language model is missing; not selected from the UI. Also use `GET /metrics?language=joint` to view joint eval metrics. |

**Model choice:** Per-language specialists outperform the joint model on test macro-F1 (Igbo ≈ 0.86, Yoruba ≈ 0.67, joint ≈ 0.73).

## End-to-end workflow

### 1. Upload checkpoint to Hugging Face (on the lab server)

```bash
cd ~/thesis-hasoc-model-training/model_training
source ../kc_train_venv/bin/activate
pip install huggingface-hub

export HF_TOKEN=hf_...   # https://huggingface.co/settings/tokens

# Best Igbo model (macro-F1 ≈ 0.86)
CHECKPOINT=$(ls -td runs/afro_xlmr_base/igbo/* | head -1)
python -m modeling.scripts.publish_to_hf \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-igbo-hate \
  --private

# Optional: Yoruba model (macro-F1 ≈ 0.64–0.67)
CHECKPOINT=$(ls -td runs/afro_xlmr_base/yoruba/* | head -1)
python -m modeling.scripts.publish_to_hf \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-yoruba-hate \
  --private
```

Checkpoint layout:

```text
runs/afro_xlmr_base/igbo/<timestamp>/
  config.json
  model.safetensors
  tokenizer.json
  test_metrics.json
  ...
```

### 2. Run the backend

```bash
cd backend_api_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```bash
HF_MODEL_ID_IGBO=yourusername/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=yourusername/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=yourusername/afro-xlmr-joint-igbo-yoruba-hate

# Optional local overrides; if unset, /metrics downloads test_metrics.json
# from the same HF repo as the model (modeling.scripts.publish_to_hf pushes it there).
# METRICS_PATH_IGBO=../runs/afro_xlmr_base/igbo/20260515_143652/test_metrics.json
# METRICS_PATH_YORUBA=../runs/afro_xlmr_base/yoruba/20260515_153329/test_metrics.json
# METRICS_PATH_JOINT=../runs/afro_xlmr_joint/joint_igbo_yoruba/20260515_151540/test_metrics.json
```

Restart the API after changing `.env`. All configured models load at startup (~3× GPU RAM if using CUDA).

Start:

```bash
uvicorn app.main:app --reload --port 8080
```

Create the first dashboard user (admin-only CLI; see **Authentication** below):

```bash
python scripts/create_user.py --email you@example.com --org "Your Platform" --key-name prod
```

Test:

```bash
curl -s http://localhost:8080/health | python -m json.tool
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: hgk_...' \
  -d '{"text":"example post text","language":"igbo"}' | python -m json.tool
curl -s http://localhost:8080/metrics -H 'X-API-Key: hgk_...' | python -m json.tool
```

### 3. Run the frontend (connected to backend)

```bash
cd frontend_dashboard
npm install
cp .env.example .env    # VITE_USE_MOCK=false by default
npm run dev
```

Vite proxies `/api/*` → `http://localhost:8080/*`. Open **Testing** and **Performance** pages for live predictions and eval metrics.

Set `VITE_USE_MOCK=true` in `.env` to use mock data without a backend.

## Authentication & organization-scoped data

**Database:**

- **PostgreSQL** — set `DATABASE_URL` (or `POSTGRES_URL`) in `.env` (Neon, Vercel Postgres, local Docker).
  Connect with **Postico** using the same URL. Tables are created on first API start.
- **SQLite** (default when `DATABASE_URL` is unset) — file `dashboard.db` in this folder (`DASHBOARD_DB_PATH` to override).

The **dashboard UI** can deploy to Vercel; this **FastAPI + PyTorch API** needs a separate host (Railway, Fly.io,
Render, a VM, etc.) because of model size and cold-start limits. Point the UI at that API and use a hosted Postgres
both can reach.

**API key admins:** only emails in `API_KEY_ADMIN_EMAILS` (default `user1@test.com`) can create/revoke keys in Settings.
Other users can still use the dashboard; integrators use keys an admin creates via Settings or `scripts/create_user.py`.

Every endpoint except `GET /health` requires credentials:

- **API key** (machine clients): header `X-API-Key: hgk_...`. Keys belong to an **organization** (not a single
  human user). The plaintext key is shown once at creation; only a SHA-256 hash is stored. Keys can be revoked
  from Settings in the dashboard.
- **Session token** (dashboard): `POST /auth/login` → `Authorization: Bearer <token>` (`SESSION_TTL_HOURS`, default 168).

**Onboarding (no public signup):**

```bash
# Immediate account + optional org API key
python scripts/create_user.py --email ops@platform.com --org "Platform X" --key-name prod

# Invite-only: whitelist email + default password; account created on first login
python scripts/invite_user.py --email reviewer@partner.com --org "Partner Org"
```

**Dashboard (Settings → Team invites):** users listed in `INVITE_ADMIN_EMAILS` (default: same as
`API_KEY_ADMIN_EMAILS`) can invite by email into **their** organization; the API returns a one-time
temporary password to copy and share.

**Platform admins** (`PLATFORM_ADMIN_EMAILS`, default `platform@test.com` from seed) can create
organizations, switch the active org from the header, and invite users to any org. Demo login:
`platform@test.com` / `Password123@` (after seed).

Invited users must change their password before using the dashboard (`POST /auth/change-password`).

Demo seed (prints API keys once per new user):

```bash
python scripts/seed_demo_data.py --reset-db
```

Every `/predict` call is logged with **organization_id** (and user_id for audit). Dashboard and API analytics
(`/stats/overview`, `/predictions*`, `/analytics/*`, `/alerts`) show data for the **caller's organization** —
teammates in the same org see the same triage queue and volume charts.
Dashboard Testing Tools calls are attributed to the logged-in user the same way.
The older `/posts*` endpoints serve the shared model test set (evaluation view) and remain
available, but the dashboard no longer uses them.

## API

Full reference with curl examples and sample responses: **[project_documentation/backend-api-reference.md](../project_documentation/backend-api-reference.md)**.

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | public | Loaded model ids per language + device |
| `POST /auth/login` | public | Email + password → session token (invite-first login supported) |
| `POST /auth/change-password` | session | Set new password (required after invite) |
| `POST /auth/logout` / `GET /auth/me` | session | End session / current user info |
| `GET/POST /auth/keys`, `DELETE /auth/keys/{id}` | session | List / create / revoke **organization** API keys |
| `GET /stats/overview?language=` | key or session | Per-organization classification counts |
| `GET /predictions?language=` | key or session | Organization prediction log as posts |
| `POST /predictions/{id}/flag` / `POST /predictions/{id}/triage` | key or session | Flag/triage one of the caller's predictions |
| `GET /predictions/wordcloud?language=` | key or session | Toxic-term frequencies from the caller's Hate/Abuse texts |
| `GET /predictions/toxic-terms?language=` | key or session | Words ranked by model-measured toxicity (leave-one-out) |
| `GET /predictions/clusters?language=` | key or session | TF-IDF + KMeans clusters of the caller's Hate/Abuse texts |
| `GET /predictions/incidents.csv?language=&start=&end=` | key or session | CSV of the caller's reported predictions |
| `GET /metrics?language=igbo\|yoruba\|joint` | key or session | Test-set metrics for that model |
| `POST /predict` | key or session | Single text classification (logged per user) |
| `POST /predict/batch` | key or session | Up to 256 texts (logged per user) |
| `GET /posts?language=` | key or session | Test-set posts with predictions + triage state (evaluation view) |
| `POST /posts/{id}/flag` | key or session | Flag a test-set post and mark it reported |
| `POST /posts/{id}/triage` | key or session | Set test-set triage status (`new`/`reviewed`/`reported`) |
| `GET /posts/wordcloud?language=` | key or session | Toxic-term frequencies from test-set posts |
| `GET /analytics/volume?hours=&language=` | key or session | Per-user prediction volume per hour |
| `GET /analytics/drift?days=&language=` | key or session | Per-user avg confidence per label per day |
| `GET /analytics/clusters?language=` | key or session | TF-IDF + KMeans clusters of test-set Hate/Abuse posts |
| `GET /alerts` / `POST /alerts/{id}/read` | key or session | Per-user alerts derived from prediction logs |
| `POST /explain` | key or session | LIME/SHAP/attention-rollout/IG token attributions (needs `requirements-explain.txt`) |
| `GET /reports/incidents.csv?language=&start=&end=` | key or session | CSV export of reported test-set posts |

`language` in predict requests selects the **Igbo** or **Yoruba** model. Joint is fallback only (not sent from the dashboard dropdown).

## Live data sources

- **Models, metrics, posts** — Hugging Face repos (`HF_MODEL_ID_*`), cached in `~/.cache/huggingface`. `python -m modeling.scripts.publish_to_hf` ships `test_metrics.json` and `predictions_test.csv` alongside the checkpoint.
- **Triage state, prediction logs, alerts, users, API keys, sessions** — local SQLite file (`DASHBOARD_DB_PATH`, default `backend_api_server/dashboard.db`; git-ignored). Volume/drift charts and overview stats reflect **real per-user API usage** and fill in as predictions are made.

## XAI dependencies (optional)

`/explain` works out of the box with attention rollout only. For LIME/SHAP/integrated-gradients:

```bash
pip install "numpy>=1.26,<2" -r requirements-explain.txt
```

Keep `numpy<2` and `shap<0.47` together — newer shap requires NumPy 2, which breaks torch 2.2.2 on Intel Mac. Missing deps degrade gracefully to per-method errors in the payload.

## Mock mode

Every dashboard feature is served live by this API. The frontend keeps a `VITE_USE_MOCK=true` mode for offline UI development only; in that mode the dashboard shows **MOCK** badges. Live mode has no source badge.
