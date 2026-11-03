"""Switch the served model family (original or merged) while the API runs.

Platform admins choose the family in Settings. The new models load in a
background thread while the current ones keep serving, and the switch happens
only once loading succeeds. The choice is saved in ``app_settings`` and restored
at startup; until a choice is saved, ``HF_MODEL_SET`` decides.

The state lives in this process. Run the API with one worker (as the deployment
runbooks do); other workers would keep their old models until restarted.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable

from . import db
from .model_service import (
    VALID_MODEL_SETS,
    ModelRouter,
    effective_model_set,
    env_model_set,
    model_sources,
    normalize_model_set,
    set_runtime_model_set,
)

logger = logging.getLogger(__name__)

SETTING_KEY = "model_set"


class ModelSetUnavailableError(Exception):
    """No models are configured for the requested set."""


class ModelSetSwitchInProgressError(Exception):
    """Another switch is still loading."""


def _build_router(model_set: str | None) -> ModelRouter:
    return ModelRouter(device=os.getenv("INFERENCE_DEVICE", "auto"), model_set=model_set)


def _unavailable_message(model_set: str) -> str:
    suffix = "_MERGED" if model_set == "merged" else ""
    return (
        f"No models are configured for the {model_set} set. Set HF_MODEL_ID_IGBO{suffix} and "
        f"HF_MODEL_ID_YORUBA{suffix} (optionally HF_MODEL_ID_JOINT{suffix}) in the API's .env, "
        "then restart the API."
    )


class ModelSetSwitcher:
    def __init__(self, build_router: Callable[[str | None], ModelRouter] = _build_router) -> None:
        self._build_router = build_router
        self._lock = threading.Lock()
        self._router: ModelRouter | None = None
        self._loading: str | None = None
        self._error: str | None = None

    def router(self) -> ModelRouter:
        """The router for the active model set (built on first use)."""
        with self._lock:
            if self._router is None:
                self._router = self._build_router(effective_model_set())
            return self._router

    def restore_saved_choice(self) -> None:
        """At startup, serve the saved choice; fall back to HF_MODEL_SET if it cannot load."""
        saved = db.get_app_setting(SETTING_KEY)
        if saved:
            try:
                model_set = normalize_model_set(saved)
                if not model_sources(model_set):
                    raise ModelSetUnavailableError(_unavailable_message(model_set))
                router = self._build_router(model_set)
            except Exception as exc:
                logger.exception("Saved model set %r failed to load; using HF_MODEL_SET", saved)
                with self._lock:
                    self._error = (
                        f"The saved choice ({saved}) failed to load when the API started, "
                        f"so the API uses HF_MODEL_SET instead: {exc}"
                    )
            else:
                with self._lock:
                    set_runtime_model_set(model_set)
                    self._router = router
                return
        self.router()

    def status(self) -> dict[str, Any]:
        with self._lock:
            loading, error, active = self._loading, self._error, effective_model_set()
        options = []
        for model_set in VALID_MODEL_SETS:
            try:
                sources = model_sources(model_set)
            except OSError:  # a MODEL_PATH_* that is not a checkpoint
                sources = {}
            options.append({"id": model_set, "configured": bool(sources), "models": sources})
        return {
            "active": active,
            "env_default": env_model_set(),
            "saved": db.get_app_setting(SETTING_KEY),
            "loading": loading,
            "error": error,
            "options": options,
        }

    def start_switch(self, target: str, user_id: int | None) -> None:
        """Begin switching to ``target``; returns before slow loads finish."""
        model_set = normalize_model_set(target)
        try:
            sources = model_sources(model_set)
        except OSError as exc:
            raise ModelSetUnavailableError(str(exc)) from exc
        if not sources:
            raise ModelSetUnavailableError(_unavailable_message(model_set))

        with self._lock:
            if self._loading is not None:
                raise ModelSetSwitchInProgressError(
                    f"The {self._loading} models are still loading. Try again when that finishes."
                )
            active = effective_model_set()
            if model_set == active and self._router is not None:
                db.set_app_setting(SETTING_KEY, model_set, user_id)
                return
            try:
                same_models = self._router is not None and sources == model_sources(active)
            except OSError:
                same_models = False
            if same_models:
                # Same checkpoints under another name (e.g. HF_MODEL_SET unset): no reload.
                self._activate(model_set, self._router, user_id)
                return
            self._loading = model_set
            self._error = None

        threading.Thread(
            target=self._load,
            args=(model_set, user_id),
            name="model-set-switch",
            daemon=True,
        ).start()

    def _load(self, model_set: str, user_id: int | None) -> None:
        try:
            router = self._build_router(model_set)
            with self._lock:
                self._activate(model_set, router, user_id)
        except Exception as exc:
            logger.exception("Switching to the %s model set failed", model_set)
            with self._lock:
                self._error = f"Loading the {model_set} models failed: {exc}"
        finally:
            with self._lock:
                self._loading = None

    def _activate(self, model_set: str, router: ModelRouter, user_id: int | None) -> None:
        # Caller holds self._lock. Save first, so a failed write leaves the old set serving.
        db.set_app_setting(SETTING_KEY, model_set, user_id)
        set_runtime_model_set(model_set)
        self._router = router
        self._error = None
        logger.info("model_set switched to=%s by_user_id=%s", model_set, user_id)
