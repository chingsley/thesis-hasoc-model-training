from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from huggingface_hub import hf_hub_download

logger = logging.getLogger(__name__)

METRICS_FILENAME = "test_metrics.json"


def _read_metrics_file(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _resolve_metrics_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if path.is_file():
        return path
    if path.is_dir():
        candidate = path / METRICS_FILENAME
        if candidate.is_file():
            return candidate
        raise FileNotFoundError(f"No {METRICS_FILENAME} under {path}")
    raise FileNotFoundError(f"Metrics path not found: {path}")


def _download_metrics_from_hub(repo_id: str) -> Path:
    try:
        return Path(hf_hub_download(repo_id=repo_id, repo_type="model", filename=METRICS_FILENAME))
    except Exception as exc:
        raise FileNotFoundError(
            f"No {METRICS_FILENAME} in Hugging Face repo {repo_id}: {exc}"
        ) from exc


def load_metrics(language: str | None = None) -> dict[str, Any]:
    lang = (language or "igbo").strip().lower()

    # Local file/dir takes precedence when it exists (useful on the training machine).
    metrics_path = os.getenv(f"METRICS_PATH_{lang.upper()}", "").strip() or os.getenv(
        "METRICS_PATH", ""
    ).strip()
    if metrics_path:
        try:
            return _read_metrics_file(_resolve_metrics_path(metrics_path))
        except FileNotFoundError as exc:
            logger.warning("Local metrics unavailable (%s); falling back to Hugging Face.", exc)

    # Otherwise fetch test_metrics.json from the same HF repo that serves the model,
    # so deployed backends (Render/Vercel/etc.) need no access to the training server.
    repo_id = os.getenv(f"HF_MODEL_ID_{lang.upper()}", "").strip() or os.getenv(
        "HF_MODEL_ID", ""
    ).strip()
    if not repo_id:
        raise FileNotFoundError(
            f"Set METRICS_PATH_{lang.upper()} or HF_MODEL_ID_{lang.upper()} for language={lang}."
        )

    return _read_metrics_file(_download_metrics_from_hub(repo_id))
