#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# publish_v2.sh — publish the merged-dataset winners to NEW Hugging Face repos.
#
# Quick start:
#
#   cd /data/disk1/$USER/thesis-hasoc-model-training/model_training
#   ./publish_v2.sh --dry-run     # show what would be uploaded, touch nothing
#   ./publish_v2.sh               # upload for real (~1.1 GB per model)
#
# The three checkpoints below are the best macro-F1 per language in
# reports/modeling_results.md. Re-run run_all.sh and edit the paths if you
# retrain. Everything goes to *-v2-merged repos, so the v1 repos and their
# local downloads under $HF_HOME are never touched.
#
# Credentials: uses your `hf auth login` token, or HF_TOKEN if exported.
# ------------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=0
case "${1:-}" in
  "")         ;;
  --dry-run)  DRY_RUN=1 ;;
  # Refuse anything else: a typo like --dryrun must not fall through to a
  # real 3.4 GB upload.
  *) echo "usage: $(basename "$0") [--dry-run]" >&2; exit 2 ;;
esac

if [[ -n "${VENV_DIR:-}" ]]; then
  :
elif [[ -n "${VIRTUAL_ENV:-}" && -f "${VIRTUAL_ENV}/bin/activate" ]]; then
  VENV_DIR="$VIRTUAL_ENV"
elif [[ -f "$SCRIPT_DIR/kc_train_venv/bin/activate" ]]; then
  VENV_DIR="$SCRIPT_DIR/kc_train_venv"
elif [[ -f "$SCRIPT_DIR/../kc_train_venv/bin/activate" ]]; then
  VENV_DIR="$SCRIPT_DIR/../kc_train_venv"
else
  echo "ERROR: no venv found (checked \$VENV_DIR, \$VIRTUAL_ENV, ./kc_train_venv, ../kc_train_venv)" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$(cd "$VENV_DIR" && pwd)/bin/activate"

export HF_HOME="${HF_HOME:-/data/disk1/$USER/hf_cache}"

# checkpoint dir <TAB> target repo. Keep the -v2-merged suffix: reusing a v1 ID
# would overwrite the model you are comparing against.
JOBS=(
  "runs/afro_xlmr_base/igbo/20260909_072214|chingsley/afro-xlmr-igbo-hate-v2-merged|igbo macro-F1 0.8398"
  "runs/afro_xlmr_base/yoruba/20260909_080237|chingsley/afro-xlmr-yoruba-hate-v2-merged|yoruba macro-F1 0.6076"
  "runs/afro_xlmr_joint/joint_igbo_yoruba/20260909_091234|chingsley/afro-xlmr-joint-igbo-yoruba-hate-v2-merged|joint macro-F1 0.7256"
)

echo "=== Preflight ==="
for job in "${JOBS[@]}"; do
  CKPT="${job%%|*}"
  for required in config.json model.safetensors tokenizer.json test_metrics.json predictions_test.csv; do
    if [[ ! -f "$CKPT/$required" ]]; then
      echo "ERROR: $CKPT/$required is missing — refusing to publish an incomplete model." >&2
      exit 1
    fi
  done
  echo "  ok  $CKPT"
done

if [[ "$DRY_RUN" == "1" ]]; then
  echo
  echo "=== Dry run: nothing will be uploaded ==="
  for job in "${JOBS[@]}"; do
    CKPT="${job%%|*}"
    REST="${job#*|}"
    echo
    echo "--- ${REST#*|}"
    echo "    ${CKPT}"
    echo " -> https://huggingface.co/${REST%%|*}"
    python - "$CKPT" <<'PY'
import sys
from pathlib import Path
from modeling.scripts.publish_to_hf import _upload_preview

run = Path(sys.argv[1])
count, total = _upload_preview(run)
allfiles = [p for p in run.rglob("*") if p.is_file()]
allbytes = sum(p.stat().st_size for p in allfiles)
print("    would upload {0} file(s), {1:.2f} GB".format(count, total / 1e9))
print("    skipping {0} file(s), {1:.2f} GB of checkpoint-*/ training state".format(
    len(allfiles) - count, (allbytes - total) / 1e9))
PY
  done
  echo
  echo "Looks right? Re-run without --dry-run to upload."
  exit 0
fi

echo
echo "=== Publishing ${#JOBS[@]} models ==="
i=0
for job in "${JOBS[@]}"; do
  i=$((i + 1))
  CKPT="${job%%|*}"
  REST="${job#*|}"
  REPO="${REST%%|*}"
  echo
  echo "=== [$i/${#JOBS[@]}] ${REST#*|} ==="
  python -m modeling.scripts.publish_to_hf \
    --checkpoint "$CKPT" \
    --repo-id "$REPO" \
    --private
done

cat <<'EOF'

=== Done. Next: point the backend at them ===

  1. cd ../backend_api_server
  2. Edit .env and change exactly one line:

       HF_MODEL_SET=merged

  3. Restart the API (Ctrl+C the running uvicorn, then):

       uvicorn app.main:app --reload --port 8000

  4. Confirm which family is live:

       curl -s localhost:8000/health | python -m json.tool

     "model_set": "merged" and the *-v2-merged repo IDs mean the new models
     are serving. The first request downloads them (~1.1 GB each); the v1
     downloads stay cached, so switching back is instant.

  To go back to the old models: set HF_MODEL_SET=original and restart.
EOF
