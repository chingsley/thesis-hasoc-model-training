from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict, List, Sequence

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)

LABELS = ["Normal", "Abuse", "Hate"]
ROUTED_LANGUAGES = ("igbo", "yoruba")


class ModelService:
    def __init__(
        self,
        model_path: str | None = None,
        hf_model_id: str | None = None,
        device: str = "auto",
        max_length: int = 256,
        batch_size: int = 16,
    ) -> None:
        source = hf_model_id or model_path
        if not source:
            raise ValueError("Model source is required.")

        self.model_id = source
        self.max_length = max_length
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(source)
        self.model = AutoModelForSequenceClassification.from_pretrained(source)
        self.model.eval()

        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model.to(self.device)
        logger.info("Loaded model %s on %s", self.model_id, self.device)

    def predict_batch(self, texts: Sequence[str]) -> List[Dict[str, object]]:
        if not texts:
            return []

        outputs: List[Dict[str, object]] = []
        for start in range(0, len(texts), self.batch_size):
            chunk = list(texts[start : start + self.batch_size])
            encoded = self.tokenizer(
                chunk,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            encoded = {key: value.to(self.device) for key, value in encoded.items()}

            with torch.inference_mode():
                logits = self.model(**encoded).logits
                probabilities = torch.softmax(logits, dim=-1).cpu().numpy()

            for text, probs in zip(chunk, probabilities):
                label_id = int(np.argmax(probs))
                outputs.append(
                    {
                        "text": text,
                        "predicted_label": LABELS[label_id],
                        "probabilities": {
                            "normal": float(probs[0]),
                            "abuse": float(probs[1]),
                            "hate": float(probs[2]),
                        },
                    }
                )

        return outputs


def resolve_checkpoint_path(model_path: str) -> str:
    path = Path(model_path).expanduser().resolve()
    if not (path / "config.json").exists():
        candidates = sorted(
            [child for child in path.iterdir() if child.is_dir()],
            key=lambda item: item.name,
            reverse=True,
        )
        for candidate in candidates:
            if (candidate / "config.json").exists():
                path = candidate
                break
    if not (path / "config.json").exists():
        raise FileNotFoundError(
            f"MODEL_PATH does not look like a HuggingFace checkpoint: {path}"
        )
    return str(path)


def resolve_model_source_for_key(prefix: str) -> tuple[str | None, str | None]:
    hf_model_id = os.getenv(f"HF_MODEL_ID_{prefix}", "").strip() or None
    model_path = os.getenv(f"MODEL_PATH_{prefix}", "").strip() or None

    if hf_model_id:
        return None, hf_model_id

    if model_path:
        return resolve_checkpoint_path(model_path), None

    return None, None


def resolve_legacy_model_source() -> tuple[str | None, str | None]:
    hf_model_id = os.getenv("HF_MODEL_ID", "").strip() or None
    model_path = os.getenv("MODEL_PATH", "").strip() or None

    if hf_model_id:
        return None, hf_model_id

    if model_path:
        return resolve_checkpoint_path(model_path), None

    return None, None


def resolve_model_source() -> tuple[str | None, str | None]:
    """Backward-compatible single-model resolver."""
    for prefix in ("IGBO", "YORUBA"):
        source = resolve_model_source_for_key(prefix)
        if source != (None, None):
            return source
    return resolve_legacy_model_source()


class ModelRouter:
    """Routes inference to per-language models with optional joint fallback."""

    def __init__(self, device: str = "auto") -> None:
        self.device = device
        self._models: Dict[str, ModelService] = {}
        self._fallback: ModelService | None = None

        for language in ROUTED_LANGUAGES:
            model_path, hf_model_id = resolve_model_source_for_key(language.upper())
            if model_path or hf_model_id:
                self._models[language] = ModelService(
                    model_path=model_path,
                    hf_model_id=hf_model_id,
                    device=device,
                )

        if not self._models:
            legacy_path, legacy_hf = resolve_legacy_model_source()
            if legacy_path or legacy_hf:
                shared = ModelService(
                    model_path=legacy_path,
                    hf_model_id=legacy_hf,
                    device=device,
                )
                for language in ROUTED_LANGUAGES:
                    self._models[language] = shared

        joint_path, joint_hf = resolve_model_source_for_key("JOINT")
        if joint_path or joint_hf:
            self._fallback = ModelService(
                model_path=joint_path,
                hf_model_id=joint_hf,
                device=device,
            )

        if not self._models and not self._fallback:
            raise ValueError(
                "Configure HF_MODEL_ID_IGBO / HF_MODEL_ID_YORUBA (or legacy HF_MODEL_ID), "
                "or HF_MODEL_ID_JOINT as fallback."
            )

        logger.info(
            "ModelRouter ready: languages=%s fallback=%s device=%s",
            {lang: svc.model_id for lang, svc in self._models.items()},
            self._fallback.model_id if self._fallback else None,
            self.inference_device,
        )

    def get(self, language: str) -> ModelService:
        lang = language.lower()
        if lang in self._models:
            return self._models[lang]
        if self._fallback is not None:
            logger.warning(
                "Using joint fallback for language=%s (no dedicated model configured)",
                lang,
            )
            return self._fallback
        raise KeyError(f"No model configured for language={language!r}")

    def resolve_model_id(self, language: str) -> str:
        return self.get(language).model_id

    def used_fallback(self, language: str) -> bool:
        lang = language.lower()
        return lang not in self._models and self._fallback is not None

    def model_map(self) -> Dict[str, str]:
        mapping = {lang: service.model_id for lang, service in self._models.items()}
        if self._fallback is not None:
            mapping["joint"] = self._fallback.model_id
        return mapping

    @property
    def inference_device(self) -> str:
        if self._models:
            return str(next(iter(self._models.values())).device)
        if self._fallback is not None:
            return str(self._fallback.device)
        return "unknown"
