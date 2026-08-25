from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def _read_metrics_file(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _resolve_metrics_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if path.is_file():
        return path
    if path.is_dir():
        candidate = path / "test_metrics.json"
        if candidate.is_file():
            return candidate
        raise FileNotFoundError(f"No test_metrics.json under {path}")
    raise FileNotFoundError(f"Metrics path not found: {path}")


def load_metrics(language: str | None = None) -> dict[str, Any]:
    lang = (language or "igbo").strip().lower()
    metrics_path = os.getenv(f"METRICS_PATH_{lang.upper()}", "").strip()
    if not metrics_path:
        metrics_path = os.getenv("METRICS_PATH", "").strip()

    if not metrics_path:
        raise FileNotFoundError(
            f"Set METRICS_PATH_{lang.upper()} or legacy METRICS_PATH for language={lang}."
        )

    return _read_metrics_file(_resolve_metrics_path(metrics_path))
