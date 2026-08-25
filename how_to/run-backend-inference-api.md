# Run the backend inference API

The FastAPI service in `backend_api_server/` loads your fine-tuned checkpoint and exposes HTTP endpoints for the dashboard.

Labels: **Normal**, **Abuse**, **Hate** (same as training).

## Prerequisites

You need **one** model source configured:

| Source | Set in `.env` | How to get it |
|--------|---------------|---------------|
| Hugging Face (recommended) | `HF_MODEL_ID=yourusername/repo` | [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) |
| Local checkpoint | `MODEL_PATH=/path/to/checkpoint` | [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md) |

Recommended starting model: **`afro_xlmr_joint`** (joint Igbo + Yoruba training).

## Setup (Mac)

```bash
cd /Users/kingsleyeneja/Downloads/Dalhousie_MCS_courses/thesis/kc_train/backend_api_server

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
```

Edit `.env` — **example A: Hugging Face**

```env
HF_MODEL_ID=yourusername/afro-xlmr-joint-igbo-yoruba-hate
MODEL_PATH=
INFERENCE_DEVICE=auto
CORS_ORIGINS=http://localhost:5173
```

**Example B: local copy**

```env
HF_MODEL_ID=
MODEL_PATH=../model_training/runs/afro_xlmr_joint/joint_igbo_yoruba
INFERENCE_DEVICE=cpu
CORS_ORIGINS=http://localhost:5173
```

Use `cpu` on Mac if no CUDA GPU; use `auto` or `cuda` on the lab server.

## Start the server

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

API docs: [http://localhost:8080/docs](http://localhost:8080/docs)

## Test endpoints

**Health**

```bash
curl -s http://localhost:8080/health | python -m json.tool
```

**Single prediction**

```bash
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"example post text","language":"igbo"}' | python -m json.tool
```

**Batch**

```bash
curl -s http://localhost:8080/predict/batch \
  -H 'Content-Type: application/json' \
  -d '{"texts":["first post","second post"],"language":"yoruba"}' | python -m json.tool
```

Expected response shape:

```json
{
  "predicted_label": "Normal",
  "probabilities": {
    "normal": 0.85,
    "abuse": 0.10,
    "hate": 0.05
  },
  "model_id": "..."
}
```

`language` is accepted for future per-model routing; the joint model uses one weight set for both Igbo and Yoruba.

## Run on the lab server (optional)

Useful for GPU inference or keeping the Mac free:

```bash
ssh pcl
cd ~/thesis-hasoc-model-training   # or sync backend_api_server there
source kc_train_venv/bin/activate
pip install fastapi uvicorn python-dotenv pydantic-settings

export MODEL_PATH=$(ls -td runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1)
export INFERENCE_DEVICE=cuda
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Exposing port 8080 to your Mac may require VPN, firewall rules, or SSH tunnel:

```bash
# On Mac — forward remote 8080 to local 8080
ssh -L 8080:localhost:8080 pcl
```

Then call `http://localhost:8080` on your Mac.

## Connect the frontend (next step)

The dashboard currently uses **mock data** in `frontend_dashboard/src/lib/api/client.ts`.

To wire real inference, point API calls to:

```
POST http://localhost:8080/predict
```

with body `{ "text": "...", "language": "igbo" | "yoruba" }`.

Explanation (LIME/SHAP) is **not** in this API yet — only classification.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Set HF_MODEL_ID or MODEL_PATH` | Configure `.env` |
| `MODEL_PATH does not look like a HuggingFace checkpoint` | Path must contain `config.json` or a timestamp subfolder with it |
| Slow first request | Model loading on startup; wait for `/health` to return `ok` |
| OOM on Mac | Use smaller model or `INFERENCE_DEVICE=cpu` with one model loaded |
| HF download fails | Check `HF_TOKEN` if repo is private: `huggingface-cli login` |

## Related

- Upload model: [upload-model-to-huggingface.md](./upload-model-to-huggingface.md)
- Copy checkpoints: [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md)
- Server access: [login-ssh-terminal.md](./login-ssh-terminal.md)
