#!/usr/bin/env python3
"""Upload README model cards to enable the HF Inference widget.

Target repos come from the same `.env` the backend reads, so `HF_MODEL_SET`
decides which family gets the cards:

  python scripts/upload_model_cards.py                  # repos for the active set
  HF_MODEL_SET=merged python scripts/upload_model_cards.py
  python scripts/upload_model_cards.py --which igbo --repo-id you/some-repo
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.model_service import effective_model_set, resolve_hf_model_id_for_key  # noqa: E402

CARD_PATHS = {
    "igbo": "hf_model_cards/igbo/README.md",
    "yoruba": "hf_model_cards/yoruba/README.md",
    "joint": "hf_model_cards/joint/README.md",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload model cards to Hugging Face Hub.")
    parser.add_argument(
        "--which",
        choices=[*CARD_PATHS, "all"],
        default="all",
    )
    parser.add_argument(
        "--repo-id",
        default=None,
        help="Override the target repo. Requires a single --which.",
    )
    args = parser.parse_args()

    load_dotenv()

    if args.repo_id and args.which == "all":
        print("error: --repo-id requires a single --which (igbo, yoruba or joint)", file=sys.stderr)
        return 2

    token = os.getenv("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN in the environment.")

    names = list(CARD_PATHS) if args.which == "all" else [args.which]
    targets = {}
    for name in names:
        repo_id = args.repo_id or resolve_hf_model_id_for_key(name.upper())
        if not repo_id:
            print(
                "error: no repo configured for {0}. Set HF_MODEL_ID_{1} in .env "
                "(or pass --repo-id).".format(name, name.upper()),
                file=sys.stderr,
            )
            return 2
        targets[name] = repo_id

    root = Path(__file__).resolve().parents[1]
    api = HfApi(token=token)
    print("model set: {0}".format(effective_model_set() or "<unset>"))

    for name, repo_id in targets.items():
        readme = root / CARD_PATHS[name]
        api.upload_file(
            path_or_fileobj=str(readme),
            path_in_repo="README.md",
            repo_id=repo_id,
            repo_type="model",
            commit_message=f"Add model card for {name} inference widget",
        )
        print(f"Uploaded {readme.name} -> https://huggingface.co/{repo_id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
