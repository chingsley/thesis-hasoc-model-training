"""
Training runtime mode for local smoke tests vs full runs on strong compute.

Flip SMOKE_TEST in this file (or set environment variable MODELING_SMOKE=1)
before importing other modeling training entry points, if you rely on env.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

# Set True for fast local validation (1 epoch, small batches, no Optuna).
# Set False for full thesis-quality training on GPU / cluster.
SMOKE_TEST: bool = False


def smoke_from_env() -> bool:
    return os.environ.get("MODELING_SMOKE", "").strip().lower() in ("1", "true", "yes")


def effective_smoke() -> bool:
    return SMOKE_TEST or smoke_from_env()


def resolve_train_config_path(project_root: Path, stem: str, *, smoke: Optional[bool] = None) -> Path:
    """
    Resolve a training YAML path under modeling/configs/.

    stem: base name without extension, e.g. ``\"xlmr_base\"``.

    When smoke resolution is on and ``{stem}_smoke.yaml`` exists, returns that file;
    otherwise returns ``{stem}.yaml``. If ``smoke`` is None, uses ``effective_smoke()``.
    """
    directory = Path(project_root) / "modeling" / "configs"
    base = directory / "{0}.yaml".format(stem)
    smoke_file = directory / "{0}_smoke.yaml".format(stem)
    use_smoke = effective_smoke() if smoke is None else bool(smoke)
    if use_smoke and smoke_file.is_file():
        return smoke_file
    return base


def resolve_config_path(config_path: Path, *, smoke: Optional[bool] = None) -> Path:
    """
    If smoke resolution is on and a sibling ``<stem>_smoke.yaml`` exists, return it;
    else return ``config_path`` unchanged. If ``smoke`` is None, uses ``effective_smoke()``.
    """
    path = Path(config_path)
    use_smoke = effective_smoke() if smoke is None else bool(smoke)
    if not use_smoke:
        return path
    if path.stem.endswith("_smoke"):
        return path
    smoke_path = path.parent / "{0}_smoke{1}".format(path.stem, path.suffix)
    return smoke_path if smoke_path.is_file() else path
