"""Rules for text accepted by /predict and /predict/batch."""

from __future__ import annotations

import re

MIN_PREDICTION_TEXT_LEN = 10
MIN_SINGLE_WORD_LEN = 20

_LABEL_NAMES = frozenset({"normal", "abuse", "hate"})
_PRED_REF_RE = re.compile(r"^pred_\d+$", re.IGNORECASE)
_PURE_NUMERIC_RE = re.compile(r"^\d+$")
_PROB_LIKE_RE = re.compile(r"^\d{1,3}(\.\d+)?%?$")
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def validate_prediction_text(text: str) -> str:
    """Return stripped text or raise ValueError with a short reason."""
    t = text.strip()
    if not t:
        raise ValueError("text is empty")
    if len(t) < MIN_PREDICTION_TEXT_LEN:
        raise ValueError(
            f"text must be at least {MIN_PREDICTION_TEXT_LEN} characters "
            "(short inputs are not reliable for this model)"
        )
    if _PURE_NUMERIC_RE.match(t):
        raise ValueError("text cannot be only digits (check your CSV column)")
    if _PROB_LIKE_RE.match(t):
        raise ValueError("text looks like a probability or percentage, not a message")
    if t.lower() in _LABEL_NAMES:
        raise ValueError("text cannot be a class label (Normal/Abuse/Hate)")
    if _PRED_REF_RE.match(t):
        raise ValueError("text looks like a post id (pred_N), not message content")
    words = _WORD_RE.findall(t)
    if len(words) < 2 and len(t) < MIN_SINGLE_WORD_LEN:
        raise ValueError("text must contain at least two words or be longer message text")
    return t


def validate_prediction_texts(texts: list[str]) -> list[str]:
    """Validate a batch; raises ValueError with a multi-line summary if any row fails."""
    cleaned: list[str] = []
    errors: list[str] = []
    for index, raw in enumerate(texts, start=1):
        try:
            cleaned.append(validate_prediction_text(raw))
        except ValueError as exc:
            preview = raw.strip()[:40].replace("\n", " ")
            errors.append(f"Row {index}: {exc} — got “{preview}”")
    if errors:
        shown = errors[:8]
        extra = len(errors) - len(shown)
        msg = "\n".join(shown)
        if extra > 0:
            msg += f"\n…and {extra} more invalid row(s)."
        raise ValueError(msg)
    return cleaned
