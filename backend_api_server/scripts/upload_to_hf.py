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


ARTIFACTS = {
  "test_metrics.json": "the backend /metrics endpoint",
  "predictions_test.csv": "the backend /posts and analytics endpoints",
}


def find_artifact(checkpoint: Path, filename: str) -> Path | None:
  """Locate an artifact next to the checkpoint or in its parent run dir."""
  for folder in (checkpoint, checkpoint.parent):
    candidate = folder / filename
    if candidate.is_file():
      return candidate
  return None


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

  for filename, used_by in ARTIFACTS.items():
    artifact = find_artifact(checkpoint, filename)
    if artifact is None:
      print(f"WARNING: no {filename} found next to the checkpoint; {used_by} will 404 for this model.")
    else:
      api.upload_file(
        path_or_fileobj=str(artifact),
        path_in_repo=filename,
        repo_id=args.repo_id,
        repo_type="model",
        commit_message=f"Upload {filename} for the backend API",
      )
      print(f"Uploaded {artifact} -> https://huggingface.co/{args.repo_id}/blob/main/{filename}")


if __name__ == "__main__":
  main()
