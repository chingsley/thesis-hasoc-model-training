from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from .common import DATASET_DIR

LABELS = ["Normal", "Abuse", "Hate"]
LABEL_TO_ID = {label: idx for idx, label in enumerate(LABELS)}
ID_TO_LABEL = {idx: label for label, idx in LABEL_TO_ID.items()}
DEFAULT_SPLITS = ("train", "dev", "test")
SUPPORTED_LANGUAGES = ("igbo", "yoruba")


@dataclass
class DatasetBundle(object):
    language: str
    train: pd.DataFrame
    dev: pd.DataFrame
    test: pd.DataFrame


def dataset_path(language: str, split: str, dataset_dir: Optional[Path] = None) -> Path:
    base_dir = dataset_dir or DATASET_DIR
    return base_dir / "{0}_{1}.csv".format(language, split)


def normalize_label(value: str) -> str:
    if value not in LABEL_TO_ID:
        raise ValueError("Unknown label: {0}".format(value))
    return value


def load_split(language: str, split: str, dataset_dir: Optional[Path] = None) -> pd.DataFrame:
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError("Unsupported language: {0}".format(language))
    path = dataset_path(language, split, dataset_dir=dataset_dir)
    if not path.exists():
        raise FileNotFoundError(path)
    frame = pd.read_csv(path)
    required = {"id", "tweet", "label"}
    if not required.issubset(frame.columns):
        raise ValueError("Missing required columns in {0}".format(path))
    frame = frame.copy()
    frame["tweet"] = frame["tweet"].fillna("").astype(str)
    frame["label"] = frame["label"].map(normalize_label)
    frame["label_id"] = frame["label"].map(LABEL_TO_ID)
    frame["language"] = language
    frame["split"] = split
    if "length" not in frame.columns:
        frame["length"] = frame["tweet"].str.len()
    return frame


def load_language_bundle(language: str, dataset_dir: Optional[Path] = None) -> DatasetBundle:
    return DatasetBundle(
        language=language,
        train=load_split(language, "train", dataset_dir=dataset_dir),
        dev=load_split(language, "dev", dataset_dir=dataset_dir),
        test=load_split(language, "test", dataset_dir=dataset_dir),
    )


def load_joint_bundle(languages: Optional[Iterable[str]] = None, dataset_dir: Optional[Path] = None) -> DatasetBundle:
    languages = list(languages or SUPPORTED_LANGUAGES)
    splits = {}
    for split in DEFAULT_SPLITS:
        parts = [load_split(language, split, dataset_dir=dataset_dir) for language in languages]
        splits[split] = pd.concat(parts, ignore_index=True)
    return DatasetBundle(language="+".join(languages), train=splits["train"], dev=splits["dev"], test=splits["test"])


def compute_class_weights(frame: pd.DataFrame) -> np.ndarray:
    counts = frame["label_id"].value_counts().sort_index()
    total = float(len(frame))
    weights = []
    for label_id in range(len(LABELS)):
        count = float(counts.get(label_id, 0.0))
        if count == 0:
            weights.append(0.0)
        else:
            weights.append(total / (len(LABELS) * count))
    return np.asarray(weights, dtype=np.float32)


def compute_sample_weights(frame: pd.DataFrame) -> np.ndarray:
    class_weights = compute_class_weights(frame)
    return frame["label_id"].map(lambda idx: float(class_weights[int(idx)])).to_numpy()


def label_distribution(frame: pd.DataFrame) -> Dict[str, int]:
    counts = frame["label"].value_counts()
    return {label: int(counts.get(label, 0)) for label in LABELS}


def to_hf_dataset(frame: pd.DataFrame):
    try:
        from datasets import Dataset
    except ImportError as exc:
        raise ImportError("datasets is required for HF Dataset conversion") from exc
    columns = ["id", "tweet", "label", "label_id", "language", "split", "length"]
    available = [column for column in columns if column in frame.columns]
    return Dataset.from_pandas(frame[available], preserve_index=False)


def load_multilingual_optional(dataset_dir: Optional[Path] = None) -> pd.DataFrame:
    path = (dataset_dir or DATASET_DIR) / "multilingual_hate_speech_dataset.csv"
    frame = pd.read_csv(path)
    required = {"class", "text", "language"}
    if not required.issubset(frame.columns):
        raise ValueError("Missing required columns in {0}".format(path))
    frame = frame.copy()
    frame["text"] = frame["text"].fillna("").astype(str)
    frame = frame[frame["text"].str.len() > 0].reset_index(drop=True)
    class_map = {0: "Normal", 1: "Abuse", 2: "Hate"}
    frame["label"] = frame["class"].map(class_map)
    frame = frame[frame["label"].isin(LABELS)].reset_index(drop=True)
    frame["label_id"] = frame["label"].map(LABEL_TO_ID)
    frame["id"] = ["multilingual_{0:05d}".format(i) for i in range(1, len(frame) + 1)]
    frame["tweet"] = frame["text"]
    frame["split"] = "augmentation"
    frame["length"] = frame["tweet"].str.len()
    return frame[["id", "tweet", "label", "label_id", "language", "split", "length"]]
