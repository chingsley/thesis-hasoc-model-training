from __future__ import annotations

import argparse

from modeling.baselines import run_all_baselines


def main():
    parser = argparse.ArgumentParser(description="Run baseline models for a single language.")
    parser.add_argument("--lang", required=True, choices=["igbo", "yoruba"])
    args = parser.parse_args()
    run_all_baselines(args.lang)


if __name__ == "__main__":
    main()
