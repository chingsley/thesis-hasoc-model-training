from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Sequence

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

LABELS = ["Normal", "Abuse", "Hate"]


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
            raise ValueError("Set HF_MODEL_ID or MODEL_PATH before starting the API.")

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


def resolve_model_source() -> tuple[str | None, str | None]:
    hf_model_id = os.getenv("HF_MODEL_ID", "").strip() or None
    model_path = os.getenv("MODEL_PATH", "").strip() or None

    if hf_model_id:
        return None, hf_model_id

    if model_path:
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
        return str(path), None

    return None, None
