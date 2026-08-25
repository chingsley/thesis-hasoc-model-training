# Backend API server

FastAPI inference service for the fine-tuned hate-speech classifiers.

## Deployment options

| Approach | Best for | Notes |
|----------|----------|-------|
| **Hugging Face Hub + this API** (recommended) | Thesis demo, Mac dev, lab GPU | Upload checkpoint once; backend loads via `HF_MODEL_ID`. Private repos supported. Already implemented. |
| **Local checkpoint only (`MODEL_PATH`)** | Air-gapped lab server | No upload; point `MODEL_PATH` at `runs/.../<timestamp>/`. |
| **HF Inference Endpoints** | Managed GPU, no server ops | Pay-per-use hosted inference; you'd replace `ModelService` with HTTP calls to HF's endpoint. Overkill unless you need auto-scaling. |
| **AWS SageMaker / GCP Vertex** | Production at scale | Heavy setup; not needed for a thesis dashboard. |

**Per-language routing (v0.2):** The dashboard language selector (`igbo` / `yoruba`) picks the matching model. Configure `HF_MODEL_ID_IGBO`, `HF_MODEL_ID_YORUBA`, and optionally `HF_MODEL_ID_JOINT` (fallback only).

| Repo | Role |
|------|------|
| `afro-xlmr-igbo-hate` | Used when dashboard language = **Igbo** |
| `afro-xlmr-yoruba-hate` | Used when dashboard language = **Yoruba** |
| `afro-xlmr-joint-igbo-yoruba-hate` | **Fallback** if a language model is missing; not selected from the UI. Also use `GET /metrics?language=joint` to view joint eval metrics. |

**Model choice:** Per-language specialists outperform the joint model on test macro-F1 (Igbo ≈ 0.86, Yoruba ≈ 0.67, joint ≈ 0.73).

## End-to-end workflow

### 1. Upload checkpoint to Hugging Face (on the lab server)

```bash
cd ~/thesis-hasoc-model-training
source kc_train_venv/bin/activate
pip install huggingface-hub

export HF_TOKEN=hf_...   # https://huggingface.co/settings/tokens

# Best Igbo model (macro-F1 ≈ 0.86)
CHECKPOINT=$(ls -td runs/afro_xlmr_base/igbo/* | head -1)
python backend_api_server/scripts/upload_to_hf.py \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-igbo-hate \
  --private

# Optional: Yoruba model (macro-F1 ≈ 0.64–0.67)
CHECKPOINT=$(ls -td runs/afro_xlmr_base/yoruba/* | head -1)
python backend_api_server/scripts/upload_to_hf.py \
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

METRICS_PATH_IGBO=../runs/afro_xlmr_base/igbo/20260515_143652/test_metrics.json
METRICS_PATH_YORUBA=../runs/afro_xlmr_base/yoruba/20260515_153329/test_metrics.json
METRICS_PATH_JOINT=../runs/afro_xlmr_joint/joint_igbo_yoruba/20260515_151540/test_metrics.json
```

Restart the API after changing `.env`. All configured models load at startup (~3× GPU RAM if using CUDA).

Start:

```bash
uvicorn app.main:app --reload --port 8080
```

Test:

```bash
curl -s http://localhost:8080/health | python -m json.tool
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"example post text","language":"igbo"}' | python -m json.tool
curl -s http://localhost:8080/metrics | python -m json.tool
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

## API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Loaded model ids per language + device |
| `GET /metrics?language=igbo\|yoruba\|joint` | Test-set metrics for that model |
| `POST /predict` | Single text classification |
| `POST /predict/batch` | Up to 256 texts |

`language` in predict requests selects the **Igbo** or **Yoruba** model. Joint is fallback only (not sent from the dashboard dropdown).

## What's still mock-only in the dashboard

Posts, triage queue, drift/volume charts, clusters, alerts, and explainability highlighting require additional backend work (database, analytics, `/explain` endpoint). See `todo.md`.
