#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run_all.sh — full Phase 2 fine-tuning pipeline on the lab GPU server.
#
# Quick start (on the server, inside JupyterHub Terminal):
#
#   tmux new -s train
#   cd /data/disk1/$USER/thesis-hasoc-model-training
#   ./run_all.sh
#
#   # detach so it keeps running after you close the browser:
#   #   Ctrl+b   then   d
#   # reattach later:
#   #   tmux attach -t train
#
# Overrides (optional):
#   CUDA_VISIBLE_DEVICES=0 ./run_all.sh   # use the other GPU
#   VENV_DIR=/path/to/venv ./run_all.sh   # use a non-default venv
#
# What this script does:
#   1. Activates kc_train_venv (which inherits the shared /usr/local/env torch).
#   2. Pins HuggingFace caches and the GPU to use.
#   3. Sanity-checks CUDA + the SMOKE_TEST flag before training.
#   4. Runs all 9 fine-tuning jobs sequentially (one model at a time, single GPU).
#   5. Streams progress to stdout AND to logs/training_<UTC timestamp>.log.
# ------------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="${VENV_DIR:-$SCRIPT_DIR/kc_train_venv}"
if [[ ! -f "$VENV_DIR/bin/activate" ]]; then
  echo "ERROR: venv not found at $VENV_DIR" >&2
  echo "       Create it with: python -m venv --system-site-packages $VENV_DIR" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

export TOKENIZERS_PARALLELISM=false
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-1}"
export HF_HOME="${HF_HOME:-/data/disk1/$USER/hf_cache}"
export HF_DATASETS_CACHE="${HF_DATASETS_CACHE:-$HF_HOME/datasets}"
mkdir -p "$HF_HOME" "$HF_DATASETS_CACHE"

if [[ -z "${TMUX:-}" ]]; then
  echo "WARNING: not running inside tmux. If you close this terminal, training will die." >&2
  echo "         Recommended: 'tmux new -s train', then re-run this script inside it." >&2
fi

mkdir -p logs
STAMP="$(date -u +%Y%m%d_%H%M%S)"
LOG="logs/training_${STAMP}.log"
echo "Master log: $LOG"

{
  echo "=== Pipeline started $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
  echo "Project root         : $SCRIPT_DIR"
  echo "Venv                 : $VENV_DIR"
  echo "CUDA_VISIBLE_DEVICES : $CUDA_VISIBLE_DEVICES"
  echo "HF_HOME              : $HF_HOME"
  echo

  echo "=== GPU snapshot ==="
  nvidia-smi --query-gpu=index,name,memory.total,memory.used,utilization.gpu --format=csv || true
  echo

  echo "=== Sanity checks ==="
  python - <<'PY'
import torch
from modeling.runtime_mode import effective_smoke

print("torch          :", torch.__version__)
print("torch built w/ :", torch.version.cuda)
print("cuda available :", torch.cuda.is_available())
print("device         :", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "<none>")
print("smoke mode     :", effective_smoke())
assert torch.cuda.is_available(), "CUDA not available -- fix before training"
assert not effective_smoke(), "SMOKE_TEST is on -- set SMOKE_TEST = False in modeling/runtime_mode.py"
PY

  echo
  echo "=== [1/9] xlm-roberta-base | igbo ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/xlmr_base.yaml --lang igbo --full

  echo
  echo "=== [2/9] xlm-roberta-base | yoruba ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/xlmr_base.yaml --lang yoruba --full

  echo
  echo "=== [3/9] afro-xlmr-base | igbo ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afroxlmr_base.yaml --lang igbo --full

  echo
  echo "=== [4/9] afro-xlmr-base | yoruba ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afroxlmr_base.yaml --lang yoruba --full

  echo
  echo "=== [5/9] afriberta-large | igbo ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afriberta_large.yaml --lang igbo --full

  echo
  echo "=== [6/9] afriberta-large | yoruba ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afriberta_large.yaml --lang yoruba --full

  echo
  echo "=== [7/9] joint igbo + yoruba ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/joint_igbo_yoruba.yaml --full

  echo
  echo "=== [8/9] cross-lingual: train igbo, test yoruba ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afroxlmr_base.yaml \
      --train-lang igbo --test-lang yoruba --full

  echo
  echo "=== [9/9] cross-lingual: train yoruba, test igbo ==="
  python -m modeling.scripts.run_finetune \
      --config modeling/configs/afroxlmr_base.yaml \
      --train-lang yoruba --test-lang igbo --full

  echo
  echo "=== Pipeline finished $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
} 2>&1 | tee "$LOG"
