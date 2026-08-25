#!/usr/bin/env bash
# Run the Gradio tester on the server (free — no HF PRO needed).
# From your laptop, open: http://localhost:7860
#   ssh -L 7860:localhost:7860 enejak@<server-host>

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/hf_spaces/hate-speech-tester"
source "$ROOT/kc_train_venv/bin/activate"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "Set HF_TOKEN first (needed for private models): export HF_TOKEN=hf_..."
  exit 1
fi

# Gradio is optional; do not pip install here (it can upgrade huggingface-hub and break transformers).
if ! python -c "import gradio" 2>/dev/null; then
  echo "Install gradio once: pip install 'gradio>=5,<7'"
  exit 1
fi

echo "Starting Gradio on http://127.0.0.1:7860"
echo ""
echo "If you use Cursor/VS Code Remote SSH:"
echo "  1. Keep this terminal running"
echo "  2. Open the Ports tab (bottom panel) → Forward port 7860"
echo "  3. Open the forwarded URL in your browser"
echo ""
echo "If you use a local terminal on your laptop:"
echo "  ssh -L 7860:localhost:7860 $(whoami)@$(hostname -f 2>/dev/null || hostname)"
python app.py
