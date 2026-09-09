"""
Build derived dataset roots from the original and newly labelled datasets.

Reads (never modified):
  - dataset/{language}_{train,dev,test}.csv       (original thesis data)
  - new_dataset/{language}_dataset_labeled.csv    (new labels, raw; multi-line fields)

Writes:
  - new_dataset_split/{language}_{train,dev,test}.csv
        New data only: cleaned, deduplicated, stratified 80/10/10 (seed 42).
        Same schema as the original files: id,tweet,label,length.
  - merged_dataset/{language}_{train,dev,test}.csv
        train = original train + new train (adds a `source` column);
        dev/test = exact copies of the original dev/test rows, so metrics
        stay comparable with every previous run.
  - merged_dataset/BUILD_REPORT.md

Cleaning rules for the new data:
  - rename `text` -> `tweet`; collapse all whitespace runs (incl. newlines) to single spaces
  - strip labels; map `Abusive` -> `Abuse`; drop anything not in {Normal, Abuse, Hate}
    (this drops the yoruba `Invalid` rows, which have no counterpart in the 3-class scheme)
  - drop empty tweets
  - deduplicate on normalized text; drop duplicate groups whose labels disagree
  - prefix ids as `new_{language}_{original_id}` for traceability

Run from the kc_train bundle root (the directory that contains modeling/ and dataset/):
    python -m modeling.scripts.build_merged_dataset
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import pandas as pd
from sklearn.model_selection import train_test_split

from modeling.common import DATASET_DIR, PROJECT_ROOT, ensure_dir
from modeling.data import LABELS, SUPPORTED_LANGUAGES, load_language_bundle

NEW_DATASET_DIR = PROJECT_ROOT / "new_dataset"
NEW_SPLIT_DIR = PROJECT_ROOT / "new_dataset_split"
MERGED_DATASET_DIR = PROJECT_ROOT / "merged_dataset"

DEV_FRACTION = 0.10
TEST_FRACTION = 0.10
RANDOM_SEED = 42

LABEL_MAP = {"Normal": "Normal", "Abusive": "Abuse", "Abuse": "Abuse", "Hate": "Hate"}
OUTPUT_COLUMNS = ["id", "tweet", "label", "length"]


def normalize_text(value: str) -> str:
    return " ".join(str(value).split())


def label_counts_line(frame: pd.DataFrame) -> str:
    counts = frame["label"].value_counts()
    total = len(frame)
    parts = []
    for label in LABELS:
        count = int(counts.get(label, 0))
        pct = (100.0 * count / total) if total else 0.0
        parts.append("{0} {1} ({2:.1f}%)".format(label, count, pct))
    return ", ".join(parts)


def load_and_clean_new(language: str, report: List[str]) -> pd.DataFrame:
    path = NEW_DATASET_DIR / "{0}_dataset_labeled.csv".format(language)
    frame = pd.read_csv(path, dtype={"id": str})
    report.append("- raw rows: {0} (`{1}`)".format(len(frame), path.name))

    frame = frame.rename(columns={"text": "tweet"})
    frame["tweet"] = frame["tweet"].fillna("").astype(str).map(normalize_text)
    frame["label"] = frame["label"].fillna("").astype(str).str.strip().map(lambda v: LABEL_MAP.get(v, v))

    bad_label_mask = ~frame["label"].isin(LABELS)
    dropped_labels = frame.loc[bad_label_mask, "label"].value_counts().to_dict()
    frame = frame.loc[~bad_label_mask]
    if dropped_labels:
        report.append("- dropped rows with unsupported labels: {0}".format(dropped_labels))

    empty_mask = frame["tweet"].str.len() == 0
    if int(empty_mask.sum()):
        report.append("- dropped empty tweets: {0}".format(int(empty_mask.sum())))
    frame = frame.loc[~empty_mask]

    label_nunique = frame.groupby("tweet")["label"].nunique()
    conflict_texts = set(label_nunique[label_nunique > 1].index)
    conflict_mask = frame["tweet"].isin(conflict_texts)
    if int(conflict_mask.sum()):
        report.append(
            "- dropped duplicate groups with conflicting labels: {0} rows across {1} texts".format(
                int(conflict_mask.sum()), len(conflict_texts)
            )
        )
    frame = frame.loc[~conflict_mask]

    before_dedup = len(frame)
    frame = frame.drop_duplicates(subset=["tweet"], keep="first")
    if before_dedup != len(frame):
        report.append("- dropped exact duplicate tweets: {0}".format(before_dedup - len(frame)))

    frame = frame.copy()
    frame["id"] = ["new_{0}_{1}".format(language, raw_id) for raw_id in frame["id"]]
    frame["length"] = frame["tweet"].str.len()
    report.append("- clean rows kept: {0}".format(len(frame)))
    report.append("- label distribution: {0}".format(label_counts_line(frame)))
    return frame.reset_index(drop=True)


def split_new(frame: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    train, remainder = train_test_split(
        frame,
        test_size=DEV_FRACTION + TEST_FRACTION,
        random_state=RANDOM_SEED,
        stratify=frame["label"],
    )
    dev, test = train_test_split(
        remainder,
        test_size=TEST_FRACTION / (DEV_FRACTION + TEST_FRACTION),
        random_state=RANDOM_SEED,
        stratify=remainder["label"],
    )
    return {
        "train": train.sort_index().reset_index(drop=True),
        "dev": dev.sort_index().reset_index(drop=True),
        "test": test.sort_index().reset_index(drop=True),
    }


def write_split(directory: Path, language: str, split: str, frame: pd.DataFrame, extra_columns: List[str] = None) -> Path:
    ensure_dir(directory)
    columns = OUTPUT_COLUMNS + list(extra_columns or [])
    path = directory / "{0}_{1}.csv".format(language, split)
    frame[columns].to_csv(path, index=False)
    return path


def verify(language: str, report: List[str]) -> None:
    """Load the written roots through the real training loader and check invariants."""
    new_bundle = load_language_bundle(language, dataset_dir=NEW_SPLIT_DIR)
    merged_bundle = load_language_bundle(language, dataset_dir=MERGED_DATASET_DIR)
    original_bundle = load_language_bundle(language, dataset_dir=DATASET_DIR)

    for split in ("dev", "test"):
        merged_split = getattr(merged_bundle, split)[["id", "tweet", "label"]].reset_index(drop=True)
        original_split = getattr(original_bundle, split)[["id", "tweet", "label"]].reset_index(drop=True)
        if not merged_split.equals(original_split):
            raise AssertionError("merged {0} {1} differs from the original benchmark split".format(language, split))

    benchmark_texts = set(original_bundle.dev["tweet"]).union(set(original_bundle.test["tweet"]))
    leaked = set(new_bundle.train["tweet"]).intersection(benchmark_texts)
    if leaked:
        raise AssertionError("{0}: {1} new train rows leak into the original benchmark".format(language, len(leaked)))

    expected_merged_train = len(original_bundle.train) + len(new_bundle.train)
    if len(merged_bundle.train) != expected_merged_train:
        raise AssertionError(
            "{0}: merged train has {1} rows, expected {2}".format(language, len(merged_bundle.train), expected_merged_train)
        )
    report.append(
        "- verification OK: loaders accept both roots; dev/test identical to original; "
        "zero leakage of new train into the benchmark; merged train = {0} + {1} rows".format(
            len(original_bundle.train), len(new_bundle.train)
        )
    )


def main() -> None:
    report = ["# Merged dataset build report", "", "Seed {0}, dev {1:.0%}, test {2:.0%} (of new data).".format(RANDOM_SEED, DEV_FRACTION, TEST_FRACTION), ""]
    for language in SUPPORTED_LANGUAGES:
        report.append("## {0}".format(language))
        report.append("")
        report.append("### New data cleaning")
        new_frame = load_and_clean_new(language, report)
        report.append("")
        report.append("### Splits written")
        new_splits = split_new(new_frame)
        for split, split_frame in new_splits.items():
            path = write_split(NEW_SPLIT_DIR, language, split, split_frame)
            report.append("- `{0}`: {1} rows — {2}".format(path.name, len(split_frame), label_counts_line(split_frame)))

        original_bundle = load_language_bundle(language, dataset_dir=DATASET_DIR)
        merged_train = pd.concat(
            [
                original_bundle.train.assign(source="original"),
                new_splits["train"].assign(source="new"),
            ],
            ignore_index=True,
        )
        merged_dev = original_bundle.dev.assign(source="original")
        merged_test = original_bundle.test.assign(source="original")
        write_split(MERGED_DATASET_DIR, language, "train", merged_train, extra_columns=["source"])
        write_split(MERGED_DATASET_DIR, language, "dev", merged_dev, extra_columns=["source"])
        write_split(MERGED_DATASET_DIR, language, "test", merged_test, extra_columns=["source"])
        report.append("")
        report.append("### Merged root")
        report.append("- merged train: {0} rows — {1}".format(len(merged_train), label_counts_line(merged_train)))
        report.append("- merged dev/test: {0}/{1} rows (exact copies of the original benchmark)".format(len(merged_dev), len(merged_test)))
        report.append("")
        report.append("### Verification")
        verify(language, report)
        report.append("")

    ensure_dir(MERGED_DATASET_DIR)
    report_path = MERGED_DATASET_DIR / "BUILD_REPORT.md"
    report_path.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print("Report written to {0}".format(report_path))


if __name__ == "__main__":
    main()
