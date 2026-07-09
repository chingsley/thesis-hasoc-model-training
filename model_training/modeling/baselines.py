from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from .common import RUNS_DIR, ensure_dir, timestamp, write_json
from .data import LABELS, load_language_bundle
from .evaluate import save_evaluation_bundle
from .reports import append_phase2_run
from .robustness import run_robustness_suite


def _probabilities_from_model(model, texts: List[str]) -> Optional[np.ndarray]:
    if hasattr(model, "predict_proba"):
        return model.predict_proba(texts)
    if hasattr(model, "decision_function"):
        scores = model.decision_function(texts)
        if scores.ndim == 1:
            scores = np.column_stack([-scores, scores])
        scores = np.asarray(scores, dtype=np.float64)
        scores = scores - np.max(scores, axis=1, keepdims=True)
        exps = np.exp(scores)
        return exps / np.sum(exps, axis=1, keepdims=True)
    return None


def _predict_with_model(model, texts: List[str]) -> Dict[str, np.ndarray]:
    predictions = model.predict(texts)
    probabilities = _probabilities_from_model(model, texts)
    return {"predictions": np.asarray(predictions), "probabilities": probabilities}


def train_tfidf_nb(train_texts: List[str], train_labels: List[int]) -> Pipeline:
    return Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True, min_df=2)),
            ("clf", MultinomialNB()),
        ]
    ).fit(train_texts, train_labels)


def train_tfidf_svc(train_texts: List[str], train_labels: List[int]) -> Pipeline:
    base = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True, min_df=2)),
            ("clf", LinearSVC(class_weight="balanced")),
        ]
    )
    return CalibratedClassifierCV(base, cv=3).fit(train_texts, train_labels)


def run_zero_shot_baseline(
    texts: List[str],
    model_name: str,
    hypothesis_template: str = "This tweet is {}.",
) -> Dict[str, np.ndarray]:
    try:
        from transformers import pipeline
    except ImportError as exc:
        raise ImportError("transformers is required for zero-shot baselines") from exc

    classifier = pipeline("zero-shot-classification", model=model_name)
    candidate_labels = ["Normal content", "Abusive content", "Hateful content"]
    label_map = {
        "Normal content": 0,
        "Abusive content": 1,
        "Hateful content": 2,
    }
    predictions = []
    probabilities = []
    for text in texts:
        result = classifier(text, candidate_labels=candidate_labels, hypothesis_template=hypothesis_template)
        probs = np.zeros(len(LABELS), dtype=np.float64)
        for label, score in zip(result["labels"], result["scores"]):
            probs[label_map[label]] = float(score)
        probabilities.append(probs)
        predictions.append(int(np.argmax(probs)))
    return {"predictions": np.asarray(predictions), "probabilities": np.asarray(probabilities)}


def run_all_baselines(language: str, output_dir: Optional[Path] = None) -> Dict[str, Dict]:
    bundle = load_language_bundle(language)
    run_root = output_dir or (RUNS_DIR / "baselines" / language / timestamp())
    ensure_dir(run_root)
    results = {}

    trained_models = {
        "tfidf_nb": train_tfidf_nb(bundle.train["tweet"].tolist(), bundle.train["label_id"].tolist()),
        "tfidf_linear_svc": train_tfidf_svc(bundle.train["tweet"].tolist(), bundle.train["label_id"].tolist()),
    }
    for name, model in trained_models.items():
        model_dir = ensure_dir(run_root / name)
        test_outputs = _predict_with_model(model, bundle.test["tweet"].tolist())
        dev_outputs = _predict_with_model(model, bundle.dev["tweet"].tolist())
        metrics = {
            "dev": save_evaluation_bundle(model_dir, bundle.dev, dev_outputs["predictions"], dev_outputs["probabilities"], split_name="dev"),
            "test": save_evaluation_bundle(model_dir, bundle.test, test_outputs["predictions"], test_outputs["probabilities"], split_name="test"),
            "robustness": run_robustness_suite(bundle.test, lambda texts, current_model=model: _predict_with_model(current_model, texts)),
        }
        write_json(model_dir / "metrics.json", metrics)
        results[name] = metrics
        append_phase2_run(
            task_type="baseline",
            run_name=name,
            language=language,
            model_name=name,
            output_dir=model_dir,
            metrics=metrics["test"],
        )

    # Zero-shot classification requires an NLI/XNLI-finetuned checkpoint; using
    # raw MLM models like xlm-roberta-base attaches a random classification head
    # and produces meaningless scores. These two multilingual NLI checkpoints
    # are the standard references in the literature.
    zero_shot_models = {
        "zero_shot_mdeberta_xnli": "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli",
        "zero_shot_xlmr_xnli": "joeddav/xlm-roberta-large-xnli",
    }
    for name, model_name in zero_shot_models.items():
        model_dir = ensure_dir(run_root / name)
        try:
            dev_outputs = run_zero_shot_baseline(bundle.dev["tweet"].tolist(), model_name=model_name)
            test_outputs = run_zero_shot_baseline(bundle.test["tweet"].tolist(), model_name=model_name)
            metrics = {
                "dev": save_evaluation_bundle(model_dir, bundle.dev, dev_outputs["predictions"], dev_outputs["probabilities"], split_name="dev"),
                "test": save_evaluation_bundle(model_dir, bundle.test, test_outputs["predictions"], test_outputs["probabilities"], split_name="test"),
                "robustness": run_robustness_suite(
                    bundle.test,
                    lambda texts, current_model=model_name: run_zero_shot_baseline(texts, model_name=current_model),
                ),
            }
            write_json(model_dir / "metrics.json", metrics)
            results[name] = metrics
            append_phase2_run(
                task_type="baseline",
                run_name=name,
                language=language,
                model_name=model_name,
                output_dir=model_dir,
                metrics=metrics["test"],
            )
        except Exception as exc:
            payload = {"error": str(exc), "model_name": model_name}
            write_json(model_dir / "metrics.json", payload)
            results[name] = payload

    write_json(run_root / "metrics.json", results)
    return results
