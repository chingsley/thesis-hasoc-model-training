from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

from .common import RUNS_DIR, ensure_dir
from .data import LABELS

ALL_METHODS = ("lime", "shap", "attention_rollout", "integrated_gradients")


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

    def _baseline_input_ids(self, input_ids, reference_token_id: int):
        # Keep special tokens (e.g. <s>/</s>) in place and replace the actual
        # content tokens with a neutral reference (PAD). Integrated Gradients
        # measures the contribution of moving from this baseline to the real text.
        special_ids = set(self.tokenizer.all_special_ids)
        baseline = input_ids.clone()
        for position in range(baseline.size(1)):
            if int(baseline[0, position]) not in special_ids:
                baseline[0, position] = reference_token_id
        return baseline

    def integrated_gradients(self, text: str, n_steps: int = 50) -> Dict:
        try:
            from captum.attr import LayerIntegratedGradients
        except ImportError as exc:
            raise ImportError("captum is required for integrated gradients explanations") from exc

        encoded = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
        input_ids = encoded["input_ids"]
        attention_mask = encoded.get("attention_mask")
        if attention_mask is None:
            attention_mask = self.torch.ones_like(input_ids)

        reference_token_id = self.tokenizer.pad_token_id
        if reference_token_id is None:
            reference_token_id = self.tokenizer.unk_token_id or 0
        baseline_ids = self._baseline_input_ids(input_ids, reference_token_id)

        top_class = int(np.argmax(self.predict_proba([text])[0]))
        embedding_layer = self.model.get_input_embeddings()

        def forward_func(ids, mask):
            return self.model(input_ids=ids, attention_mask=mask).logits

        explainer = LayerIntegratedGradients(forward_func, embedding_layer)
        attributions = explainer.attribute(
            inputs=input_ids,
            baselines=baseline_ids,
            additional_forward_args=(attention_mask,),
            target=top_class,
            n_steps=n_steps,
        )
        # Collapse the embedding dimension to a single score per token, then
        # L2-normalize so scores are comparable across sentences of different length.
        token_scores = attributions.sum(dim=-1).squeeze(0)
        norm = self.torch.norm(token_scores)
        if float(norm) > 0:
            token_scores = token_scores / norm
        token_scores = token_scores.detach().cpu().numpy()
        tokens = self.tokenizer.convert_ids_to_tokens(input_ids[0])
        return {
            "method": "integrated_gradients",
            "predicted_label": LABELS[top_class],
            "tokens": tokens,
            "scores": [{"token": token, "score": float(score)} for token, score in zip(tokens, token_scores)],
        }


def _normalize_token(token: Optional[str]) -> str:
    # Strip subword markers (RoBERTa "Ġ", SentencePiece "▁") and casing so that
    # subword attributions (SHAP / integrated gradients / attention) can be
    # matched against whitespace-split words.
    if token is None:
        return ""
    return token.replace("\u0120", "").replace("\u2581", "").strip().lower()


def compute_explanation_metrics(text: str, attribution_scores: List[Dict[str, float]], predictor) -> Dict[str, float]:
    ranked = sorted(attribution_scores, key=lambda item: abs(item["score"]), reverse=True)
    baseline = predictor([text])[0]
    top_label = int(np.argmax(baseline))
    tokens = text.split()
    important_tokens = set(_normalize_token(item["token"]) for item in ranked[: max(1, len(ranked) // 5)])
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


def cross_method_agreement(methods: Dict[str, Dict], top_k: int = 5) -> Dict[str, float]:
    # Quantify whether the methods point at the same salient tokens: for each
    # method take its top-k tokens by |score|, then report pairwise Jaccard
    # overlap (plus the mean across all available pairs).
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
    first_tokens = set([item[0] if isinstance(item, tuple) else item.get("token") for item in first["scores"][:10]])
    second_tokens = set([item[0] if isinstance(item, tuple) else item.get("token") for item in second["scores"][:10]])
    if not first_tokens and not second_tokens:
        return 1.0
    return float(len(first_tokens & second_tokens)) / float(len(first_tokens | second_tokens))


def _safe_call(func):
    # Run one explanation method without letting a missing optional dependency
    # (e.g. captum/shap not installed) or a runtime error abort the whole row.
    try:
        return func(), None
    except ImportError as exc:
        return None, "missing dependency: {0}".format(exc)
    except Exception as exc:  # noqa: BLE001 - we intentionally isolate per-method failures
        return None, "error: {0}".format(exc)


def _scores_as_pairs(explanation: Optional[Dict]) -> List[Dict[str, float]]:
    # Normalize LIME ((token, score) tuples) and token-based methods
    # ({"token", "score"} dicts) into one [{"token", "score"}] shape.
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


def select_explanation_rows(
    frame: pd.DataFrame,
    num_rows: int = 10,
    balanced: bool = True,
    seed: int = 42,
) -> pd.DataFrame:
    if num_rows <= 0:
        return frame.head(0)
    if not balanced or "label" not in frame.columns:
        return frame.head(num_rows)
    labels = list(frame["label"].unique())
    if not labels:
        return frame.head(num_rows)
    per_label = max(1, num_rows // len(labels))
    parts = []
    for label in labels:
        subset = frame[frame["label"] == label]
        take = min(per_label, len(subset))
        if take > 0:
            parts.append(subset.sample(n=take, random_state=seed))
    if not parts:
        return frame.head(num_rows)
    selected = pd.concat(parts, ignore_index=True)
    if len(selected) < num_rows:
        remaining = frame[~frame["id"].isin(selected["id"])]
        extra = min(num_rows - len(selected), len(remaining))
        if extra > 0:
            selected = pd.concat(
                [selected, remaining.sample(n=extra, random_state=seed)], ignore_index=True
            )
    return selected.head(num_rows)


def _color_for_score(score: float, max_abs: float) -> str:
    if max_abs <= 0:
        return "transparent"
    intensity = min(1.0, abs(score) / max_abs)
    alpha = 0.15 + 0.65 * intensity
    # Red = pushes the model toward the predicted class, blue = pushes away.
    if score >= 0:
        return "rgba(214, 39, 40, {0:.3f})".format(alpha)
    return "rgba(31, 119, 180, {0:.3f})".format(alpha)


def _render_tokens_html(explanation: Optional[Dict]) -> str:
    pairs = _scores_as_pairs(explanation)
    if not pairs:
        return "<em>(no attributions)</em>"
    max_abs = max((abs(pair["score"]) for pair in pairs), default=0.0)
    spans = []
    for pair in pairs:
        raw = pair["token"] or ""
        readable = html.escape(raw).replace("\u0120", " ").replace("\u2581", " ")
        color = _color_for_score(pair["score"], max_abs)
        spans.append(
            '<span title="{0:.4f}" style="background-color:{1};padding:1px 3px;border-radius:3px;">{2}</span>'.format(
                pair["score"], color, readable
            )
        )
    return " ".join(spans)


def render_explanation_html(payload: Dict, path: Path) -> Path:
    sections = []
    for name, explanation in payload.get("methods", {}).items():
        if explanation and "error" in explanation:
            body = "<em>skipped: {0}</em>".format(html.escape(str(explanation["error"])))
        else:
            body = _render_tokens_html(explanation)
        sections.append(
            "<h3>{0}</h3><p style=\"line-height:2.2;font-size:16px;\">{1}</p>".format(
                html.escape(name), body
            )
        )
    metric_rows = []
    for key, value in sorted(payload.get("metrics", {}).items()):
        if isinstance(value, float):
            metric_rows.append("<tr><td>{0}</td><td>{1:.4f}</td></tr>".format(html.escape(key), value))
        else:
            metric_rows.append(
                "<tr><td>{0}</td><td>{1}</td></tr>".format(html.escape(key), html.escape(str(value)))
            )
    document = (
        "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\">"
        "<title>Explanation {id}</title>"
        "<style>body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#222;}}"
        "table{{border-collapse:collapse;}}td{{border:1px solid #ddd;padding:4px 8px;}}"
        ".meta{{color:#555;}}</style></head><body>"
        "<h2>Explanation for {id}</h2>"
        "<p class=\"meta\"><strong>True label:</strong> {label} &nbsp; "
        "<strong>Text:</strong> {text}</p>"
        "<p class=\"meta\">Red = token pushed the model <em>toward</em> the predicted class; "
        "blue = pushed <em>away</em>. Hover a token to see its score.</p>"
        "{sections}"
        "<h3>Quality metrics</h3><table>{metrics}</table>"
        "</body></html>"
    ).format(
        id=html.escape(str(payload.get("id", ""))),
        label=html.escape(str(payload.get("label", ""))),
        text=html.escape(str(payload.get("text", ""))),
        sections="".join(sections),
        metrics="".join(metric_rows) or "<tr><td>(none)</td><td></td></tr>",
    )
    ensure_dir(path.parent)
    path.write_text(document, encoding="utf-8")
    return path


def latest_run_dir(
    run_name: str, language: str, runs_dir: Optional[Path] = None
) -> Optional[Path]:
    base = (runs_dir or RUNS_DIR) / run_name / language
    if not base.exists():
        return None
    timestamped = [child for child in base.iterdir() if child.is_dir() and (child / "config.json").exists()]
    if not timestamped:
        timestamped = [child for child in base.iterdir() if child.is_dir()]
    if not timestamped:
        return None
    return sorted(timestamped, key=lambda child: child.name)[-1]


def explain_rows(
    run_dir: Path,
    rows: pd.DataFrame,
    output_dir: Optional[Path] = None,
    methods: Optional[Sequence[str]] = None,
    write_html: bool = True,
) -> List[Path]:
    explainer = TransformerExplainer(run_dir)
    selected_methods = tuple(methods) if methods else ALL_METHODS
    out_dir = ensure_dir(output_dir or (Path(run_dir) / "explanations"))
    outputs = []
    for _, row in rows.iterrows():
        text = row["tweet"]
        payload: Dict = {
            "id": row["id"],
            "label": row["label"],
            "text": text,
            "methods": {},
            "metrics": {},
        }

        if "lime" in selected_methods:
            lime_first, lime_err = _safe_call(lambda: explainer.lime_explanation(text))
            if lime_first is not None:
                payload["methods"]["lime"] = lime_first
                lime_second, _ = _safe_call(lambda: explainer.lime_explanation(text))
                if lime_second is not None:
                    payload["metrics"]["lime_stability_jaccard"] = explanation_stability(
                        lime_first, lime_second
                    )
            else:
                payload["methods"]["lime"] = {"method": "lime", "error": lime_err}

        for name, runner in (
            ("shap", lambda: explainer.shap_explanation(text)),
            ("attention_rollout", lambda: explainer.attention_rollout(text)),
            ("integrated_gradients", lambda: explainer.integrated_gradients(text)),
        ):
            if name not in selected_methods:
                continue
            output, error = _safe_call(runner)
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

        path = out_dir / "{0}.json".format(row["id"])
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        outputs.append(path)

        if write_html:
            render_explanation_html(payload, out_dir / "{0}.html".format(row["id"]))
    return outputs
