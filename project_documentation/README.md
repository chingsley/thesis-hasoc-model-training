# Project documentation

Guides and references for the thesis HateGuard stack.

**Doc categories** (keep them distinct):
- **[feature_description/](./feature_description/)** — what each dashboard feature does, end-to-end (request → backend → DB → response → render). Kept in sync with code behavior.
- **[thesis/](./thesis/)** — thesis-writing material: design rationale, methods, measurements, limitations (why the system is built this way, how well it works).
- Everything else below — operational how-to guides (login, run, deploy).

Quick reference for returning to this project after a break. Each guide file covers one independent task.

## Server at a glance

| Item | Value |
|------|--------|
| Hostname (SSH / browser) | `persuasive.research.cs.dal.ca` |
| Internal hostname (once logged in) | `persuasive-computing-lab` |
| Username | `enejak` |
| JupyterHub URL | `https://persuasive.research.cs.dal.ca:8000` |
| Project folder on server | `/home/enejak/thesis-hasoc-model-training` |
| Trained checkpoints | `runs/` inside that folder |
| Local monorepo (Mac) | `kc_train/` (this repo) |
| Server repo layout | Matches `kc_train/model_training/` |

## Guides

| Task | File |
|------|------|
| Log in via browser (JupyterHub, notebooks) | [login-jupyterhub-browser.md](./login-jupyterhub-browser.md) |
| Log in via SSH (terminal only) | [login-ssh-terminal.md](./login-ssh-terminal.md) |
| Open server code in Cursor / VS Code explorer | [open-project-remote-ssh.md](./open-project-remote-ssh.md) |
| Upload a checkpoint to Hugging Face (recommended for deployment) | [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) |
| Copy checkpoints with `rsync` / `scp` (no Hugging Face) | [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md) |
| Run backend + frontend dashboard | [run-dashboard.md](./run-dashboard.md) |
| Backend API reference (endpoints, curl, responses) | [backend-api-reference.md](./backend-api-reference.md) |
| Dashboard feature flows (sidebar modules) | [feature_description/](./feature_description/) |
| Thesis-writing docs (design rationale, measurements) | [thesis/](./thesis/) |
| Test models in a Gradio UI (paste text → classify) | [run-gradio-model-tester.md](./run-gradio-model-tester.md) |

## Typical workflows

**Edit training code on the server (explorer, not terminal):**

1. [login-ssh-terminal.md](./login-ssh-terminal.md) — optional, if you need terminal first
2. [open-project-remote-ssh.md](./open-project-remote-ssh.md) — Remote SSH + open folder

**Run the dashboard with live model inference:**

1. [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) — models on HF (or use local `MODEL_PATH_*` in `.env`)
2. [run-dashboard.md](./run-dashboard.md) — start backend (8080) + frontend (5173), open in browser

**Test a model in a simple browser UI (no backend/dashboard):**

1. [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) — models must be on HF first
2. [run-gradio-model-tester.md](./run-gradio-model-tester.md) — Gradio on server + port 7860

## Do not do this

- **Do not** run `source ~/.ssh/config` — that file is for the `ssh` command, not your shell.
- **Do not** use `persuasive-computing-lab.cs.dal.ca` as the SSH hostname — it does not resolve from outside; use `persuasive.research.cs.dal.ca`.
- **Do not** run `ssh -L 7860:localhost:7860 enejak@persuasive-computing-lab` from a server terminal — run port forward from your laptop, or use Cursor **Ports** when using Remote SSH.
- **Do not** expect a paste-and-test box on the Hugging Face **model** repo page without PRO Inference Providers — use [run-gradio-model-tester.md](./run-gradio-model-tester.md) instead.
