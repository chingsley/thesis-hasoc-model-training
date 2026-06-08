#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# run_explain_all.sh — generate XAI explanations for ALREADY-TRAINED models.
#
# Runs LIME, SHAP, attention rollout, and Captum integrated gradients on a
# class-balanced sample of each fine-tuned single-language test set. This does
# NOT retrain anything: it loads the saved checkpoints and runs inference only,
# so it finishes in minutes, not hours.
#
# Quick start (on the server, inside JupyterHub Terminal):
#
#   tmux new -s explain
#   cd /data/disk1/$USER/thesis-hasoc-model-training
#   ./run_explain_all.sh
#
#   # detach so it keeps running after you close the browser:
#   #   Ctrl+b   then   d
#   # reattach later:
#   #   tmux attach -t explain
#
# Overrides (optional):
#   CUDA_VISIBLE_DEVICES=0 ./run_explain_all.sh   # use the other GPU
#   NUM_ROWS=20            ./run_explain_all.sh   # explain more rows per run
#   VENV_DIR=/path/to/venv ./run_explain_all.sh   # use a non-default venv
#
# What this script does:
#   1. Activates kc_train_venv (which inherits the shared /usr/local/env torch).
#   2. Pins HuggingFace caches and the GPU to use.
#   3. FAIL-FAST: aborts immediately if lime / shap / captum are missing.
#   4. Explains the 6 single-language runs (3 models x igbo/yoruba).
#   5. Rebuilds the aggregate + explainability reports once at the end.
#   6. Streams progress to stdout AND to logs/explain_<UTC timestamp>.log.
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

NUM_ROWS="${NUM_ROWS:-12}"

if [[ -z "${TMUX:-}" ]]; then
  echo "WARNING: not running inside tmux. If you close this terminal, the job will die." >&2
  echo "         Recommended: 'tmux new -s explain', then re-run this script inside it." >&2
fi

mkdir -p logs
STAMP="$(date -u +%Y%m%d_%H%M%S)"
LOG="logs/explain_${STAMP}.log"
echo "Master log: $LOG"

{
  echo "=== Explanation run started $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
  echo "Project root         : $SCRIPT_DIR"
  echo "Venv                 : $VENV_DIR"
  echo "CUDA_VISIBLE_DEVICES : $CUDA_VISIBLE_DEVICES"
  echo "Rows per run         : $NUM_ROWS"
  echo

  echo "=== Fail-fast dependency check ==="
  python - <<'PY'
import importlib.util
import sys

required = ["lime", "shap", "captum", "torch", "transformers"]
missing = [name for name in required if importlib.util.find_spec(name) is None]
if missing:
    sys.exit(
        "MISSING DEPENDENCIES: " + ", ".join(missing) +
        "\nInstall with: pip install -r requirements-modeling-explain.txt"
    )
import torch
print("dependencies OK | cuda available:", torch.cuda.is_available())
PY

  # Explain each single-language run. --no-report defers report rebuilding to a
  # single pass at the end (faster than rebuilding after every run).
  for RUN_NAME in xlm_roberta_base afro_xlmr_base afriberta_large; do
    for LANG in igbo yoruba; do
      echo
      echo "=== explain: ${RUN_NAME} | ${LANG} ==="
      python -m modeling.scripts.run_explain \
          --latest --run-name "${RUN_NAME}" --lang "${LANG}" \
          --num-rows "${NUM_ROWS}" --no-report
    done
  done

  echo
  echo "=== Rebuilding aggregate + explainability reports ==="
  python -m modeling.scripts.run_eval --aggregate-only

  echo
  echo "=== Explanation run finished $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
} 2>&1 | tee "$LOG"
