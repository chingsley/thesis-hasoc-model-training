"""Map OpenAI Moderation API scores to HASOC Normal / Abuse / Hate labels.

Enabled when USE_OPEN_AI_MODERATION_API is true (requires OPENAI_API_KEY).
See https://developers.openai.com/api/reference/resources/moderations/methods/create

Label logic uses OpenAI category flags with Hate over Abuse, then score fallbacks.
Probabilities avoid treating independent harassment+hate scores as two full masses
that get renormalized (which wrongly favored Abuse when both are high).
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Mapping, Sequence

logger = logging.getLogger(__name__)

_HASOC_LABELS = ("Normal", "Abuse", "Hate")

OPENAI_MODERATIONS_URL = "https://api.openai.com/v1/moderations"
_TRUTHY = frozenset({"1", "true", "yes", "on"})

_ABUSE_SCORE_KEYS = (
    "harassment",
    "harassment/threatening",
    "violence",
    "violence/graphic",
    "sexual",
    "illicit",
    "illicit/violent",
)

_ABUSE_CATEGORY_KEYS = _ABUSE_SCORE_KEYS

_HATE_CATEGORY_KEYS = ("hate", "hate/threatening")

_SCORE_FLAG_THRESHOLD = 0.5


class OpenAIModerationError(RuntimeError):
    """OpenAI API returned an error response."""


def is_enabled() -> bool:
    return os.getenv("USE_OPEN_AI_MODERATION_API", "").strip().lower() in _TRUTHY


def configured_model() -> str:
    return (
        os.getenv("OPENAI_MODERATION_MODEL", "omni-moderation-latest").strip()
        or "omni-moderation-latest"
    )


def public_model_id(openai_model: str) -> str:
    return f"openai/moderation:{openai_model}"


def _api_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY is required when USE_OPEN_AI_MODERATION_API is enabled"
        )
    return key


def _score(category_scores: Mapping[str, Any], key: str) -> float:
    try:
        return max(0.0, min(1.0, float(category_scores.get(key, 0.0))))
    except (TypeError, ValueError):
        return 0.0


def _hate_strength(category_scores: Mapping[str, Any]) -> float:
    return max(
        _score(category_scores, "hate"),
        _score(category_scores, "hate/threatening"),
    )


def _abuse_strength(category_scores: Mapping[str, Any]) -> float:
    return max(_score(category_scores, key) for key in _ABUSE_SCORE_KEYS)


def _category_on(categories: Mapping[str, Any] | None, key: str) -> bool:
    if not categories:
        return False
    return bool(categories.get(key))


def _hate_flagged(categories: Mapping[str, Any] | None, hate_s: float) -> bool:
    if categories:
        return any(_category_on(categories, key) for key in _HATE_CATEGORY_KEYS)
    return hate_s >= _SCORE_FLAG_THRESHOLD


def _abuse_flagged(categories: Mapping[str, Any] | None, abuse_s: float) -> bool:
    if categories:
        return any(_category_on(categories, key) for key in _ABUSE_CATEGORY_KEYS)
    return abuse_s >= _SCORE_FLAG_THRESHOLD


def _normalize_probs(normal: float, abuse: float, hate: float) -> dict[str, float]:
    weights = [max(0.0, normal), max(0.0, abuse), max(0.0, hate)]
    total = sum(weights) or 1.0
    return {
        "normal": weights[0] / total,
        "abuse": weights[1] / total,
        "hate": weights[2] / total,
    }


def map_moderation_result_to_hasoc(
    category_scores: Mapping[str, Any],
    categories: Mapping[str, Any] | None = None,
) -> dict[str, object]:
    """Convert one OpenAI moderation result into HASOC label + probabilities."""
    hate_s = _hate_strength(category_scores)
    abuse_s = _abuse_strength(category_scores)
    hate_flag = _hate_flagged(categories, hate_s)
    abuse_flag = _abuse_flagged(categories, abuse_s)

    if hate_flag:
        predicted_label = "Hate"
        # Harassment often co-fires with hate; do not let it dominate the label or probs.
        abuse_only = max(0.0, abuse_s - hate_s)
        normal_s = max(0.02, 1.0 - hate_s - abuse_only)
        probabilities = _normalize_probs(normal_s, abuse_only, hate_s)
    elif abuse_flag:
        predicted_label = "Abuse"
        normal_s = max(0.02, 1.0 - abuse_s - hate_s)
        probabilities = _normalize_probs(normal_s, abuse_s, hate_s)
    elif hate_s < 0.15 and abuse_s < 0.15:
        predicted_label = "Normal"
        probabilities = _normalize_probs(1.0 - max(hate_s, abuse_s), abuse_s, hate_s)
    else:
        # Unflagged but middling scores — pick strongest channel.
        normal_s = max(0.02, 1.0 - max(hate_s, abuse_s))
        probabilities = _normalize_probs(normal_s, abuse_s, hate_s)
        label_id = max(range(3), key=lambda i: [probabilities["normal"], probabilities["abuse"], probabilities["hate"]][i])
        predicted_label = _HASOC_LABELS[label_id]

    return {
        "predicted_label": predicted_label,
        "probabilities": probabilities,
    }


def map_category_scores_to_hasoc(category_scores: dict[str, Any]) -> dict[str, object]:
    """Score-only mapping (tests); prefers score thresholds when categories absent."""
    return map_moderation_result_to_hasoc(category_scores, categories=None)


def _post_moderations(texts: Sequence[str]) -> list[dict[str, Any]]:
    payload = {"model": configured_model(), "input": list(texts)}
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_MODERATIONS_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_api_key()}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning("OpenAI moderation HTTP %s: %s", exc.code, detail[:500])
        raise OpenAIModerationError(
            f"OpenAI moderation API error ({exc.code}): {detail[:300]}"
        ) from exc
    except urllib.error.URLError as exc:
        raise OpenAIModerationError(f"OpenAI moderation request failed: {exc.reason}") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise OpenAIModerationError("OpenAI moderation returned invalid JSON") from exc

    results = data.get("results")
    if not isinstance(results, list) or len(results) != len(texts):
        raise OpenAIModerationError("OpenAI moderation response shape mismatch")
    return results


def moderate_texts(texts: Sequence[str]) -> list[dict[str, object]]:
    if not texts:
        return []

    api_results = _post_moderations(texts)
    outputs: list[dict[str, object]] = []
    for text, item in zip(texts, api_results, strict=True):
        scores = item.get("category_scores")
        if not isinstance(scores, dict):
            raise OpenAIModerationError("OpenAI moderation missing category_scores")
        cats = item.get("categories")
        categories = cats if isinstance(cats, dict) else None
        mapped = map_moderation_result_to_hasoc(scores, categories)
        outputs.append(
            {
                "text": text,
                "predicted_label": mapped["predicted_label"],
                "probabilities": mapped["probabilities"],
            }
        )
    return outputs
