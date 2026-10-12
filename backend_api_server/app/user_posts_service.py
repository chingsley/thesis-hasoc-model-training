"""Organization-scoped posts from the prediction log.

Source of truth: the `predictions` table (rows logged by /predict and /predict/batch
with the caller's organization_id). Post ids are `pred_<prediction id>`; triage state
is stored under `o<organization_id>_pred_<prediction id>` so teammates share triage.

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


def _triage_key(organization_id: int, prediction_id: int) -> str:
    return f"o{organization_id}_pred_{prediction_id}"


def _row_to_post(
    row: dict[str, Any], triage: dict[str, dict[str, Any]], organization_id: int
) -> dict[str, Any]:
    pred = row["predicted_label"]
    state = triage.get(_triage_key(organization_id, row["id"]))
    relabelled = bool(int(row.get("relabelled") or 0))
    initial = row.get("initial_model_prediction")
    return {
        "id": f"pred_{row['id']}",
        "tweet": row["text"],
        "label": pred,
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
        "triage_status": db.normalize_triage_status(state["status"]) if state else "pending",
        "relabelled": relabelled,
        "initial_model_prediction": initial if relabelled and initial else None,
        "reviewer_id": row.get("reviewer_user_id") if relabelled else None,
        "reviewed_at": row.get("reviewed_at") if relabelled else None,
        "timestamp": row["ts"],
    }


def list_org_posts(
    organization_id: int,
    language: str,
    limit: int = MAX_USER_POSTS,
    offset: int = 0,
    hate_min: float | None = None,
    hate_max: float | None = None,
    labels: list[str] | None = None,
    model_labels: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = db.org_prediction_rows(
        organization_id,
        language,
        limit,
        offset,
        hate_min=hate_min,
        hate_max=hate_max,
        labels=labels,
        model_labels=model_labels,
    )
    triage = db.get_triage_state(
        [_triage_key(organization_id, row["id"]) for row in rows]
    )
    return [_row_to_post(row, triage, organization_id) for row in rows]


def get_org_post(organization_id: int, prediction_id: int) -> dict[str, Any] | None:
    row = db.get_prediction_for_org(prediction_id, organization_id)
    if row is None:
        return None
    triage = db.get_triage_state([_triage_key(organization_id, prediction_id)])
    return _row_to_post(row, triage, organization_id)


def apply_org_triage(
    organization_id: int,
    prediction_id: int,
    *,
    flagged: bool | None = None,
    status: str | None = None,
) -> dict[str, Any] | None:
    post = get_org_post(organization_id, prediction_id)
    if post is None:
        return None
    state = db.upsert_triage(
        _triage_key(organization_id, prediction_id), flagged=flagged, status=status
    )
    post["flagged"] = bool(state["flagged"])
    post["triage_status"] = db.normalize_triage_status(state["status"])
    return post


def relabel_org_post(
    organization_id: int,
    prediction_id: int,
    label: str,
    reviewer_user_id: int,
    bucket: str | None = None,
) -> dict[str, Any] | None:
    if get_org_post(organization_id, prediction_id) is None:
        return None
    row = db.relabel_org_prediction(organization_id, prediction_id, label, reviewer_user_id)
    if row is None:
        return None
    if bucket == "flagged":
        db.upsert_triage(
            _triage_key(organization_id, prediction_id), flagged=True, status="flagged"
        )
    triage = db.get_triage_state([_triage_key(organization_id, prediction_id)])
    return _row_to_post(row, triage, organization_id)


def org_reported_posts(organization_id: int, language: str) -> list[dict[str, Any]]:
    posts = list_org_posts(organization_id, language, limit=5000)
    return [post for post in posts if post["triage_status"] == "flagged"]


def triage_stats(organization_id: int, language: str) -> dict[str, dict[str, int]]:
    return db.org_triage_stats(organization_id, language)


def list_triage_bucket_posts(
    organization_id: int,
    language: str,
    bucket: str,
    limit: int,
    offset: int,
    *,
    label: str | None = None,
    q: str | None = None,
    since: str | None = None,
    until: str | None = None,
    hate_min: float | None = None,
    hate_max: float | None = None,
) -> tuple[list[dict[str, Any]], int]:
    rows, total = db.org_triage_posts_page(
        organization_id,
        language,
        bucket,
        limit,
        offset,
        label=label,
        q=q,
        since=since,
        until=until,
        hate_min=hate_min,
        hate_max=hate_max,
    )
    triage = db.get_triage_state(
        [_triage_key(organization_id, row["id"]) for row in rows]
    )
    items = [_row_to_post(row, triage, organization_id) for row in rows]
    return items, total
