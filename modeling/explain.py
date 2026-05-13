from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .common import ensure_dir
from .data import LABELS


def _softmax(logits: np.ndarray) -> np.ndarray:
    import torch
    import torch.nn.functional as F

    t = torch.as_tensor(logits, dtype=torch.float32)
    return F.softmax(t, dim=-1).detach().cpu().numpy()


class TransformerExplainer(object):
    def __init__(self, run_dir: Path):
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except ImportError as exc:
            raise ImportError("transformers and torch are required for explanations") from exc

        self.torch = torch
        self.run_dir = Path(run_dir)
        self.tokenizer = AutoTokenizer.from_pretrained(str(self.run_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(self.run_dir))
        self.model.eval()

    def predict_proba(self, texts: List[str]) -> np.ndarray:
        with self.torch.no_grad():
            inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=256)
            outputs = self.model(**inputs)
            return _softmax(outputs.logits.detach().cpu().numpy())

    def lime_explanation(self, text: str, num_samples: int = 1000) -> Dict:
        try:
            from lime.lime_text import LimeTextExplainer
        except ImportError as exc:
            raise ImportError("lime is required for LIME explanations") from exc
        explainer = LimeTextExplainer(class_names=LABELS)
        explanation = explainer.explain_instance(text, self.predict_proba, num_features=12, num_samples=num_samples)
        predicted = self.predict_proba([text])[0]
        return {
            "method": "lime",
            "scores": explanation.as_list(),
            "predicted_label": LABELS[int(np.argmax(predicted))],
            "fidelity_proxy": float(explanation.score),
        }

    def shap_explanation(self, text: str) -> Dict:
        try:
            import shap
        except ImportError as exc:
            raise ImportError("shap is required for SHAP explanations") from exc
        masker = shap.maskers.Text(self.tokenizer)
        explainer = shap.Explainer(self.predict_proba, masker, output_names=LABELS)
        values = explainer([text])
        row = values[0]
        tokens = list(row.data)
        top_class = int(np.argmax(self.predict_proba([text])[0]))
        class_values = row.values[:, top_class]
        return {
            "method": "shap",
            "tokens": tokens,
            "scores": [{"token": token, "score": float(score)} for token, score in zip(tokens, class_values)],
        }

    def attention_rollout(self, text: str) -> Dict:
        with self.torch.no_grad():
            encoded = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = self.model(**encoded, output_attentions=True)
        attentions = outputs.attentions
        if not attentions:
            return {"method": "attention_rollout", "tokens": [], "scores": []}
        rollout = None
        for layer_attention in attentions:
            layer = layer_attention.mean(dim=1).squeeze(0)
            identity = self.torch.eye(layer.size(-1), device=layer.device)
            layer = layer + identity
            layer = layer / layer.sum(dim=-1, keepdim=True)
            rollout = layer if rollout is None else self.torch.matmul(layer, rollout)
        scores = rollout[0].detach().cpu().numpy()
        tokens = self.tokenizer.convert_ids_to_tokens(encoded["input_ids"][0])
        return {
            "method": "attention_rollout",
            "tokens": tokens,
            "scores": [{"token": token, "score": float(score)} for token, score in zip(tokens, scores)],
        }


def compute_explanation_metrics(text: str, attribution_scores: List[Dict[str, float]], predictor) -> Dict[str, float]:
    ranked = sorted(attribution_scores, key=lambda item: abs(item["score"]), reverse=True)
    baseline = predictor([text])[0]
    top_label = int(np.argmax(baseline))
    tokens = text.split()
    important_tokens = set([item["token"] for item in ranked[: max(1, len(ranked) // 5)]])
    reduced = " ".join([token for token in tokens if token not in important_tokens]) or text
    reduced_scores = predictor([reduced])[0]
    faithfulness = float(baseline[top_label] - reduced_scores[top_label])
    positive = [item for item in attribution_scores if abs(item["score"]) > 0.1]
    sparsity = float(len(positive)) / float(max(1, len(attribution_scores)))
    return {
        "faithfulness_aopc_proxy": faithfulness,
        "sparsity": sparsity,
    }


def explanation_stability(first: Dict, second: Dict) -> float:
    first_tokens = set([item[0] if isinstance(item, tuple) else item.get("token") for item in first["scores"][:10]])
    second_tokens = set([item[0] if isinstance(item, tuple) else item.get("token") for item in second["scores"][:10]])
    if not first_tokens and not second_tokens:
        return 1.0
    return float(len(first_tokens & second_tokens)) / float(len(first_tokens | second_tokens))


def explain_rows(run_dir: Path, rows: pd.DataFrame, output_dir: Optional[Path] = None) -> List[Path]:
    explainer = TransformerExplainer(run_dir)
    out_dir = ensure_dir(output_dir or (Path(run_dir) / "explanations"))
    outputs = []
    for _, row in rows.iterrows():
        text = row["tweet"]
        lime_first = explainer.lime_explanation(text)
        lime_second = explainer.lime_explanation(text)
        shap_output = explainer.shap_explanation(text)
        attention_output = explainer.attention_rollout(text)
        metrics = compute_explanation_metrics(
            text,
            [{"token": token, "score": score} for token, score in lime_first["scores"]],
            explainer.predict_proba,
        )
        metrics["stability_jaccard"] = explanation_stability(lime_first, lime_second)
        payload = {
            "id": row["id"],
            "label": row["label"],
            "text": text,
            "lime": lime_first,
            "shap": shap_output,
            "attention_rollout": attention_output,
            "metrics": metrics,
        }
        path = out_dir / "{0}.json".format(row["id"])
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        outputs.append(path)
    return outputs
