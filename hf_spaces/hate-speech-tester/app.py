"""Gradio demo for HASOC hate-speech classifiers (deploy as a Hugging Face Space)."""

from __future__ import annotations

import os

import gradio as gr
from transformers import pipeline

# Repo IDs follow the same convention as the backend: HF_MODEL_SET picks the
# family, HF_MODEL_ID_<LANG>[_MERGED] overrides an individual repo. Set these in
# the Space's Settings -> Variables to point the demo at the retrained models.
DEFAULT_MODELS = {
    "IGBO": "chingsley/afro-xlmr-igbo-hate",
    "YORUBA": "chingsley/afro-xlmr-yoruba-hate",
    "JOINT": "chingsley/afro-xlmr-joint-igbo-yoruba-hate",
}
LABELS = {
    "IGBO": "Igbo",
    "YORUBA": "Yoruba",
    "JOINT": "Joint (Igbo + Yoruba)",
}


def _resolve_model_id(key: str) -> str:
    model_set = os.getenv("HF_MODEL_SET", "").strip().lower()
    if model_set in ("merged", "v2", "v2-merged"):
        merged = os.getenv(f"HF_MODEL_ID_{key}_MERGED", "").strip()
        if merged:
            return merged
    return os.getenv(f"HF_MODEL_ID_{key}", "").strip() or DEFAULT_MODELS[key]


MODELS = {LABELS[key]: _resolve_model_id(key) for key in DEFAULT_MODELS}

_pipelines: dict[str, object] = {}


def _get_pipeline(language: str):
    if language not in _pipelines:
        model_id = MODELS[language]
        device = 0 if os.getenv("SPACE_ID") else -1  # GPU on HF Spaces when available
        try:
            import torch

            if not torch.cuda.is_available():
                device = -1
        except ImportError:
            device = -1

        _pipelines[language] = pipeline(
            "text-classification",
            model=model_id,
            token=os.getenv("HF_TOKEN"),
            device=device,
            top_k=3,
        )
    return _pipelines[language]


def _normalize_pipeline_output(raw: object) -> list[dict]:
    """Handle transformers pipeline shapes: dict, list[dict], or list[list[dict]]."""
    if isinstance(raw, dict):
        return [raw]
    if not isinstance(raw, list) or not raw:
        return []
    if isinstance(raw[0], dict):
        return raw
    if isinstance(raw[0], list):
        return raw[0]
    return []


def classify(text: str, language: str) -> str:
    text = (text or "").strip()
    if not text:
        return "Enter some text to classify."

    clf = _get_pipeline(language)
    raw = clf(text)
    results = _normalize_pipeline_output(raw)
    if not results:
        return "No prediction returned."

    # Highest score first
    results = sorted(results, key=lambda x: float(x["score"]), reverse=True)
    top = results[0]

    lines = [
        f"Model: {MODELS[language]}",
        "",
        f"Predicted: {top['label']} ({float(top['score']) * 100:.1f}%)",
        "",
        "All classes:",
    ]
    for item in results:
        lines.append(f"  {item['label']}: {float(item['score']) * 100:.1f}%")
    return "\n".join(lines)


demo = gr.Interface(
    fn=classify,
    inputs=[
        gr.Textbox(
            label="Text",
            placeholder="Paste Igbo or Yoruba text here…",
            lines=4,
        ),
        gr.Dropdown(
            label="Model",
            choices=list(MODELS.keys()),
            value="Igbo",
        ),
    ],
    outputs=gr.Textbox(label="Prediction", lines=8),
    title="HASOC Hate Speech Classifier",
    description=(
        "3-class classification: **Normal**, **Abuse**, **Hate**. "
        "Pick the model that matches your language."
    ),
    examples=[
        ["Ndi Igbo ndi a bu ndi aghugho, ha kweghi ekwe.", "Igbo"],
        ["Omo ale ni e, e ko ni oye rara.", "Yoruba"],
    ],
)

if __name__ == "__main__":
    demo.launch()
