from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd
import yaml

# HuggingFace `tokenizers` warns and can deadlock when its background threads
# are inherited across a fork (very visible on macOS). Disable parallelism
# unless the user explicitly opted in via the env var.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from .augment import maybe_augment_training_frame
from .common import RUNS_DIR, ensure_dir, seed_everything, timestamp, write_json
from .data import LABELS, compute_class_weights, compute_sample_weights, load_joint_bundle, load_language_bundle, to_hf_dataset
from .evaluate import compute_metrics, save_evaluation_bundle
from .reports import append_phase2_run
from .robustness import run_robustness_suite


@dataclass
class TrainingConfig(object):
    run_name: str
    model_name: str
    language: str
    seed: int = 42
    max_length: int = 256
    output_root: str = "runs"
    num_train_epochs: int = 5
    learning_rate: float = 2e-5
    train_batch_size: int = 16
    eval_batch_size: int = 32
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    gradient_accumulation_steps: int = 1
    fp16: bool = False
    metric_for_best_model: str = "macro_f1"
    weighted_loss: bool = True
    weighted_sampler: bool = False
    focal_loss_gamma: Optional[float] = None
    augmentation: Optional[Dict[str, Any]] = None
    hyperparameter_search: Optional[Dict[str, Any]] = None


def load_config(path: Path) -> TrainingConfig:
    with Path(path).open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)
    return TrainingConfig(**payload)


def _require_transformers():
    try:
        import torch
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            EarlyStoppingCallback,
            Trainer,
            TrainingArguments,
        )
    except ImportError as exc:
        raise ImportError("torch and transformers are required for fine-tuning") from exc
    return torch, AutoModelForSequenceClassification, AutoTokenizer, EarlyStoppingCallback, Trainer, TrainingArguments


def _build_training_arguments(TrainingArguments, **kwargs):
    """Construct TrainingArguments across transformers >=4.40 <5.0.

    The parameter was renamed from `evaluation_strategy` to `eval_strategy`
    starting in transformers 4.46. We try the new name first and fall back
    to the old name if the installed version predates the rename.
    """
    import inspect

    params = inspect.signature(TrainingArguments).parameters
    eval_strategy = kwargs.pop("eval_strategy", None)
    if eval_strategy is not None:
        if "eval_strategy" in params:
            kwargs["eval_strategy"] = eval_strategy
        else:
            kwargs["evaluation_strategy"] = eval_strategy
    if os.environ.get("MODELING_DISABLE_TQDM", "").strip().lower() in ("1", "true", "yes"):
        if "disable_tqdm" in params:
            kwargs.setdefault("disable_tqdm", True)
    return TrainingArguments(**kwargs)


class WeightedLossTrainerMixin(object):
    def __init__(self, *args, **kwargs):
        self.class_weights = kwargs.pop("class_weights", None)
        self.focal_loss_gamma = kwargs.pop("focal_loss_gamma", None)
        self.sample_weights = kwargs.pop("sample_weights", None)
        super(WeightedLossTrainerMixin, self).__init__(*args, **kwargs)

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        # `**kwargs` accepts `num_items_in_batch` introduced in transformers >= 4.46
        # without breaking older versions that still call with only positional args.
        import torch

        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.get("logits")
        weight = None
        if self.class_weights is not None:
            weight = self.class_weights.to(logits.device)
        if self.focal_loss_gamma is None:
            loss_fn = torch.nn.CrossEntropyLoss(weight=weight)
            loss = loss_fn(logits, labels)
        else:
            ce_loss = torch.nn.functional.cross_entropy(
                logits,
                labels,
                weight=weight,
                reduction="none",
            )
            pt = torch.exp(-ce_loss)
            loss = ((1 - pt) ** self.focal_loss_gamma * ce_loss).mean()
        return (loss, outputs) if return_outputs else loss

    def _get_train_sampler(self, *args, **kwargs):
        if self.sample_weights is None:
            return super(WeightedLossTrainerMixin, self)._get_train_sampler(*args, **kwargs)
        import torch

        return torch.utils.data.WeightedRandomSampler(
            weights=torch.DoubleTensor(self.sample_weights.tolist()),
            num_samples=len(self.sample_weights),
            replacement=True,
        )


def _build_trainer_class(base_trainer):
    return type("Phase2Trainer", (WeightedLossTrainerMixin, base_trainer), {})


def _tokenize_dataset(tokenizer, dataset, max_length):
    def encode(batch):
        return tokenizer(batch["tweet"], truncation=True, padding="max_length", max_length=max_length)

    return dataset.map(encode, batched=True)


def _compute_metrics(eval_pred):
    logits, labels = eval_pred
    probabilities = _softmax(logits)
    predictions = _argmax_axis1(probabilities)
    metrics = compute_metrics(labels, predictions, probabilities=probabilities)
    roc_auc = metrics["roc_auc_ovr"]
    return {
        "accuracy": metrics["accuracy"],
        "macro_f1": metrics["macro_f1"],
        "weighted_f1": metrics["weighted_f1"],
        "macro_precision": metrics["macro_precision"],
        "macro_recall": metrics["macro_recall"],
        "roc_auc_ovr": float("nan") if roc_auc is None else roc_auc,
        "mcc": metrics["mcc"],
    }


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Stable softmax using torch (avoids NumPy ufunc issues from mixed 1.x/2.x installs)."""
    import torch
    import torch.nn.functional as F

    t = torch.as_tensor(logits, dtype=torch.float32)
    return F.softmax(t, dim=-1).detach().cpu().numpy()


def _argmax_axis1(probabilities: np.ndarray) -> np.ndarray:
    import torch

    return torch.as_tensor(probabilities, dtype=torch.float32).argmax(dim=-1).detach().cpu().numpy()


def _load_bundle(language: str):
    if language == "joint_igbo_yoruba":
        return load_joint_bundle(["igbo", "yoruba"])
    return load_language_bundle(language)


def _prepare_frames(config: TrainingConfig):
    bundle = _load_bundle(config.language)
    train_frame = bundle.train
    if config.augmentation:
        train_frame = maybe_augment_training_frame(
            train_frame,
            language="igbo" if config.language == "joint_igbo_yoruba" else config.language,
            enable_back_translation=bool(config.augmentation.get("back_translation")),
            enable_eda=bool(config.augmentation.get("eda")),
        )
    return bundle, train_frame


def train_from_config(
    config_path: Optional[Path] = None,
    config: Optional["TrainingConfig"] = None,
    language_override: Optional[str] = None,
) -> Path:
    torch, AutoModelForSequenceClassification, AutoTokenizer, EarlyStoppingCallback, Trainer, TrainingArguments = _require_transformers()
    if config is None:
        if config_path is None:
            raise ValueError("train_from_config requires either config_path or config")
        config = load_config(config_path)
    if language_override is not None:
        config.language = language_override
    seed_everything(config.seed)
    bundle, train_frame = _prepare_frames(config)
    train_dataset = to_hf_dataset(train_frame)
    dev_dataset = to_hf_dataset(bundle.dev)
    test_frame = bundle.test.copy()

    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        config.model_name,
        num_labels=len(LABELS),
        id2label={idx: label for idx, label in enumerate(LABELS)},
        label2id={label: idx for idx, label in enumerate(LABELS)},
    )

    train_dataset = _tokenize_dataset(tokenizer, train_dataset, config.max_length)
    dev_dataset = _tokenize_dataset(tokenizer, dev_dataset, config.max_length)
    train_dataset = train_dataset.rename_column("label_id", "labels")
    dev_dataset = dev_dataset.rename_column("label_id", "labels")
    train_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])
    dev_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])

    run_dir = ensure_dir(RUNS_DIR / config.run_name / config.language / timestamp())
    trainer_class = _build_trainer_class(Trainer)
    class_weights = None
    if config.weighted_loss:
        class_weights = torch.tensor(compute_class_weights(train_frame), dtype=torch.float)
    best_params = maybe_run_optuna(config, trainer_class, tokenizer, train_frame, bundle.dev)
    if best_params:
        config.learning_rate = best_params.get("learning_rate", config.learning_rate)
        config.num_train_epochs = best_params.get("num_train_epochs", config.num_train_epochs)
        config.train_batch_size = best_params.get("train_batch_size", config.train_batch_size)
        config.warmup_ratio = best_params.get("warmup_ratio", config.warmup_ratio)

    args = _build_training_arguments(
        TrainingArguments,
        output_dir=str(run_dir),
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="epoch",
        learning_rate=config.learning_rate,
        num_train_epochs=config.num_train_epochs,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        weight_decay=config.weight_decay,
        warmup_ratio=config.warmup_ratio,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        load_best_model_at_end=True,
        metric_for_best_model=config.metric_for_best_model,
        greater_is_better=True,
        report_to=[],
        fp16=bool(config.fp16),
        seed=config.seed,
    )
    trainer = trainer_class(
        model=model,
        args=args,
        train_dataset=train_dataset,
        eval_dataset=dev_dataset,
        tokenizer=tokenizer,
        compute_metrics=_compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
        class_weights=class_weights,
        focal_loss_gamma=config.focal_loss_gamma,
        sample_weights=compute_sample_weights(train_frame) if config.weighted_sampler else None,
    )
    trainer.train()
    trainer.save_model(str(run_dir))
    tokenizer.save_pretrained(str(run_dir))

    # Use the in-memory predictor instead of `trainer.predict(...)` for the
    # post-training dev/test scoring. Calling `trainer.predict` a second time
    # in the same process deadlocks on macOS / CPU under the current
    # transformers + accelerate stack (after `trainer.train()`, the wrapped
    # eval DataLoader does not always release cleanly between calls). The
    # in-process batched predictor is also faster because it skips an extra
    # `datasets.map` tokenisation pass for the test split.
    dev_out = _predict_with_model(
        trainer.model,
        tokenizer,
        bundle.dev["tweet"].tolist(),
        batch_size=config.eval_batch_size,
        max_length=config.max_length,
    )
    dev_metrics = save_evaluation_bundle(
        run_dir, bundle.dev, dev_out["predictions"], dev_out["probabilities"], split_name="dev"
    )

    test_out = _predict_with_model(
        trainer.model,
        tokenizer,
        test_frame["tweet"].tolist(),
        batch_size=config.eval_batch_size,
        max_length=config.max_length,
    )
    test_metrics = save_evaluation_bundle(
        run_dir, test_frame, test_out["predictions"], test_out["probabilities"], split_name="test"
    )

    robustness = run_robustness_suite(
        test_frame,
        lambda texts: _predict_with_model(
            trainer.model,
            tokenizer,
            texts,
            batch_size=config.eval_batch_size,
            max_length=config.max_length,
        ),
        seed=config.seed,
    )
    payload = {
        "config": config.__dict__,
        "best_hyperparameters": best_params,
        "dev": dev_metrics,
        "test": test_metrics,
        "robustness": robustness,
    }
    write_json(run_dir / "metrics.json", payload)
    with (run_dir / "training_args.json").open("w", encoding="utf-8") as handle:
        json.dump(args.to_dict(), handle, indent=2)
    append_phase2_run(
        task_type="fine_tune",
        run_name=run_dir.name,
        language=config.language,
        model_name=config.model_name,
        output_dir=run_dir,
        metrics=test_metrics,
    )
    return run_dir


def _predict_with_model(
    model,
    tokenizer,
    texts: Iterable[str],
    *,
    batch_size: int = 32,
    max_length: int = 256,
    device=None,
):
    """Batched inference that reuses an already-loaded model + tokenizer.

    Doing one forward pass over hundreds of long sequences (the previous
    behaviour) effectively hangs on a CPU-only machine because of the huge
    attention-matrix allocation. Iterate in chunks instead.
    """
    import torch

    if device is None:
        device = next(model.parameters()).device
    model.eval()
    text_list: List[str] = [str(t) for t in texts]
    if not text_list:
        empty_probs = np.zeros((0, 0), dtype=np.float32)
        return {"predictions": np.zeros((0,), dtype=np.int64), "probabilities": empty_probs}
    batch_size = max(1, int(batch_size))
    prob_chunks: List[np.ndarray] = []
    with torch.no_grad():
        for start in range(0, len(text_list), batch_size):
            chunk = text_list[start : start + batch_size]
            encoded = tokenizer(
                chunk,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=max_length,
            )
            encoded = {k: v.to(device) for k, v in encoded.items()}
            outputs = model(**encoded)
            prob_chunks.append(_softmax(outputs.logits.detach().cpu().numpy()))
    probabilities = np.concatenate(prob_chunks, axis=0)
    predictions = _argmax_axis1(probabilities)
    return {"predictions": predictions, "probabilities": probabilities}


def predict_texts(model_dir: str, texts, *, batch_size: int = 32, max_length: int = 256):
    """Load model+tokenizer from disk and run batched inference.

    Kept for backwards compatibility with cross-lingual eval and CLI users.
    Internal training paths now reuse the in-memory model (see
    `_predict_with_model`) to avoid reloading 1+ GB from disk per call.
    """
    torch, AutoModelForSequenceClassification, AutoTokenizer, _, _, _ = _require_transformers()
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    return _predict_with_model(
        model,
        tokenizer,
        texts,
        batch_size=batch_size,
        max_length=max_length,
        device=torch.device("cpu"),
    )


def run_cross_lingual_train_eval(config_path: Path, train_language: str, test_language: str) -> Path:
    config = load_config(config_path)
    run_dir = train_from_config(config=config, language_override=train_language)
    test_bundle = load_language_bundle(test_language)
    predictions = predict_texts(str(run_dir), test_bundle.test["tweet"].tolist())
    test_metrics = save_evaluation_bundle(run_dir, test_bundle.test, predictions["predictions"], predictions["probabilities"], split_name="{0}_test".format(test_language))
    payload = {
        "experiment_type": "cross_lingual",
        "train_language": train_language,
        "test_language": test_language,
        "model_name": config.model_name,
        "test_metrics": test_metrics,
    }
    write_json(run_dir / "cross_lingual_{0}_to_{1}.json".format(train_language, test_language), payload)
    append_phase2_run(
        task_type="cross_lingual",
        run_name=run_dir.name,
        language="{0}->{1}".format(train_language, test_language),
        model_name=config.model_name,
        output_dir=run_dir,
        metrics=test_metrics,
    )
    return run_dir


def maybe_run_optuna(config, trainer_class, tokenizer, train_frame, dev_frame):
    if not config.hyperparameter_search or not config.hyperparameter_search.get("enabled"):
        return None
    try:
        import optuna
    except ImportError:
        return None
    torch, AutoModelForSequenceClassification, _, _, _, TrainingArguments = _require_transformers()
    train_dataset = to_hf_dataset(train_frame)
    dev_dataset = to_hf_dataset(dev_frame)
    train_dataset = _tokenize_dataset(tokenizer, train_dataset, config.max_length).rename_column("label_id", "labels")
    dev_dataset = _tokenize_dataset(tokenizer, dev_dataset, config.max_length).rename_column("label_id", "labels")
    train_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])
    dev_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])

    search_space = config.hyperparameter_search

    def objective(trial):
        model = AutoModelForSequenceClassification.from_pretrained(config.model_name, num_labels=len(LABELS))
        args = _build_training_arguments(
            TrainingArguments,
            output_dir=str(RUNS_DIR / "tmp_optuna" / "trial_{0}".format(trial.number)),
            eval_strategy="epoch",
            save_strategy="no",
            logging_strategy="no",
            learning_rate=trial.suggest_categorical("learning_rate", search_space.get("learning_rate", [1e-5, 2e-5, 3e-5, 5e-5])),
            num_train_epochs=trial.suggest_categorical("num_train_epochs", search_space.get("num_train_epochs", [3, 5, 8])),
            per_device_train_batch_size=trial.suggest_categorical("train_batch_size", search_space.get("train_batch_size", [16, 32])),
            per_device_eval_batch_size=config.eval_batch_size,
            warmup_ratio=trial.suggest_categorical("warmup_ratio", search_space.get("warmup_ratio", [0.0, 0.1])),
            report_to=[],
            fp16=bool(config.fp16),
            seed=config.seed,
        )
        trainer = trainer_class(
            model=model,
            args=args,
            train_dataset=train_dataset,
            eval_dataset=dev_dataset,
            tokenizer=tokenizer,
            compute_metrics=_compute_metrics,
            class_weights=torch.tensor(compute_class_weights(train_frame), dtype=torch.float),
            focal_loss_gamma=config.focal_loss_gamma,
        )
        trainer.train()
        metrics = trainer.evaluate()
        return metrics.get("eval_macro_f1", 0.0)

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=int(search_space.get("n_trials", 8)))
    return study.best_params


def main():
    parser = argparse.ArgumentParser(description="Fine-tune a phase 2 model from YAML config.")
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument(
        "--lang",
        choices=["igbo", "yoruba", "joint_igbo_yoruba"],
        help="Optional override for the config's language field.",
    )
    args = parser.parse_args()
    train_from_config(config_path=args.config, language_override=args.lang)


if __name__ == "__main__":
    main()
