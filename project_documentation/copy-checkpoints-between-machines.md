# Copy model checkpoints between server and Mac

**When to use this:** You want to run inference **locally** without Hugging Face — fast iteration on your Mac, or you cannot upload to HF yet.

**Alternative:** Upload once to Hugging Face — [upload-model-to-huggingface.md](./upload-model-to-huggingface.md).

## Checkpoint layout on the server

```text
~/thesis-hasoc-model-training/runs/
  afro_xlmr_joint/
    joint_igbo_yoruba/
      20260514_123456/    ← actual checkpoint (config.json, model.safetensors, …)
  xlm_roberta_base/
    igbo/
      <timestamp>/
    yoruba/
      <timestamp>/
```

Find the newest joint checkpoint:

```bash
ssh pcl 'ls -td ~/thesis-hasoc-model-training/runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1'
```

## Copy server → Mac (`rsync`)

From your **Mac** (requires `pcl` in `~/.ssh/config` — see [login-ssh-terminal.md](./login-ssh-terminal.md)):

```bash
# Copy entire joint model family (all timestamps — can be large)
rsync -avz --progress \
  pcl:~/thesis-hasoc-model-training/runs/afro_xlmr_joint/joint_igbo_yoruba/ \
  /Users/kingsleyeneja/Downloads/Dalhousie_MCS_courses/thesis/kc_train/model_training/runs/afro_xlmr_joint/joint_igbo_yoruba/

# Or copy only the latest timestamp folder
LATEST=$(ssh pcl 'ls -td ~/thesis-hasoc-model-training/runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1')
rsync -avz --progress "pcl:${LATEST}/" \
  ./model_training/runs/afro_xlmr_joint/joint_igbo_yoruba/latest/
```

Check size before copying (checkpoints are often **1–3 GB+** per run):

```bash
ssh pcl 'du -sh ~/thesis-hasoc-model-training/runs/afro_xlmr_joint/joint_igbo_yoruba/*'
```

## Copy Mac → server

```bash
rsync -avz --progress \
  ./model_training/some_file.py \
  pcl:~/thesis-hasoc-model-training/modeling/
```

## Use copied checkpoint in the backend

In `backend_api_server/.env` on your Mac:

```env
HF_MODEL_ID=
MODEL_PATH=../model_training/runs/afro_xlmr_joint/joint_igbo_yoruba
INFERENCE_DEVICE=cpu
```

The API auto-picks the **newest timestamp subfolder** if `MODEL_PATH` points at the language folder and has no `config.json` at that level.

Or point directly at one checkpoint:

```env
MODEL_PATH=../model_training/runs/afro_xlmr_joint/joint_igbo_yoruba/20260514_123456
```

Then [run-backend-inference-api.md](./run-backend-inference-api.md).

## Copy vs Hugging Face

| Approach | Pros | Cons |
|----------|------|------|
| **rsync / scp** | No HF account; full control; works offline | Large transfers; manual sync after each retrain |
| **Hugging Face** | One upload; `pip`/`from_pretrained` everywhere; version history | Needs token; model hosted on HF |

For thesis **development** on one Mac: `rsync` is fine.

For **demo / deployment / sharing** with the frontend team: Hugging Face is cleaner.

## Optional: free disk on server before copying

Optuna trial folders and epoch checkpoints are safe to delete if you only need the final model:

```bash
# On server — preview first
du -sh ~/thesis-hasoc-model-training/runs/tmp_optuna 2>/dev/null
find ~/thesis-hasoc-model-training/runs -type d -name 'checkpoint-*' -exec du -sh {} + | head
```

## Related

- SSH setup: [login-ssh-terminal.md](./login-ssh-terminal.md)
- HF upload: [upload-model-to-huggingface.md](./upload-model-to-huggingface.md)
- Run API: [run-backend-inference-api.md](./run-backend-inference-api.md)
