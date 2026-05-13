from __future__ import annotations

import random
import re
from typing import Callable, Dict, Iterable, List

import numpy as np
import pandas as pd

from .evaluate import compute_metrics

ENGLISH_STOPWORDS = ["the", "is", "and", "not", "very", "this"]
DIGIT_SUBS = {"a": "4", "e": "3", "i": "1", "o": "0", "s": "5"}


def remove_punctuation(text: str) -> str:
    return re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)


def flip_casing(text: str) -> str:
    return "".join(char.lower() if char.isupper() else char.upper() for char in text)


def digit_swap(text: str) -> str:
    chars = []
    for char in text:
        replacement = DIGIT_SUBS.get(char.lower())
        if replacement and random.random() < 0.3:
            chars.append(replacement)
        else:
            chars.append(char)
    return "".join(chars)


def inject_code_mix_noise(text: str) -> str:
    tokens = text.split()
    if not tokens:
        return text
    insertions = max(1, min(3, len(tokens) // 5))
    for _ in range(insertions):
        index = random.randint(0, len(tokens))
        tokens.insert(index, random.choice(ENGLISH_STOPWORDS))
    return " ".join(tokens)


def run_robustness_suite(
    frame: pd.DataFrame,
    predictor: Callable[[List[str]], Dict[str, np.ndarray]],
    seed: int = 42,
) -> Dict[str, Dict[str, float]]:
    random.seed(seed)
    clean = predictor(frame["tweet"].tolist())
    clean_metrics = compute_metrics(frame["label_id"], clean["predictions"], clean.get("probabilities"))
    scenarios = {
        "clean": frame["tweet"].tolist(),
        "punctuation_removed": [remove_punctuation(text) for text in frame["tweet"]],
        "casing_flipped": [flip_casing(text) for text in frame["tweet"]],
        "digit_swapped": [digit_swap(text) for text in frame["tweet"]],
        "code_mix_noise": [inject_code_mix_noise(text) for text in frame["tweet"]],
    }
    results = {"clean": clean_metrics}
    for name, texts in scenarios.items():
        if name == "clean":
            continue
        output = predictor(texts)
        metrics = compute_metrics(frame["label_id"], output["predictions"], output.get("probabilities"))
        metrics["macro_f1_delta_vs_clean"] = float(metrics["macro_f1"] - clean_metrics["macro_f1"])
        results[name] = metrics
    return results
