#!/usr/bin/env python3
"""Upload (or refresh) test_metrics.json in an existing Hugging Face model repo.

Use this after retraining/evaluating when the weights are already on the Hub,
or to backfill metrics for repos uploaded before upload_to_hf.py handled them.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi


def resolve_metrics(path: Path) -> Path:
  path = path.expanduser().resolve()
  if path.is_file():
    return path
  for folder in (path, *sorted([c for c in path.iterdir() if c.is_dir()], key=lambda p: p.name, reverse=True)):
    candidate = folder / "test_metrics.json"
    if candidate.is_file():
      return candidate
  raise FileNotFoundError(f"No test_metrics.json found under {path}")


def main() -> None:
  parser = argparse.ArgumentParser(description="Upload test_metrics.json to a Hugging Face model repo.")
  parser.add_argument(
    "--metrics",
    required=True,
    help="Path to test_metrics.json, its run dir, or a parent folder (uses newest timestamp subdir).",
  )
  parser.add_argument("--repo-id", required=True, help="Target repo, e.g. yourusername/afro-xlmr-igbo-hate")
  args = parser.parse_args()

  token = os.getenv("HF_TOKEN")
  if not token:
    raise SystemExit("Set HF_TOKEN in the environment before uploading.")

  metrics_file = resolve_metrics(Path(args.metrics))
  HfApi(token=token).upload_file(
    path_or_fileobj=str(metrics_file),
    path_in_repo="test_metrics.json",
    repo_id=args.repo_id,
    repo_type="model",
    commit_message="Update test-set metrics",
  )
  print(f"Uploaded {metrics_file} -> https://huggingface.co/{args.repo_id}/blob/main/test_metrics.json")


if __name__ == "__main__":
  main()
