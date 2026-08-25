#!/usr/bin/env python3
"""Push hf_spaces/hate-speech-tester files to a Hugging Face Space."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy hate-speech-tester Space to Hugging Face.")
    parser.add_argument(
        "--repo-id",
        default="chingsley/hate-speech-tester",
        help="Space repo id, e.g. chingsley/hate-speech-tester",
    )
    parser.add_argument("--private", action="store_true", help="Create private Space if missing.")
    parser.add_argument(
        "--skip-create",
        action="store_true",
        help="Upload only (Space must already exist on huggingface.co).",
    )
    args = parser.parse_args()

    token = os.getenv("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN first: export HF_TOKEN=hf_...")

    folder = Path(__file__).resolve().parent / "hate-speech-tester"
    if not (folder / "app.py").is_file():
        raise SystemExit(f"Missing {folder / 'app.py'}")

    api = HfApi(token=token)
    if not args.skip_create:
        try:
            api.create_repo(
                repo_id=args.repo_id,
                repo_type="space",
                space_sdk="gradio",
                private=args.private,
                exist_ok=True,
            )
        except Exception as exc:
            if "402" in str(exc) or "Payment Required" in str(exc):
                raise SystemExit(
                    "Hugging Face requires PRO to create new Gradio Spaces.\n"
                    "Options:\n"
                    "  1. Subscribe: https://huggingface.co/pro\n"
                    "  2. Create the Space manually on huggingface.co/new-space, then re-run with --skip-create\n"
                    "  3. Run locally (free): cd hf_spaces/hate-speech-tester && python app.py\n"
                    "     Then SSH tunnel from laptop: ssh -L 7860:localhost:7860 user@server"
                ) from exc
            raise
    api.upload_folder(
        folder_path=str(folder),
        repo_id=args.repo_id,
        repo_type="space",
        commit_message="Deploy hate speech tester Space",
    )
    print(f"Deployed -> https://huggingface.co/spaces/{args.repo_id}")
    print("Add HF_TOKEN under Space Settings → Repository secrets if models are private.")


if __name__ == "__main__":
    main()
