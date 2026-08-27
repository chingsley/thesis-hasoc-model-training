# Run the Gradio model tester (paste text → classify)

Browser UI to test your fine-tuned classifiers (Normal / Abuse / Hate) without the full dashboard or backend API.

**This guide uses Gradio on the lab server**, not a Hugging Face Space. HF Gradio Spaces require a [PRO subscription](https://huggingface.co/pro) (402 Payment Required on free accounts).

## What you get

- Text box + model dropdown (Igbo / Yoruba / Joint)
- Loads weights from your **private** Hugging Face model repos
- Runs in `kc_train_venv` on the server; you open it in a browser via port forwarding

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Models on Hugging Face | `chingsley/afro-xlmr-igbo-hate`, `chingsley/afro-xlmr-yoruba-hate`, `chingsley/afro-xlmr-joint-igbo-yoruba-hate` (private is fine) |
| Upload models first | [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) |
| Project on server | `/home/enejak/thesis-hasoc-model-training` |
| Python venv | `kc_train_venv/` in project root |
| HF token | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) with read access |

## One-time setup (server)

```bash
cd /home/enejak/thesis-hasoc-model-training
source kc_train_venv/bin/activate

# Gradio UI (install once; do not reinstall on every run)
pip install 'gradio>=5,<7'

# If you see: huggingface-hub>=0.34.0,<1.0 is required but found 1.x
pip install -U 'transformers>=5'
```

Log in to Hugging Face once (optional if you always use `HF_TOKEN`):

```bash
huggingface-cli login
```

## Every time you want to test

### 1. Start Gradio on the server

```bash
cd /home/enejak/thesis-hasoc-model-training
source kc_train_venv/bin/activate
export HF_TOKEN=hf_...    # required for private models

bash hf_spaces/run_local.sh
```

Wait until you see:

```text
Running on local URL:  http://127.0.0.1:7860
```

**Leave this terminal open.** Ctrl+C stops the tester.

### 2. Open the UI in your browser

#### If you use Cursor / VS Code Remote SSH (recommended)

You are already on the server in the IDE. **Do not** run `ssh -L` from a server terminal to `persuasive-computing-lab` — that SSHs the server to itself and does not forward ports to your laptop.

1. In Cursor: bottom panel → **Ports** tab
2. **Forward a Port** → enter `7860`
3. Click the globe / “Open in Browser” link for port 7860

#### If you use a terminal on your laptop (not Remote SSH)

Run this **on your Mac/laptop**, not on the server:

```bash
ssh -L 7860:localhost:7860 enejak@persuasive.research.cs.dal.ca
```

Keep that session open. In your laptop browser: **http://localhost:7860**

### 3. Classify text

1. Paste Igbo or Yoruba text
2. Choose **Model**: Igbo, Yoruba, or Joint
3. Click **Submit**

Example output:

```text
Model: chingsley/afro-xlmr-yoruba-hate

Predicted: Abuse (87.3%)

All classes:
  Abuse: 87.3%
  Normal: 10.2%
  Hate: 2.5%
```

First submit per model loads weights (may take ~30–60 seconds).

## Project files (reference)

```text
hf_spaces/
  run_local.sh                 ← start script (run from repo root)
  hate-speech-tester/
    app.py                     ← Gradio app + model IDs
    requirements.txt           ← for HF Space upload only (not used by run_local.sh)
    README.md
```

Model IDs are set in `hf_spaces/hate-speech-tester/app.py` under `MODELS`.

## Verify models without the UI (optional)

From `model_training/` with venv active:

```bash
cd /home/enejak/thesis-hasoc-model-training/model_training
source ../kc_train_venv/bin/activate

python3 -c "
from modeling.trainer import predict_texts
from modeling.data import LABELS
import pandas as pd
from sklearn.metrics import f1_score

df = pd.read_csv('dataset/igbo_test.csv')
out = predict_texts('chingsley/afro-xlmr-igbo-hate', df['tweet'].tolist())
preds = [LABELS[i] for i in out['predictions']]
print('Igbo test macro-F1:', round(f1_score(df['label'], preds, average='macro'), 4))
"
```

Expected Igbo macro-F1 ≈ **0.860**.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Set HF_TOKEN first` | `export HF_TOKEN=hf_...` before `run_local.sh` |
| `Install gradio once` | `pip install 'gradio>=5,<7'` in `kc_train_venv` |
| `huggingface-hub` version conflict | `pip install -U 'transformers>=5'` |
| Browser: “localhost refused to connect” | Gradio not running, or port 7860 not forwarded (use **Ports** tab in Cursor) |
| Gradio shows **Error** on Submit | Restart after pulling latest `app.py` (pipeline output parsing fix) |
| `402 Payment Required` on `deploy_space.py` | Use `run_local.sh` instead; HF Spaces need PRO |

## Related guides

- [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) — upload checkpoints before testing
- [run-backend-inference-api.md](./run-backend-inference-api.md) — FastAPI + dashboard Testing page (alternative to Gradio)
