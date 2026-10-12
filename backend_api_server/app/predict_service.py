"""Route /predict and /predict/batch to local models or OpenAI Moderation."""

from __future__ import annotations

from fastapi import HTTPException

from . import openai_moderation_service as oai_mod
from .model_service import ModelRouter


def classify_texts(
    router: ModelRouter,
    language: str,
    texts: list[str],
) -> tuple[list[dict[str, object]], str, bool, bool]:
    """Returns (results, model_id, used_fallback, use_openai_moderation)."""
    if oai_mod.is_enabled():
        try:
            results = oai_mod.moderate_texts(texts)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except oai_mod.OpenAIModerationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        model_id = oai_mod.public_model_id(oai_mod.configured_model())
        return results, model_id, False, True

    try:
        service = router.get(language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    used_fallback = router.used_fallback(language)
    results = service.predict_batch(texts)
    return results, service.model_id, used_fallback, False
