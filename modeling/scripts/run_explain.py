from __future__ import annotations

import argparse
from pathlib import Path

from modeling.data import load_language_bundle
from modeling.explain import explain_rows


def main():
    parser = argparse.ArgumentParser(description="Generate explanations for sampled test rows.")
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--lang", required=True, choices=["igbo", "yoruba"])
    parser.add_argument("--num-rows", type=int, default=10)
    args = parser.parse_args()

    rows = load_language_bundle(args.lang).test.head(args.num_rows)
    explain_rows(args.run, rows)


if __name__ == "__main__":
    main()
