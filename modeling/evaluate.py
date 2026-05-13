from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    matthews_corrcoef,
    precision_recall_fscore_support,
    roc_auc_score,
)

from .common import ensure_dir, write_json
from .data import ID_TO_LABEL, LABELS


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def compute_metrics(
    y_true: Iterable[int],
    y_pred: Iterable[int],
    probabilities: Optional[np.ndarray] = None,
    labels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    labels = labels or LABELS
    y_true = np.asarray(list(y_true))
    y_pred = np.asarray(list(y_pred))
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true,
        y_pred,
        labels=list(range(len(labels))),
        zero_division=0,
    )
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="weighted", zero_division=0
    )
    metrics = {
        "accuracy": safe_float(accuracy_score(y_true, y_pred)),
        "macro_precision": safe_float(macro_precision),
        "macro_recall": safe_float(macro_recall),
        "macro_f1": safe_float(macro_f1),
        "weighted_precision": safe_float(weighted_precision),
        "weighted_recall": safe_float(weighted_recall),
        "weighted_f1": safe_float(weighted_f1),
        "mcc": safe_float(matthews_corrcoef(y_true, y_pred)),
        "support": int(len(y_true)),
        "per_class": {},
        "classification_report": classification_report(
            y_true,
            y_pred,
            labels=list(range(len(labels))),
            target_names=labels,
            zero_division=0,
            output_dict=True,
        ),
        "confusion_matrix": confusion_matrix(
            y_true,
            y_pred,
            labels=list(range(len(labels))),
        ).tolist(),
    }
    for idx, label in enumerate(labels):
        metrics["per_class"][label] = {
            "precision": safe_float(precision[idx]),
            "recall": safe_float(recall[idx]),
            "f1": safe_float(f1[idx]),
            "support": int(support[idx]),
        }

    if probabilities is not None:
        try:
            metrics["roc_auc_ovr"] = safe_float(
                roc_auc_score(y_true, probabilities, multi_class="ovr", average="macro")
            )
        except Exception:
            metrics["roc_auc_ovr"] = None
    else:
        metrics["roc_auc_ovr"] = None

    return metrics


def write_predictions_csv(
    path: Path,
    frame: pd.DataFrame,
    predictions: Iterable[int],
    probabilities: Optional[np.ndarray] = None,
) -> pd.DataFrame:
    out = frame.copy().reset_index(drop=True)
    pred_ids = list(predictions)
    out["pred_label_id"] = pred_ids
    out["pred_label"] = [ID_TO_LABEL[int(idx)] for idx in pred_ids]
    if probabilities is not None:
        probs = np.asarray(probabilities)
        for idx, label in enumerate(LABELS):
            out["prob_{0}".format(label.lower())] = probs[:, idx]
    ensure_dir(path.parent)
    out.to_csv(path, index=False)
    return out


def dump_error_rows(
    path: Path,
    predictions_frame: pd.DataFrame,
    top_k: int = 20,
) -> pd.DataFrame:
    rows = []
    for label in LABELS:
        false_positives = predictions_frame[
            (predictions_frame["label"] != label) & (predictions_frame["pred_label"] == label)
        ].head(top_k)
        false_negatives = predictions_frame[
            (predictions_frame["label"] == label) & (predictions_frame["pred_label"] != label)
        ].head(top_k)
        for error_type, subset in (("false_positive", false_positives), ("false_negative", false_negatives)):
            subset = subset.copy()
            subset["error_type"] = error_type
            subset["focus_class"] = label
            rows.append(subset)
    if rows:
        errors = pd.concat(rows, ignore_index=True)
    else:
        errors = predictions_frame.head(0).copy()
        errors["error_type"] = []
        errors["focus_class"] = []
    ensure_dir(path.parent)
    errors.to_csv(path, index=False)
    return errors


def plot_confusion_matrix(path: Path, matrix: np.ndarray, labels: Optional[List[str]] = None) -> None:
    labels = labels or LABELS
    # Force a headless, non-interactive backend. In Jupyter on macOS the
    # default inline / GUI backend can deadlock on the 2nd+ savefig call
    # (e.g. when plotting both dev and test confusion matrices in one run).
    try:
        import matplotlib

        matplotlib.use("Agg", force=False)
        import matplotlib.pyplot as plt

        if plt.get_backend().lower() != "agg":
            plt.switch_backend("Agg")
        import seaborn as sns
    except ImportError:
        return
    ensure_dir(path.parent)
    fig = None
    try:
        fig, ax = plt.subplots(figsize=(6, 5))
        sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=labels, yticklabels=labels, ax=ax)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title("Confusion Matrix")
        fig.tight_layout()
        fig.savefig(str(path), dpi=200)
    finally:
        try:
            if fig is not None:
                plt.close(fig)
            plt.close("all")
        except Exception:
            pass


def save_evaluation_bundle(
    output_dir: Path,
    frame: pd.DataFrame,
    predictions: Iterable[int],
    probabilities: Optional[np.ndarray] = None,
    split_name: str = "test",
) -> Dict[str, Any]:
    metrics = compute_metrics(frame["label_id"], predictions, probabilities=probabilities)
    write_json(output_dir / "{0}_metrics.json".format(split_name), metrics)
    predictions_frame = write_predictions_csv(
        output_dir / "predictions_{0}.csv".format(split_name),
        frame,
        predictions,
        probabilities=probabilities,
    )
    dump_error_rows(output_dir / "errors_{0}.csv".format(split_name), predictions_frame)
    plot_confusion_matrix(
        output_dir / "confusion_matrix_{0}.png".format(split_name),
        np.asarray(metrics["confusion_matrix"]),
    )
    return metrics
