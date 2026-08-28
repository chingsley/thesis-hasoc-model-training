"""Serves dataset posts with model predictions.

Source of truth: predictions_test.csv in each model's Hugging Face repo
(uploaded by scripts/upload_to_hf.py). Optional PREDICTIONS_PATH_<LANG> /
PREDICTIONS_PATH local overrides take precedence when the file exists —
same pattern as metrics_service.py.
"""

from __future__ import annotations

import csv
import logging
import os
from pathlib import Path
from typing import Any

from huggingface_hub import hf_hub_download

from . import db
from .model_service import LABELS

logger = logging.getLogger(__name__)

PREDICTIONS_FILENAME = "predictions_test.csv"

_cache: dict[str, list[dict[str, Any]]] = {}


def _resolve_local_csv(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if path.is_file():
        return path
    if path.is_dir():
        candidate = path / PREDICTIONS_FILENAME
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Predictions CSV not found: {raw_path}")


def _download_csv_from_hub(repo_id: str) -> Path:
    try:
        return Path(hf_hub_download(repo_id=repo_id, repo_type="model", filename=PREDICTIONS_FILENAME))
    except Exception as exc:
        raise FileNotFoundError(
            f"No {PREDICTIONS_FILENAME} in Hugging Face repo {repo_id}: {exc}"
        ) from exc


def _resolve_csv(language: str) -> Path:
    lang = language.strip().lower()
    local = os.getenv(f"PREDICTIONS_PATH_{lang.upper()}", "").strip() or os.getenv(
        "PREDICTIONS_PATH", ""
    ).strip()
    if local:
        try:
            return _resolve_local_csv(local)
        except FileNotFoundError as exc:
            logger.warning("Local predictions unavailable (%s); falling back to Hugging Face.", exc)

    repo_id = os.getenv(f"HF_MODEL_ID_{lang.upper()}", "").strip() or os.getenv(
        "HF_MODEL_ID", ""
    ).strip()
    if not repo_id:
        raise FileNotFoundError(
            f"Set PREDICTIONS_PATH_{lang.upper()} or HF_MODEL_ID_{lang.upper()} for language={lang}."
        )
    return _download_csv_from_hub(repo_id)


def _row_to_post(row: dict[str, str], language: str) -> dict[str, Any]:
    label = row["label"]
    pred = row["pred_label"]
    return {
        "id": row["id"],
        "tweet": row["tweet"],
        "label": label,
        "label_id": LABELS.index(label),
        "language": language,
        "split": row.get("split") or "test",
        "length": int(float(row.get("length") or len(row["tweet"]))),
        "predicted_label": pred,
        "predicted_label_id": LABELS.index(pred),
        "probabilities": {
            "normal": float(row["prob_normal"]),
            "abuse": float(row["prob_abuse"]),
            "hate": float(row["prob_hate"]),
        },
    }


def _load_posts(language: str) -> list[dict[str, Any]]:
    lang = language.strip().lower()
    if lang in _cache:
        return _cache[lang]

    csv_path = _resolve_csv(lang)
    with csv_path.open(encoding="utf-8", newline="") as handle:
        posts = [_row_to_post(row, lang) for row in csv.DictReader(handle)]

    triage = db.get_triage_state([post["id"] for post in posts])
    for post in posts:
        state = triage.get(post["id"])
        post["flagged"] = bool(state["flagged"]) if state else False
        post["triage_status"] = state["status"] if state else "pending"
        post["manual_label"] = state["manual_label"] if state else None
        post["timestamp"] = state["updated_at"] if state else ""

    _cache[lang] = posts
    logger.info("Loaded %d posts for language=%s from %s", len(posts), lang, csv_path)
    return posts


def get_posts(language: str) -> list[dict[str, Any]]:
    return [dict(post) for post in _load_posts(language)]


def get_post(post_id: str) -> dict[str, Any] | None:
    for lang in ("igbo", "yoruba"):
        try:
            for post in _load_posts(lang):
                if post["id"] == post_id:
                    return dict(post)
        except FileNotFoundError:
            continue
    return None


def apply_triage(
    post_id: str,
    *,
    flagged: bool | None = None,
    status: str | None = None,
) -> dict[str, Any] | None:
    post = get_post(post_id)
    if post is None:
        return None
    state = db.upsert_triage(post_id, flagged=flagged, status=status)
    post["flagged"] = bool(state["flagged"])
    post["triage_status"] = state["status"]
    post["manual_label"] = state["manual_label"]
    post["timestamp"] = state["updated_at"]
    for lang_posts in _cache.values():
        for cached in lang_posts:
            if cached["id"] == post_id:
                cached.update(post)
    return post


def reported_posts(language: str) -> list[dict[str, Any]]:
    flagged_ids = set(db.list_flagged_post_ids())
    return [post for post in get_posts(language) if post["id"] in flagged_ids]


def refresh_posts() -> None:
    _cache.clear()
