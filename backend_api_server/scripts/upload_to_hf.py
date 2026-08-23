#!/usr/bin/env python3
"""Upload a local Trainer checkpoint to the Hugging Face Hub."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi


def resolve_checkpoint(path: Path) -> Path:
  path = path.expanduser().resolve()
  if (path / "config.json").exists():
    return path

  candidates = sorted(
    [child for child in path.iterdir() if child.is_dir()],
    key=lambda item: item.name,
    reverse=True,
  )
  for candidate in candidates:
    if (candidate / "config.json").exists():
      return candidate

  raise FileNotFoundError(f"No HuggingFace checkpoint found under {path}")


def main() -> None:
  parser = argparse.ArgumentParser(description="Upload a fine-tuned checkpoint to Hugging Face Hub.")
  parser.add_argument(
    "--checkpoint",
    required=True,
    help="Path to checkpoint dir or parent language folder (uses newest timestamp subdir).",
  )
  parser.add_argument(
    "--repo-id",
    required=True,
    help="Target repo, e.g. yourusername/afro-xlmr-joint-igbo-yoruba-hate",
  )
  parser.add_argument(
    "--private",
    action="store_true",
    help="Create / upload to a private model repo.",
  )
  args = parser.parse_args()

  token = os.getenv("HF_TOKEN")
  if not token:
    raise SystemExit("Set HF_TOKEN in the environment before uploading.")

  checkpoint = resolve_checkpoint(Path(args.checkpoint))
  api = HfApi(token=token)
  api.create_repo(repo_id=args.repo_id, repo_type="model", private=args.private, exist_ok=True)
  api.upload_folder(
    folder_path=str(checkpoint),
    repo_id=args.repo_id,
    repo_type="model",
    commit_message="Upload fine-tuned hate speech classifier checkpoint",
  )
  print(f"Uploaded {checkpoint} -> https://huggingface.co/{args.repo_id}")


if __name__ == "__main__":
  main()
