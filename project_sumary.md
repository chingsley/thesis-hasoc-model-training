# Project Summary: HateGuard — Hate Speech Detection for Nigerian Languages

This is **Kingsley Eneja's MCS thesis project** at Dalhousie: _"Hate Speech as a Cyber-Threat in Nigerian Languages."_ It's a complete end-to-end research + engineering system for detecting hate speech in **Igbo** and **Yoruba**, packaged as a deployable content-moderation platform called **HateGuard**.

## The Problem Being Solved

Nigeria's multi-ethnic online landscape is rife with hate speech that drives real-world ethnic and electoral violence. Most content-moderation tooling only works in English, leaving native Nigerian languages — and other low-resource African languages — unprotected.

## Core Approach

1. **Collect & label** native-language corpora (Igbo + Yoruba Facebook/Twitter-style text; labels: `Normal` / `Abuse` / `Hate`)
2. **Fine-tune multilingual transformers** — XLM-RoBERTa, AfroXLMR, AfriBERTa
3. **Integrate explainable AI** (LIME, SHAP, attention rollout, integrated gradients) so users see _why_ a decision was made

Reported test macro-F1: Igbo ≈ **0.86**, Yoruba ≈ **0.67**, joint model ≈ **0.73** (per-language specialists outperform the joint model).

## The Four Build Components

| Component                                 | Stack                                     | Purpose                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`model_training/`** (`kc_train` bundle) | Python, PyTorch, HuggingFace Transformers | Self-contained modeling package: data loading, training, baselines, evaluation, robustness, explainability. Runs via notebooks or CLI sweeps (`run_all.sh`)         |
| **`backend_api_server/`**                 | FastAPI, SQLAlchemy/SQLite                | Inference API (`/predict`, `/predict/batch`, `/explain`, `/metrics`) with per-language model routing, API keys + session-token auth, and per-user logging/analytics |
| **`frontend_dashboard/`**                 | React + TypeScript + Vite                 | Analytics dashboard with 7 modules: Overview, Triage Queue, Explainability, Analysis, Testing Tools, Performance, Reports                                           |
| **`hf_spaces/`**                          | Gradio                                    | Lightweight model tester UI (paste text → classify)                                                                                                                 |

Also included: `model_training/publish_v2.sh` and `modeling/scripts/publish_to_hf` for shipping checkpoints + metrics to Hugging Face Hub.

## Key Technical Highlights

- **Per-language routing (v0.2):** dashboard language selector picks the matching model; a joint model serves as fallback.
- **Two-view toxic-term analysis:** frequency-based word clouds vs. leave-one-out model attribution (thesis-grade method doc).
- **Three dataset sources:** an env switch (`MODELING_DATASET_SOURCE=original|new|merged`) lets you train/eval on the original thesis splits, only new labelled data, or a merged corpus — while keeping the **old dev/test benchmark unchanged** for comparability.
- **Second-wave data (v2):** ~7k Igbo + 15k Yoruba rows merged in, with label normalization (`Abusive`→`Abuse`, drop `Invalid`), dedup, and stratified splitting.
- **Explainability performance work:** content-addressed caching, concurrent XAI methods, tuned budgets, incremental frontend rendering — with measured speed-ups documented for the thesis.

## Deployment / Infrastructure

- **Lab server:** `persuasive.research.cs.dal.ca` (JupyterHub + SSH), project at `/home/enejak/thesis-hasoc-model-training`
- **Models:** hosted on Hugging Face Hub (private repos supported), loaded via `HF_MODEL_ID_*`
- **State:** users, API keys, sessions, prediction logs, alerts, triage state in local SQLite

## Documentation Philosophy

`project_documentation/` is deliberately split into:

- **`feature_description/`** — operational, keep-current end-to-end docs of each dashboard module
- **`thesis/`** — design rationale, measurements, limitations, trade-offs (thesis-writing material)

---

**In one line:** HateGuard is a research-grade, deployable hate-speech detection and moderation platform for Igbo and Yoruba — combining fine-tuned multilingual transformers, explainable AI, a FastAPI inference backend, a React analytics dashboard, and a Gradio tester — built to make Nigerian digital spaces safer and serve as a blueprint for other low-resource African languages.
