# Backend API server

FastAPI inference service for the fine-tuned hate-speech classifiers.

## Recommended deployment path

1. **Upload the best checkpoint to Hugging Face Hub** (private repo) from the lab server.
2. **Run this API** on your Mac for development, or on the lab server if you need GPU inference.
3. **Point the frontend** at `http://localhost:8000` (or your server URL).

Start with the **joint Igbo + Yoruba** model (`afro_xlmr_joint`) unless per-language models perform better on your test metrics.

Checkpoint layout on the server:

```text
runs/afro_xlmr_joint/joint_igbo_yoruba/<timestamp>/
  config.json
  model.safetensors
  tokenizer.json
  ...
```

Find the newest run:

```bash
ls -td runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1
```

## Upload checkpoint to Hugging Face (on the server)

```bash
cd ~/thesis-hasoc-model-training
source kc_train_venv/bin/activate
pip install huggingface-hub

export HF_TOKEN=hf_...   # from https://huggingface.co/settings/tokens
CHECKPOINT=$(ls -td runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1)

python backend_api_server/scripts/upload_to_hf.py \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-joint-igbo-yoruba-hate \
  --private
```

Then set `HF_MODEL_ID=yourusername/afro-xlmr-joint-igbo-yoruba-hate` in `.env`.

## Local development (Mac)

```bash
cd backend_api_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Option A: pull from Hugging Face after upload
cp .env.example .env
# edit HF_MODEL_ID=...

# Option B: copy checkpoint from server first
# rsync -avz pcl:~/thesis-hasoc-model-training/runs/afro_xlmr_joint/joint_igbo_yoruba/ ./models/afro_xlmr_joint/
# edit MODEL_PATH=./models/afro_xlmr_joint

uvicorn app.main:app --reload --port 8080
```

Test:

```bash
curl -s http://localhost:8080/health | python -m json.tool
curl -s http://localhost:8080/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"example post text","language":"igbo"}' | python -m json.tool
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Model id and device |
| `POST /predict` | Single text classification |
| `POST /predict/batch` | Up to 256 texts |

`language` is accepted for future per-language routing; the joint model uses the same weights for both.
