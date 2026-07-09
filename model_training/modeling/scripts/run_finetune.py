from __future__ import annotations

import argparse
from pathlib import Path

from modeling.trainer import run_cross_lingual_train_eval, train_from_config
from modeling.runtime_mode import resolve_config_path


def main():
    parser = argparse.ArgumentParser(description="Run config-driven fine-tuning for Phase 2.")
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument(
        "--lang",
        choices=["igbo", "yoruba", "joint_igbo_yoruba"],
        help="Override the config's language field for single-language fine-tuning.",
    )
    parser.add_argument("--train-lang", choices=["igbo", "yoruba"])
    parser.add_argument("--test-lang", choices=["igbo", "yoruba"])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--smoke",
        action="store_true",
        help="Use <stem>_smoke.yaml next to the given config when present (ignores SMOKE_TEST=False).",
    )
    mode.add_argument(
        "--full",
        action="store_true",
        help="Use the given config path as-is (ignores SMOKE_TEST=True and MODELING_SMOKE).",
    )
    args = parser.parse_args()
    if args.smoke:
        config_path = resolve_config_path(args.config, smoke=True)
    elif args.full:
        config_path = resolve_config_path(args.config, smoke=False)
    else:
        config_path = resolve_config_path(args.config, smoke=None)
    if args.train_lang and args.test_lang:
        if args.lang:
            parser.error("--lang is not compatible with --train-lang/--test-lang")
        run_cross_lingual_train_eval(config_path, args.train_lang, args.test_lang)
        return
    if args.train_lang or args.test_lang:
        parser.error("--train-lang and --test-lang must be provided together")
    train_from_config(config_path=config_path, language_override=args.lang)


if __name__ == "__main__":
    main()
