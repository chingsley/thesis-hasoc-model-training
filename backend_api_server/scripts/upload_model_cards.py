#!/usr/bin/env python3
"""Upload README model cards to enable the HF Inference widget."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi

CARDS = {
    "igbo": ("hf_model_cards/igbo/README.md", "chingsley/afro-xlmr-igbo-hate"),
    "yoruba": ("hf_model_cards/yoruba/README.md", "chingsley/afro-xlmr-yoruba-hate"),
    "joint": (
        "hf_model_cards/joint/README.md",
        "chingsley/afro-xlmr-joint-igbo-yoruba-hate",
    ),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload model cards to Hugging Face Hub.")
    parser.add_argument(
        "--which",
        choices=["igbo", "yoruba", "joint", "all"],
        default="all",
    )
    args = parser.parse_args()

    token = os.getenv("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN in the environment.")

    root = Path(__file__).resolve().parents[1]
    api = HfApi(token=token)
    targets = CARDS if args.which == "all" else {args.which: CARDS[args.which]}

    for name, (rel_path, repo_id) in targets.items():
        readme = root / rel_path
        api.upload_file(
            path_or_fileobj=str(readme),
            path_in_repo="README.md",
            repo_id=repo_id,
            repo_type="model",
            commit_message=f"Add model card for {name} inference widget",
        )
        print(f"Uploaded {readme.name} -> https://huggingface.co/{repo_id}")


if __name__ == "__main__":
    main()
