"""Per-user posts: the authenticated user's own processed texts from the prediction log.

Source of truth: the `predictions` table (rows logged by /predict and /predict/batch
with the caller's user_id). Post ids are `pred_<prediction id>`; triage state is stored
in the shared triage table under namespaced keys `u<user_id>_pred_<prediction id>`.

There is no ground-truth label for user-submitted texts — `label` mirrors
`predicted_label` so the shape matches posts_service (test-set) posts.
"""

from __future__ import annotations

import re
from typing import Any

from . import db
from .model_service import LABELS

_pred_ref_re = re.compile(r"^pred_(\d+)$")

MAX_USER_POSTS = 500


def parse_pred_ref(post_ref: str) -> int | None:
    """`pred_123` -> 123, anything else -> None."""
    match = _pred_ref_re.match(post_ref.strip())
    return int(match.group(1)) if match else None


def _triage_key(user_id: int, prediction_id: int) -> str:
    return f"u{user_id}_pred_{prediction_id}"


def _row_to_post(row: dict[str, Any], triage: dict[str, dict[str, Any]], user_id: int) -> dict[str, Any]:
    pred = row["predicted_label"]
    state = triage.get(_triage_key(user_id, row["id"]))
    return {
        "id": f"pred_{row['id']}",
        "tweet": row["text"],
        "label": pred,  # no ground truth for user submissions
        "label_id": LABELS.index(pred),
        "language": row["language"],
        "split": row["source"],
        "length": len(row["text"]),
        "predicted_label": pred,
        "predicted_label_id": LABELS.index(pred),
        "probabilities": {
            "normal": row["prob_normal"],
            "abuse": row["prob_abuse"],
            "hate": row["prob_hate"],
        },
        "flagged": bool(state["flagged"]) if state else False,
        "triage_status": state["status"] if state else "pending",
        "manual_label": state["manual_label"] if state else None,
        "timestamp": row["ts"],
    }


def list_user_posts(
    user_id: int,
    language: str,
    limit: int = MAX_USER_POSTS,
    offset: int = 0,
    hate_min: float | None = None,
    hate_max: float | None = None,
    labels: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = db.user_prediction_rows(
        user_id, language, limit, offset, hate_min=hate_min, hate_max=hate_max, labels=labels
    )
    triage = db.get_triage_state([_triage_key(user_id, row["id"]) for row in rows])
    return [_row_to_post(row, triage, user_id) for row in rows]


def get_user_post(user_id: int, prediction_id: int) -> dict[str, Any] | None:
    row = db.get_prediction_for_user(prediction_id, user_id)
    if row is None:
        return None
    triage = db.get_triage_state([_triage_key(user_id, prediction_id)])
    return _row_to_post(row, triage, user_id)


def apply_user_triage(
    user_id: int,
    prediction_id: int,
    *,
    flagged: bool | None = None,
    status: str | None = None,
) -> dict[str, Any] | None:
    post = get_user_post(user_id, prediction_id)
    if post is None:
        return None
    state = db.upsert_triage(
        _triage_key(user_id, prediction_id), flagged=flagged, status=status
    )
    post["flagged"] = bool(state["flagged"])
    post["triage_status"] = state["status"]
    post["manual_label"] = state["manual_label"]
    return post


def relabel_user_post(
    user_id: int,
    prediction_id: int,
    manual_label: str,
    bucket: str | None = None,
) -> dict[str, Any] | None:
    """Record a manual label correction; optionally move to the cleared/flagged bucket.

    The post joins the relabelled view while manual_label != the model's predicted label;
    it keeps its bucket (cleared/flagged) regardless. Machine label is always recoverable
    from the immutable predictions row, so retraining pairs survive.
    """
    post = get_user_post(user_id, prediction_id)
    if post is None:
        return None
    state = db.upsert_triage(
        _triage_key(user_id, prediction_id),
        flagged=(bucket == "flagged") if bucket else None,
        status=bucket,
        manual_label=manual_label,
    )
    post["flagged"] = bool(state["flagged"])
    post["triage_status"] = state["status"]
    post["manual_label"] = state["manual_label"]
    return post


def user_reported_posts(user_id: int, language: str) -> list[dict[str, Any]]:
    posts = list_user_posts(user_id, language, limit=5000)
    return [post for post in posts if post["triage_status"] == "flagged"]
