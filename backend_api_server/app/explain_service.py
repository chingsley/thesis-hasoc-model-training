"""Explainability service: LIME / SHAP / attention rollout / integrated gradients.

Adapted from model_training/modeling/explain.py, but reuses the models already
loaded by ModelService instead of loading a second copy from disk.

The optional dependencies (lime, shap, captum) are imported lazily; a missing
dependency or runtime failure surfaces as a per-method {"method", "error"}
entry, which the dashboard already renders.
"""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, Sequence

import numpy as np
import torch

from .model_service import LABELS, ModelService

logger = logging.getLogger(__name__)

ALL_METHODS = ("lime", "shap", "attention_rollout", "integrated_gradients")

# Tuning knobs (env-overridable). Defaults chosen for interactive dashboard use:
# LIME runs twice (second run feeds the stability metric), so sample count
# dominates wall time — 200 keeps fidelity within a few points of 500 while
# cutting LIME cost by ~60%. IG converges well before 50 steps on short texts.
LIME_NUM_SAMPLES = int(os.getenv("EXPLAIN_LIME_SAMPLES", "200"))
IG_N_STEPS = int(os.getenv("EXPLAIN_IG_STEPS", "32"))
EXPLAIN_MAX_WORKERS = int(os.getenv("EXPLAIN_MAX_WORKERS", "4"))


class _LockedTokenizerProxy:
    """Serialize HuggingFace fast-tokenizer encode calls across threads."""

    def __init__(self, tokenizer, lock) -> None:
        self._tokenizer = tokenizer
        self._lock = lock

    def __call__(self, *args, **kwargs):
        with self._lock:
            return self._tokenizer(*args, **kwargs)

    def encode(self, *args, **kwargs):
        with self._lock:
            return self._tokenizer.encode(*args, **kwargs)

    def encode_plus(self, *args, **kwargs):
        with self._lock:
            return self._tokenizer.encode_plus(*args, **kwargs)

    def batch_encode_plus(self, *args, **kwargs):
        with self._lock:
            return self._tokenizer.batch_encode_plus(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._tokenizer, name)


class Explainer:
    """Runs XAI methods against an already-loaded ModelService."""

    def __init__(self, service: ModelService) -> None:
        self.service = service
        self.tokenizer = service.tokenizer
        self.model = service.model
        self.device = service.device

    def predict_proba(self, texts: List[str]) -> np.ndarray:
        # SHAP/LIME may pass numpy arrays or scalars instead of list[str].
        if isinstance(texts, str):
            texts = [texts]
        texts = [str(text) for text in texts]
        with self.service.tokenizer_lock:
            inputs = self.tokenizer(
                texts, return_tensors="pt", padding=True, truncation=True, max_length=256
            )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}
        with torch.no_grad():
            logits = self.model(**inputs).logits
            return torch.softmax(logits, dim=-1).detach().cpu().numpy()

    def lime_explanation(self, text: str, num_samples: int = LIME_NUM_SAMPLES) -> Dict:
        try:
            from lime.lime_text import LimeTextExplainer
        except ImportError as exc:
            raise ImportError("lime is required for LIME explanations") from exc
        explainer = LimeTextExplainer(class_names=LABELS)
        explanation = explainer.explain_instance(
            text, self.predict_proba, num_features=12, num_samples=num_samples
        )
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
        # SHAP's Text masker tokenizes internally; proxy serializes encode() without
        # holding the lock across model forwards (avoids deadlocks with LIME).
        locked_tokenizer = _LockedTokenizerProxy(self.tokenizer, self.service.tokenizer_lock)
        masker = shap.maskers.Text(locked_tokenizer)
        explainer = shap.Explainer(self.predict_proba, masker, output_names=LABELS)
        values = explainer([text])
        row = values[0]
        tokens = [str(token) for token in row.data]
        top_class = int(np.argmax(self.predict_proba([text])[0]))
        class_values = row.values[:, top_class]
        return {
            "method": "shap",
            "tokens": tokens,
            "scores": [
                {"token": token, "score": float(score)} for token, score in zip(tokens, class_values)
            ],
        }

    def attention_rollout(self, text: str) -> Dict:
        with self.service.tokenizer_lock:
            encoded = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            tokens = self.tokenizer.convert_ids_to_tokens(encoded["input_ids"][0])
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with torch.no_grad():
            outputs = self.model(**encoded, output_attentions=True)
        attentions = outputs.attentions
        if not attentions:
            return {"method": "attention_rollout", "tokens": [], "scores": []}
        rollout = None
        for layer_attention in attentions:
            layer = layer_attention.mean(dim=1).squeeze(0)
            identity = torch.eye(layer.size(-1), device=layer.device)
            layer = layer + identity
            layer = layer / layer.sum(dim=-1, keepdim=True)
            rollout = layer if rollout is None else torch.matmul(layer, rollout)
        scores = rollout[0].detach().cpu().numpy()
        return {
            "method": "attention_rollout",
            "tokens": tokens,
            "scores": [
                {"token": token, "score": float(score)} for token, score in zip(tokens, scores)
            ],
        }

    def _baseline_input_ids(self, input_ids, reference_token_id: int):
        # Keep special tokens (e.g. <s>/</s>) in place and replace the actual
        # content tokens with a neutral reference (PAD).
        special_ids = set(self.tokenizer.all_special_ids)
        baseline = input_ids.clone()
        for position in range(baseline.size(1)):
            if int(baseline[0, position]) not in special_ids:
                baseline[0, position] = reference_token_id
        return baseline

    def integrated_gradients(self, text: str, n_steps: int = IG_N_STEPS) -> Dict:
        try:
            from captum.attr import IntegratedGradients
        except ImportError as exc:
            raise ImportError("captum is required for integrated gradients explanations") from exc

        # Attribute w.r.t. input embeddings directly. LayerIntegratedGradients
        # registers hooks on the shared embedding module; when the dashboard
        # fires parallel /explain calls those hooks cross-contaminate and yield
        # "tensor a (N) must match tensor b (M) at dimension 1" failures.
        with self.service.tokenizer_lock:
            encoded = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            tokens = self.tokenizer.convert_ids_to_tokens(encoded["input_ids"][0])

        input_ids = encoded["input_ids"].to(self.device)
        attention_mask = encoded.get("attention_mask")
        if attention_mask is None:
            attention_mask = torch.ones_like(input_ids)
        else:
            attention_mask = attention_mask.to(self.device)

        reference_token_id = self.tokenizer.pad_token_id
        if reference_token_id is None:
            reference_token_id = self.tokenizer.unk_token_id or 0
        baseline_ids = self._baseline_input_ids(input_ids, reference_token_id)

        top_class = int(np.argmax(self.predict_proba([text])[0]))
        embedding_layer = self.model.get_input_embeddings()
        inputs_embeds = embedding_layer(input_ids).detach().clone().requires_grad_(True)
        baseline_embeds = embedding_layer(baseline_ids).detach().clone()

        def forward_func(embeds: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
            return self.model(inputs_embeds=embeds, attention_mask=mask).logits

        ig = IntegratedGradients(forward_func)
        attributions = ig.attribute(
            inputs=inputs_embeds,
            baselines=baseline_embeds,
            additional_forward_args=(attention_mask,),
            target=top_class,
            n_steps=n_steps,
        )
        token_scores = attributions.sum(dim=-1).squeeze(0)
        norm = torch.norm(token_scores.detach())
        if float(norm) > 0:
            token_scores = token_scores / norm
        token_scores = token_scores.detach().cpu().numpy()
        return {
            "method": "integrated_gradients",
            "predicted_label": LABELS[top_class],
            "tokens": tokens,
            "scores": [
                {"token": token, "score": float(score)} for token, score in zip(tokens, token_scores)
            ],
        }


def _normalize_token(token: Optional[str]) -> str:
    if token is None:
        return ""
    return token.replace("Ġ", "").replace("▁", "").strip().lower()


def compute_explanation_metrics(
    text: str, attribution_scores: List[Dict[str, float]], predictor: Callable[[List[str]], np.ndarray]
) -> Dict[str, float]:
    ranked = sorted(attribution_scores, key=lambda item: abs(item["score"]), reverse=True)
    baseline = predictor([text])[0]
    top_label = int(np.argmax(baseline))
    tokens = text.split()
    important_tokens = set(
        _normalize_token(item["token"]) for item in ranked[: max(1, len(ranked) // 5)]
    )
    important_tokens.discard("")
    reduced = " ".join([token for token in tokens if _normalize_token(token) not in important_tokens]) or text
    reduced_scores = predictor([reduced])[0]
    faithfulness = float(baseline[top_label] - reduced_scores[top_label])
    positive = [item for item in attribution_scores if abs(item["score"]) > 0.1]
    sparsity = float(len(positive)) / float(max(1, len(attribution_scores)))
    return {
        "faithfulness_aopc_proxy": faithfulness,
        "sparsity": sparsity,
    }


def _scores_as_pairs(explanation: Optional[Dict]) -> List[Dict[str, float]]:
    if not explanation:
        return []
    pairs = []
    for item in explanation.get("scores", []):
        if isinstance(item, dict):
            pairs.append({"token": item.get("token"), "score": float(item.get("score", 0.0))})
        else:
            token, score = item
            pairs.append({"token": token, "score": float(score)})
    return pairs


def cross_method_agreement(methods: Dict[str, Dict], top_k: int = 5) -> Dict[str, float]:
    top_tokens: Dict[str, set] = {}
    for name, explanation in methods.items():
        if not explanation or "error" in explanation:
            continue
        pairs = _scores_as_pairs(explanation)
        if not pairs:
            continue
        ranked = sorted(pairs, key=lambda item: abs(item["score"]), reverse=True)
        tokens = set(_normalize_token(item["token"]) for item in ranked[:top_k])
        tokens.discard("")
        if tokens:
            top_tokens[name] = tokens
    result: Dict[str, float] = {}
    names = sorted(top_tokens.keys())
    pairwise = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            first, second = top_tokens[names[i]], top_tokens[names[j]]
            union = first | second
            jaccard = float(len(first & second)) / float(len(union)) if union else 0.0
            result["agreement_{0}_vs_{1}".format(names[i], names[j])] = jaccard
            pairwise.append(jaccard)
    if pairwise:
        result["cross_method_agreement_mean"] = float(sum(pairwise) / len(pairwise))
    return result


def explanation_stability(first: Dict, second: Dict) -> float:
    first_tokens = set(
        [item[0] if isinstance(item, tuple) else item.get("token") for item in first["scores"][:10]]
    )
    second_tokens = set(
        [item[0] if isinstance(item, tuple) else item.get("token") for item in second["scores"][:10]]
    )
    if not first_tokens and not second_tokens:
        return 1.0
    return float(len(first_tokens & second_tokens)) / float(len(first_tokens | second_tokens))


def _safe_call(func):
    try:
        return func(), None
    except ImportError as exc:
        return None, "missing dependency: {0}".format(exc)
    except Exception as exc:  # noqa: BLE001 - isolate per-method failures
        return None, "error: {0}".format(exc)


def explain_text(
    service: ModelService,
    text: str,
    explanation_id: str,
    methods: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Build an ExplanationPayload-shaped dict for one text.

    The four XAI methods are independent and read-only against the shared model,
    so they run concurrently on a thread pool (torch releases the GIL during
    native inference). LIME runs twice — the second run feeds the stability
    metric — and both runs are parallelised like any other method.
    """
    explainer = Explainer(service)
    selected_methods = tuple(methods) if methods else ALL_METHODS

    predicted = service.predict_batch([text])[0]
    payload: Dict[str, Any] = {
        "id": explanation_id,
        "label": predicted["predicted_label"],
        "text": text,
        "methods": {},
        "metrics": {},
    }

    tasks: Dict[str, Callable[[], Dict]] = {}
    if "lime" in selected_methods:
        tasks["lime"] = lambda: explainer.lime_explanation(text)
        tasks["lime__stability"] = lambda: explainer.lime_explanation(text)
    if "shap" in selected_methods:
        tasks["shap"] = lambda: explainer.shap_explanation(text)
    if "attention_rollout" in selected_methods:
        tasks["attention_rollout"] = lambda: explainer.attention_rollout(text)
    if "integrated_gradients" in selected_methods:
        tasks["integrated_gradients"] = lambda: explainer.integrated_gradients(text)

    results: Dict[str, tuple[Optional[Dict], Optional[str]]] = {}
    with ThreadPoolExecutor(max_workers=max(1, min(EXPLAIN_MAX_WORKERS, len(tasks)))) as pool:
        futures = {name: pool.submit(_safe_call, fn) for name, fn in tasks.items()}
        for name, future in futures.items():
            results[name] = future.result()

    if "lime" in selected_methods:
        lime_first, lime_err = results["lime"]
        if lime_first is not None:
            payload["methods"]["lime"] = lime_first
            lime_second, _ = results.get("lime__stability", (None, None))
            if lime_second is not None:
                payload["metrics"]["lime_stability_jaccard"] = explanation_stability(
                    lime_first, lime_second
                )
        else:
            payload["methods"]["lime"] = {"method": "lime", "error": lime_err}

    for name in ("shap", "attention_rollout", "integrated_gradients"):
        if name not in selected_methods:
            continue
        output, error = results[name]
        payload["methods"][name] = output if output is not None else {"method": name, "error": error}

    for name, explanation in payload["methods"].items():
        if not explanation or "error" in explanation:
            continue
        pairs = _scores_as_pairs(explanation)
        if not pairs:
            continue
        scores = compute_explanation_metrics(text, pairs, explainer.predict_proba)
        for key, value in scores.items():
            payload["metrics"]["{0}_{1}".format(name, key)] = value

    payload["metrics"].update(cross_method_agreement(payload["methods"]))
    return payload
