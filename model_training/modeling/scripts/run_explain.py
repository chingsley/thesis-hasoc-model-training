from __future__ import annotations

import argparse
from pathlib import Path

from modeling.common import RUNS_DIR
from modeling.data import load_language_bundle
from modeling.explain import ALL_METHODS, explain_rows, latest_run_dir, select_explanation_rows
from modeling.reports import rebuild_explainability_report


def main():
    parser = argparse.ArgumentParser(description="Generate explanations for sampled test rows.")
    parser.add_argument(
        "--run",
        type=Path,
        help="Path to a saved checkpoint directory. Omit to use --run-name + --lang with --latest.",
    )
    parser.add_argument(
        "--run-name",
        help="Config run_name (e.g. afro_xlmr_base) used with --latest to resolve the newest run.",
    )
    parser.add_argument("--lang", required=True, choices=["igbo", "yoruba"])
    parser.add_argument("--num-rows", type=int, default=12)
    parser.add_argument(
        "--methods",
        nargs="+",
        choices=list(ALL_METHODS),
        default=list(ALL_METHODS),
        help="Subset of explanation methods to run.",
    )
    parser.add_argument(
        "--balanced",
        dest="balanced",
        action="store_true",
        default=True,
        help="Sample an even number of rows per class (default).",
    )
    parser.add_argument(
        "--no-balanced",
        dest="balanced",
        action="store_false",
        help="Use the first N test rows instead of class-balanced sampling.",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-html", dest="write_html", action="store_false", default=True)
    parser.add_argument(
        "--latest",
        action="store_true",
        help="Resolve the newest timestamped run under runs/<run-name>/<lang>/.",
    )
    parser.add_argument(
        "--no-report",
        dest="rebuild_report",
        action="store_false",
        default=True,
        help="Skip rebuilding the aggregate explainability report afterwards.",
    )
    args = parser.parse_args()

    run_dir = args.run
    if run_dir is None:
        if not (args.latest and args.run_name):
            parser.error("provide --run, or --latest together with --run-name")
        run_dir = latest_run_dir(args.run_name, args.lang)
        if run_dir is None:
            parser.error(
                "no run found under runs/{0}/{1}/".format(args.run_name, args.lang)
            )

    bundle = load_language_bundle(args.lang)
    rows = select_explanation_rows(
        bundle.test, num_rows=args.num_rows, balanced=args.balanced, seed=args.seed
    )
    outputs = explain_rows(
        run_dir,
        rows,
        methods=args.methods,
        write_html=args.write_html,
    )
    print("Wrote {0} explanation file(s) to {1}".format(len(outputs), Path(run_dir) / "explanations"))

    if args.rebuild_report:
        report_path = rebuild_explainability_report(RUNS_DIR)
        print("Explainability report: {0}".format(report_path))


if __name__ == "__main__":
    main()
