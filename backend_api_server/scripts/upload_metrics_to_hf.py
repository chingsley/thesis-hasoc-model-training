#!/usr/bin/env python3
"""Upload (or refresh) a small artifact in an existing Hugging Face model repo.

Use this after retraining/evaluating when the weights are already on the Hub,
or to backfill artifacts for repos uploaded before upload_to_hf.py handled them.

Examples:
  # refresh metrics only
  python upload_metrics_to_hf.py --metrics runs/.../20260515_143652 --repo-id you/igbo-hate

  # backfill the predictions CSV the /posts endpoint needs
  python upload_metrics_to_hf.py --metrics runs/.../20260515_143652 \
      --file predictions_test.csv --repo-id you/igbo-hate
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi


def resolve_artifact(path: Path, filename: str) -> Path:
  path = path.expanduser().resolve()
  if path.is_file():
    return path
  for folder in (path, *sorted([c for c in path.iterdir() if c.is_dir()], key=lambda p: p.name, reverse=True)):
    candidate = folder / filename
    if candidate.is_file():
      return candidate
  raise FileNotFoundError(f"No {filename} found under {path}")


def main() -> None:
  parser = argparse.ArgumentParser(description="Upload a small artifact to a Hugging Face model repo.")
  parser.add_argument(
    "--metrics",
    required=True,
    help="Path to the artifact, its run dir, or a parent folder (uses newest timestamp subdir).",
  )
  parser.add_argument("--repo-id", required=True, help="Target repo, e.g. yourusername/afro-xlmr-igbo-hate")
  parser.add_argument(
    "--file",
    default="test_metrics.json",
    help="Artifact filename to look for/upload (default: test_metrics.json).",
  )
  args = parser.parse_args()

  token = os.getenv("HF_TOKEN")
  if not token:
    raise SystemExit("Set HF_TOKEN in the environment before uploading.")

  artifact = resolve_artifact(Path(args.metrics), args.file)
  HfApi(token=token).upload_file(
    path_or_fileobj=str(artifact),
    path_in_repo=args.file,
    repo_id=args.repo_id,
    repo_type="model",
    commit_message=f"Update {args.file}",
  )
  print(f"Uploaded {artifact} -> https://huggingface.co/{args.repo_id}/blob/main/{args.file}")


if __name__ == "__main__":
  main()
