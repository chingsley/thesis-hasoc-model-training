# Upload a trained checkpoint to Hugging Face

**When to use this:** You want a stable, versioned model URL that any machine (Mac backend, CI, teammates) can load with `from_pretrained("your/repo")`. This is the **recommended deployment path** for the thesis backend.

**Alternative:** Copy files directly with `rsync` — [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md).

The publisher lives in `model_training` (`modeling/scripts/publish_to_hf.py` and
`publish_v2.sh`). The backend **never uploads** — it only reads `HF_MODEL_ID_*`
from the Hub.

---

## What to run

After retraining on the merged dataset, publish the three best checkpoints to
**new** `*-v2-merged` repos (do not overwrite the v1 repos you are comparing
against). Then switch the backend with one line in `.env`.

### 1. Upload to Hugging Face

On the training server:

```bash
cd ~/thesis-hasoc-model-training/model_training
./publish_v2.sh --dry-run   # print what would be uploaded; change nothing
./publish_v2.sh             # upload (~1.1 GB per model, ~3.4 GB total)
```

`publish_v2.sh` activates `kc_train_venv`, uses your existing `hf auth login`
token (or `HF_TOKEN` if exported), verifies each checkpoint is complete, skips
the intermediate `checkpoint-*/` training state (~20 GB on disk per run), and
uploads weights plus `test_metrics.json` and `predictions_test.csv`.

Checkpoints and target repos (best macro-F1 per language from
`reports/modeling_results.md`; edit the `JOBS` list in `publish_v2.sh` after a
retrain):

| Language | Checkpoint | Target repo | Macro-F1 |
| --- | --- | --- | --- |
| Igbo | `runs/afro_xlmr_base/igbo/20260909_072214` | `chingsley/afro-xlmr-igbo-hate-v2-merged` | 0.8398 |
| Yoruba | `runs/afro_xlmr_base/yoruba/20260909_080237` | `chingsley/afro-xlmr-yoruba-hate-v2-merged` | 0.6076 |
| Joint | `runs/afro_xlmr_joint/joint_igbo_yoruba/20260909_091234` | `chingsley/afro-xlmr-joint-igbo-yoruba-hate-v2-merged` | 0.7256 |

To publish a **single** model instead:

```bash
cd ~/thesis-hasoc-model-training/model_training
source ../kc_train_venv/bin/activate

python -m modeling.scripts.publish_to_hf \
  --checkpoint runs/afro_xlmr_base/igbo/20260909_072214 \
  --repo-id chingsley/afro-xlmr-igbo-hate-v2-merged \
  --private
```

Use `--private` for thesis work; omit for a public model.

### 2. Point the backend at the new models

In `backend_api_server/.env`, change **one line** (the `*_MERGED` repo IDs should
already be present):

```env
HF_MODEL_SET=merged
```

The v1 IDs stay in `.env` unchanged:

```env
HF_MODEL_ID_IGBO=chingsley/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=chingsley/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=chingsley/afro-xlmr-joint-igbo-yoruba-hate

HF_MODEL_ID_IGBO_MERGED=chingsley/afro-xlmr-igbo-hate-v2-merged
HF_MODEL_ID_YORUBA_MERGED=chingsley/afro-xlmr-yoruba-hate-v2-merged
HF_MODEL_ID_JOINT_MERGED=chingsley/afro-xlmr-joint-igbo-yoruba-hate-v2-merged
```

### 3. Restart the API

Models load at startup. Stop the running uvicorn (Ctrl+C), then:

```bash
cd ~/thesis-hasoc-model-training/backend_api_server
source ../kc_train_venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The first request downloads each v2 model (~1.1 GB) into the local HF cache.
v1 downloads stay cached separately, so switching back is instant.

### 4. Confirm which family is live

```bash
curl -s localhost:8000/health | python -m json.tool
```

Expect `"model_set": "merged"` and repo IDs ending in `-v2-merged` under
`models`. The dashboard header shows an **merged** badge when live.

To compare against v1 again: set `HF_MODEL_SET=original`, restart uvicorn, and
re-check `/health`.

---

## What gets uploaded

A Hugging Face **Trainer** run folder contains inference weights plus optional
evaluation artefacts:

```
config.json
model.safetensors
tokenizer.json
tokenizer_config.json
test_metrics.json          → backend GET /metrics
predictions_test.csv       → backend GET /posts and analytics
...
```

The intermediate **`checkpoint-<step>/`** folders the Trainer writes each epoch
are **not** uploaded. Each holds a full model copy plus optimizer state (~3 GB),
so a run folder is ~20 GB on disk while only ~1.1 GB is needed to serve the
model. The publisher prints the upload size before it starts.

Checkpoints live under timestamped folders:

```text
model_training/runs/<run_name>/<language>/<timestamp>/
```

Example:

```text
model_training/runs/afro_xlmr_joint/joint_igbo_yoruba/20260909_091234/
```

---

## Hugging Face credentials

**Publishing:** run `hf auth login` once (token saved under `$HF_HOME`), or
export `HF_TOKEN` for the current shell. On the lab server you are already
logged in as `chingsley`, so neither is needed for `./publish_v2.sh`.

**Backend downloads:** the model repos are private. The backend uses the same
saved `$HF_HOME` token automatically. Set `HF_TOKEN` in `backend_api_server/.env`
only when running somewhere without that token (systemd unit, container, etc.).

Create a write token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
if you need a fresh login.

---

## Find a checkpoint manually

```bash
cd ~/thesis-hasoc-model-training/model_training
ls -td runs/afro_xlmr_base/igbo/* | head -1
ls runs/
# afriberta_large  afro_xlmr_base  afro_xlmr_joint  xlm_roberta_base
```

Pick the run with the best test macro-F1 in `reports/modeling_results.md`.

---

## Re-upload and partial updates

### Full re-upload after another training run

Upload again to the same v2 repo (new commit) or edit `publish_v2.sh` to point at
new timestamps. Do **not** overwrite v1 repo IDs — that would destroy the model
you are comparing against.

### Refreshing only the artifacts

Retraining produces **new weights**, so the normal path is a full publish. Use
`--artifacts-only` only when the weights on the Hub are already current and just
an artifact is missing or changed (backfill, re-evaluate). It skips the ~1.1 GB
upload and does not create a repo:

```bash
cd ~/thesis-hasoc-model-training/model_training
source ../kc_train_venv/bin/activate

python -m modeling.scripts.publish_to_hf \
  --checkpoint runs/afro_xlmr_base/igbo/20260909_072214 \
  --repo-id chingsley/afro-xlmr-igbo-hate-v2-merged \
  --artifacts-only --artifact test_metrics.json
```

Do not push metrics from a newer run against older weights — the Hub repo would
report scores the served model cannot reproduce.

### Model cards

```bash
cd ~/thesis-hasoc-model-training/backend_api_server
HF_MODEL_SET=merged python scripts/upload_model_cards.py
```

Targets whichever repos `.env` resolves for the active model set.

---

## A/B comparison notes

- `/metrics`, `/posts`, `/predict`, and `/explain` all follow `HF_MODEL_SET`.
- Both families stay side-by-side in the local HF cache
  (`$HF_HOME/hub/models--<org>--<repo>/`, e.g. `/data/disk1/$USER/hf_cache/hub`
  on the lab server).
- v2 was trained on the merged dataset with the **same test split**, so v1 and v2
  `/metrics` numbers are directly comparable.
- Optional: tag the current v1 revision on the Hub before any experiment
  (`huggingface_hub.create_tag(repo_id, tag="v1-original")` or the repo web UI).

Workflow: record v1 numbers → `HF_MODEL_SET=merged` + restart → repeat → flip
back to `original` when done.

---

## Hugging Face vs copying checkpoints

| | Hugging Face upload | `rsync` copy |
|--|---------------------|--------------|
| Best for | Production, sharing, reproducibility | Quick local dev, no HF account |
| Backend config | `HF_MODEL_ID_*` + `HF_MODEL_SET` | `MODEL_PATH_*` |
| Needs internet at inference | Yes (first download) | No |
| Large file transfer | Once to HF; then pull anywhere | Every machine you develop on |

---

## Related

- Retrain workflow: [steps_to_retrain.md](./steps_to_retrain.md)
- Copy instead of upload: [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md)
- Run API: [run-backend-inference-api.md](./run-backend-inference-api.md)
- Dashboard: [run-dashboard.md](./run-dashboard.md)
