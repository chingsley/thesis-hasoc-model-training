# Run the dashboard (backend + frontend)

Start the FastAPI inference API and the React dashboard. Use **two terminals**.

Set `REPO` to your clone path (examples use the lab server):

```bash
export REPO=/path/to/thesis-hasoc-model-training
```

| Service | Port | URL (after port forward) |
|---------|------|---------------------------|
| Backend (FastAPI) | 8080 | http://localhost:8080/health |
| Frontend (Vite) | 5173 | http://localhost:5173 |

The frontend proxies API calls to the backend (`/api` → `localhost:8080`). You only need to open **5173** in the browser if both run on the same machine.

## Prerequisites (one-time)

`kc_train_venv/` and `runs/` are **not in git** (see `.gitignore`). After `git clone`, create the venv and install deps:

```bash
cd "$REPO"

# Python 3.10+ required. Creates kc_train_venv/ locally — not committed.
python3 -m venv kc_train_venv
source kc_train_venv/bin/activate

pip install -r backend_api_server/requirements.txt
```

On the **lab server only**, if you want to reuse the shared system PyTorch install:

```bash
python3 -m venv --system-site-packages kc_train_venv
```

**Hugging Face** — models are private repos. On a new machine, authenticate before starting the backend:

```bash
export HF_TOKEN=hf_...   # https://huggingface.co/settings/tokens (read access)
# or: huggingface-cli login
```

**Backend config** — copy and edit if needed:

```bash
cp backend_api_server/.env.example backend_api_server/.env
```

Required vars (defaults in `.env.example`):

```env
HF_MODEL_ID_IGBO=chingsley/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=chingsley/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=chingsley/afro-xlmr-joint-igbo-yoruba-hate
METRICS_PATH_IGBO=../runs/afro_xlmr_base/igbo/20260515_143652/test_metrics.json
METRICS_PATH_YORUBA=../runs/afro_xlmr_base/yoruba/20260515_153329/test_metrics.json
CORS_ORIGINS=http://localhost:5173
INFERENCE_DEVICE=auto
```

Models must be on Hugging Face: [upload-model-to-huggingface.md](./upload-model-to-huggingface.md).

**Metrics files** — `METRICS_PATH_*` in `.env` point at `runs/.../test_metrics.json`, which is also not in git. Classification still works without them; the **Performance** page needs those files (copy from the lab or adjust paths in `.env`).

**Frontend** — Node 20 via nvm, then install deps:

```bash
source ~/.bashrc
nvm install 20    # once
nvm use 20

cd "$REPO/frontend_dashboard"
cp .env.example .env    # VITE_USE_MOCK=false
npm install
```

If Vite fails after switching Node versions:

```bash
rm -rf node_modules package-lock.json && npm install
```

## Every session

### Terminal 1 — backend

```bash
cd "$REPO/backend_api_server"
source ../kc_train_venv/bin/activate
python -m uvicorn app.main:app --reload --port 8080
```

You **must** be inside `backend_api_server/` — running from the repo root causes `ModuleNotFoundError: No module named 'app'`.

Wait until startup finishes (loads Igbo, Yoruba, and joint models — can take a few minutes).

Check:

```bash
curl -s http://localhost:8080/health | python3 -m json.tool
```

### Terminal 2 — frontend

```bash
source ~/.bashrc && nvm use 20
cd "$REPO/frontend_dashboard"
npm run dev
```

Wait for: `Local: http://localhost:5173/`

## Open the dashboard in your browser

### Cursor / VS Code Remote SSH

1. Bottom panel → **Ports**
2. Forward port **5173**
3. Click **Open in Browser** on port 5173

Backend port 8080 does not need forwarding — Vite proxies to it locally.

### SSH from your laptop (no Remote SSH)

On your **laptop**:

```bash
ssh -L 5173:localhost:5173 -L 8080:localhost:8080 enejak@persuasive.research.cs.dal.ca
```

Open **http://localhost:5173**

## What is live vs mock

| Page / feature | Data source |
|----------------|-------------|
| **Testing** (single + batch classify) | Live API |
| **Performance** (metrics) | Live API (`/metrics?language=...`) |
| Overview, Triage, Analysis, Reports, Explainability | Mock (amber badge) |

Switch **Igbo / Yoruba** in the header — predictions and metrics use the matching model. Header shows active `model_id`.

## Quick API test (optional)

```bash
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"example text","language":"igbo"}' | python3 -m json.tool
```

Response includes `model_id` and `used_fallback` (should be `false` when per-language models load).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: No module named 'app'` | Run uvicorn from `backend_api_server/`, not repo root |
| `Set HF_MODEL_ID or MODEL_PATH` | Edit `backend_api_server/.env`; restart backend |
| `kc_train_venv/bin/activate: No such file` | Run `python3 -m venv kc_train_venv` in repo root (see Prerequisites) |
| HF 401 / model not found | `export HF_TOKEN=...` or `huggingface-cli login`; need access to private repos |
| Performance page errors | `runs/` not in git — copy `test_metrics.json` or fix `METRICS_PATH_*` in `.env` |
| Frontend Vite / rolldown error | `nvm use 20`, then reinstall `node_modules` |
| Classification failed in Testing | Backend not running on 8080 |
| Slow backend startup | Normal — three models loading from HF |
| Mock data everywhere | Set `VITE_USE_MOCK=false` in `frontend_dashboard/.env` |

## Related

- [upload-model-to-huggingface.md](./upload-model-to-huggingface.md)
- [run-gradio-model-tester.md](./run-gradio-model-tester.md) — standalone paste-and-test UI (no dashboard)
- [open-project-remote-ssh.md](./open-project-remote-ssh.md)
