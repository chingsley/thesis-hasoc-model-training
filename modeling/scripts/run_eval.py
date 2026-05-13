from __future__ import annotations

import argparse
from pathlib import Path

from modeling.common import RUNS_DIR
from modeling.data import load_language_bundle
from modeling.evaluate import save_evaluation_bundle
from modeling.reports import rebuild_phase2_report
from modeling.trainer import predict_texts


def main():
    parser = argparse.ArgumentParser(description="Evaluate a saved checkpoint or rebuild the aggregate report.")
    parser.add_argument("--run", type=Path)
    parser.add_argument("--lang", choices=["igbo", "yoruba"])
    parser.add_argument("--split", default="test", choices=["dev", "test"])
    parser.add_argument("--aggregate-only", action="store_true")
    args = parser.parse_args()

    if args.aggregate_only:
        rebuild_phase2_report(RUNS_DIR)
        return

    if not args.run or not args.lang:
        parser.error("--run and --lang are required unless --aggregate-only is set")

    bundle = load_language_bundle(args.lang)
    frame = getattr(bundle, args.split)
    outputs = predict_texts(str(args.run), frame["tweet"].tolist())
    save_evaluation_bundle(args.run, frame, outputs["predictions"], outputs["probabilities"], split_name=args.split)
    rebuild_phase2_report(RUNS_DIR)


if __name__ == "__main__":
    main()
