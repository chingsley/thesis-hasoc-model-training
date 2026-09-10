#!/usr/bin/env python3
"""Publish a fine-tuned checkpoint to the Hugging Face Hub.

This is the training-side publisher. It does not depend on the backend repo, so
a team member with only ``model_training`` can publish. The resulting Hub repo
matches what the backend API expects:

- checkpoint files (``config.json``, ``model.safetensors``, tokenizer, ...)
- ``test_metrics.json``    -> backend ``GET /metrics``
- ``predictions_test.csv`` -> backend ``GET /posts`` and analytics

Examples::

    export HF_TOKEN=hf_...

    # full publish: weights + artifacts
    python -m modeling.scripts.publish_to_hf \
      --checkpoint runs/afro_xlmr_base/igbo/20260909_072214 \
      --repo-id chingsley/afro-xlmr-igbo-hate-v2-merged --private

    # refresh only the small artifacts (~KB) when the Hub weights are current
    python -m modeling.scripts.publish_to_hf \
      --checkpoint runs/afro_xlmr_base/igbo/20260909_072214 \
      --repo-id chingsley/afro-xlmr-igbo-hate-v2-merged \
      --artifacts-only

Publishing metrics without the matching weights leaves the Hub repo
inconsistent, so use ``--artifacts-only`` only when the weights are unchanged.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable, List

from huggingface_hub import HfApi, get_token

# Filenames the backend API downloads from the model repo.
ARTIFACTS = {
    "test_metrics.json": "backend GET /metrics",
    "predictions_test.csv": "backend GET /posts and analytics",
}

# The Trainer writes one `checkpoint-<step>/` per epoch, each holding a full
# model copy plus optimizer/scheduler state (~3 GB each, tens of GB per run).
# That is resumable-training state, not inference weights, so it is excluded:
# uploading it would balloon the repo and the transfer time for no benefit.
IGNORE_PATTERNS = ["checkpoint-*", "checkpoint-*/*", "checkpoint-*/**"]


def _has_file(folder: Path, filename: str) -> bool:
    """True when the file exists and is readable; unreadable dirs are skipped."""
    try:
        return (folder / filename).is_file()
    except OSError:
        return False


def _newest_subdirs(path: Path) -> List[Path]:
    """Immediate subdirectories, newest timestamp name first."""
    try:
        children = [child for child in path.iterdir() if child.is_dir()]
    except OSError:
        return []
    return sorted(children, key=lambda item: item.name, reverse=True)


def resolve_checkpoint(path: Path) -> Path:
    """Return the checkpoint dir, or its newest timestamp subdir holding config.json."""
    path = path.expanduser().resolve()
    if _has_file(path, "config.json"):
        return path
    for candidate in _newest_subdirs(path):
        if _has_file(candidate, "config.json"):
            return candidate
    raise FileNotFoundError("No HuggingFace checkpoint found under {0}".format(path))


def resolve_artifact_dir(path: Path, filenames: Iterable[str]) -> Path:
    """Return a dir holding at least one artifact.

    Used by ``--artifacts-only``, where the weights already live on the Hub and
    the local path may be a run folder rather than a checkpoint.
    """
    path = path.expanduser().resolve()
    if path.is_file():
        return path.parent
    names = list(filenames)
    for folder in (path, *_newest_subdirs(path)):
        if any(_has_file(folder, name) for name in names):
            return folder
    raise FileNotFoundError("None of {0} found under {1}".format(names, path))


def _upload_preview(run_dir: Path) -> tuple[int, int]:
    """(file count, total bytes) that will actually be uploaded."""
    from huggingface_hub.utils import filter_repo_objects

    relative = [
        str(item.relative_to(run_dir))
        for item in run_dir.rglob("*")
        if item.is_file()
    ]
    kept = list(filter_repo_objects(relative, ignore_patterns=IGNORE_PATTERNS))
    return len(kept), sum((run_dir / name).stat().st_size for name in kept)


def find_artifact(run_dir: Path, filename: str) -> Path | None:
    """Locate an artifact next to the checkpoint or in its parent run dir."""
    for folder in (run_dir, run_dir.parent):
        if _has_file(folder, filename):
            return folder / filename
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a fine-tuned checkpoint to Hugging Face Hub.")
    parser.add_argument(
        "--checkpoint",
        required=True,
        help="Path to checkpoint dir or parent language folder (uses newest timestamp subdir).",
    )
    parser.add_argument(
        "--repo-id",
        required=True,
        help="Target repo, e.g. chingsley/afro-xlmr-igbo-hate-v2-merged",
    )
    parser.add_argument(
        "--private",
        action="store_true",
        help="Create / upload to a private model repo.",
    )
    parser.add_argument(
        "--artifacts-only",
        action="store_true",
        help="Skip the weights and refresh only the backend artifacts in an existing repo.",
    )
    parser.add_argument(
        "--artifact",
        action="append",
        choices=sorted(ARTIFACTS),
        help="Artifact to upload (repeatable). Defaults to all of them.",
    )
    args = parser.parse_args()

    # get_token() picks up an existing `hf auth login` (the token saved under
    # $HF_HOME), so an interactive user does not have to re-export a secret.
    token = os.getenv("HF_TOKEN") or get_token()
    if not token:
        raise SystemExit(
            "No Hugging Face credentials found. Either run `hf auth login` "
            "or export HF_TOKEN before uploading."
        )

    filenames = args.artifact or list(ARTIFACTS)
    api = HfApi(token=token)
    print("Authenticated as {0}".format(api.whoami()["name"]))

    if args.artifacts_only:
        # The repo must already exist; do not create one from a mistyped --repo-id.
        run_dir = resolve_artifact_dir(Path(args.checkpoint), filenames)
    else:
        run_dir = resolve_checkpoint(Path(args.checkpoint))
        files, total = _upload_preview(run_dir)
        print("Publishing {0} file(s), {1:.2f} GB from {2}".format(files, total / 1e9, run_dir))
        print("Skipping intermediate checkpoint-*/ training state.")
        api.create_repo(repo_id=args.repo_id, repo_type="model", private=args.private, exist_ok=True)
        api.upload_folder(
            folder_path=str(run_dir),
            repo_id=args.repo_id,
            repo_type="model",
            ignore_patterns=IGNORE_PATTERNS,
            commit_message="Upload fine-tuned hate speech classifier checkpoint",
        )
        print("Uploaded {0} -> https://huggingface.co/{1}".format(run_dir, args.repo_id))

    for filename in filenames:
        artifact = find_artifact(run_dir, filename)
        if artifact is None:
            print(
                "WARNING: no {0} found next to the checkpoint; {1} will 404 for this model.".format(
                    filename, ARTIFACTS[filename]
                )
            )
            continue
        api.upload_file(
            path_or_fileobj=str(artifact),
            path_in_repo=filename,
            repo_id=args.repo_id,
            repo_type="model",
            commit_message="Upload {0} for the backend API".format(filename),
        )
        print(
            "Uploaded {0} -> https://huggingface.co/{1}/blob/main/{2}".format(
                artifact, args.repo_id, filename
            )
        )


if __name__ == "__main__":
    main()
