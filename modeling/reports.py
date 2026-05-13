from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from .common import REPORTS_DIR, ensure_dir, read_json


def _format_metric(value: Any) -> str:
    if value is None:
        return "NA"
    if isinstance(value, float):
        return "{0:.4f}".format(value)
    return str(value)


def append_phase2_run(
    task_type: str,
    run_name: str,
    language: str,
    model_name: str,
    output_dir: Path,
    metrics: Dict[str, Any],
) -> None:
    report_path = ensure_dir(REPORTS_DIR) / "modeling_results.md"
    if not report_path.exists():
        report_path.write_text(_default_report_header(), encoding="utf-8")
    entry = "\n| {task} | {run} | {lang} | {model} | {macro_f1} | {weighted_f1} | {accuracy} | {roc_auc} | {path} |\n".format(
        task=task_type,
        run=run_name,
        lang=language,
        model=model_name,
        macro_f1=_format_metric(metrics.get("macro_f1")),
        weighted_f1=_format_metric(metrics.get("weighted_f1")),
        accuracy=_format_metric(metrics.get("accuracy")),
        roc_auc=_format_metric(metrics.get("roc_auc_ovr")),
        path=str(output_dir),
    )
    with report_path.open("a", encoding="utf-8") as handle:
        handle.write(entry)


def _default_report_header() -> str:
    return """# Modeling results

This report is append-only for quick experiment logging. Re-run `python -m modeling.scripts.run_eval --aggregate-only` to rebuild a consolidated view.

## Main Results

| Task | Run | Language | Model | Macro-F1 | Weighted-F1 | Accuracy | ROC-AUC OvR | Artefacts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Cross-Lingual Transfer

| Train Language | Test Language | Model | Macro-F1 | Weighted-F1 | Accuracy | Artefacts |
| --- | --- | --- | --- | --- | --- | --- |

## Robustness

| Run | Language | Scenario | Macro-F1 | Delta vs Clean | Artefacts |
| --- | --- | --- | --- | --- | --- |
"""


def rebuild_phase2_report(runs_dir: Path, report_path: Optional[Path] = None) -> Path:
    report_path = report_path or (ensure_dir(REPORTS_DIR) / "modeling_results.md")
    lines = [
        "# Modeling results\n\n",
        "This report is rebuilt from the run artefacts under `runs/`.\n\n",
        "## Main Results\n\n",
        "| Task | Run | Language | Model | Macro-F1 | Weighted-F1 | Accuracy | ROC-AUC OvR | Artefacts |\n",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n",
    ]
    main_rows = []
    transfer_rows = []
    robustness_rows = []
    for metrics_file in sorted(runs_dir.rglob("metrics.json")):
        payload = read_json(metrics_file)
        parent = metrics_file.parent
        parts = parent.relative_to(runs_dir).parts
        if not parts or "test" not in payload or "macro_f1" not in payload["test"]:
            continue

        task_type = "fine_tune"
        model_name = parts[0]
        language = parts[1] if len(parts) > 1 else "unknown"
        run_name = parts[-1]

        if parts[0] == "baselines" and len(parts) >= 4:
            task_type = "baseline"
            language = parts[1]
            run_name = parts[3]
            model_name = parts[3]

        main_rows.append(
            "| {task} | {run} | {lang} | {model} | {macro_f1} | {weighted_f1} | {accuracy} | {roc_auc} | {path} |".format(
                task=task_type,
                run=run_name,
                lang=language,
                model=model_name,
                macro_f1=_format_metric(payload["test"].get("macro_f1")),
                weighted_f1=_format_metric(payload["test"].get("weighted_f1")),
                accuracy=_format_metric(payload["test"].get("accuracy")),
                roc_auc=_format_metric(payload["test"].get("roc_auc_ovr")),
                path=str(parent),
            )
        )
        for scenario, metrics in payload.get("robustness", {}).items():
            delta = metrics.get("macro_f1_delta_vs_clean")
            robustness_rows.append(
                "| {run} | {lang} | {scenario} | {macro_f1} | {delta} | {path} |".format(
                    run=run_name,
                    lang=language,
                    scenario=scenario,
                    macro_f1=_format_metric(metrics.get("macro_f1")),
                    delta=_format_metric(delta),
                    path=str(parent),
                )
            )

    for transfer_file in sorted(runs_dir.rglob("cross_lingual_*.json")):
        payload = read_json(transfer_file)
        parent = transfer_file.parent
        if payload.get("experiment_type") != "cross_lingual":
            continue
        transfer_rows.append(
            "| {train_lang} | {test_lang} | {model} | {macro_f1} | {weighted_f1} | {accuracy} | {path} |".format(
                train_lang=payload["train_language"],
                test_lang=payload["test_language"],
                model=payload["model_name"],
                macro_f1=_format_metric(payload["test_metrics"].get("macro_f1")),
                weighted_f1=_format_metric(payload["test_metrics"].get("weighted_f1")),
                accuracy=_format_metric(payload["test_metrics"].get("accuracy")),
                path=str(parent),
            )
        )
    lines.append("\n".join(main_rows) if main_rows else "")
    lines.append("\n\n## Cross-Lingual Transfer\n\n")
    lines.append("| Train Language | Test Language | Model | Macro-F1 | Weighted-F1 | Accuracy | Artefacts |\n")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |\n")
    lines.append("\n".join(transfer_rows) if transfer_rows else "")
    lines.append("\n\n## Robustness\n\n")
    lines.append("| Run | Language | Scenario | Macro-F1 | Delta vs Clean | Artefacts |\n")
    lines.append("| --- | --- | --- | --- | --- | --- |\n")
    lines.append("\n".join(robustness_rows) if robustness_rows else "")
    report_path.write_text("".join(lines), encoding="utf-8")
    return report_path
