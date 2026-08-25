# How-to guides (server & backend)

Quick reference for returning to this project after a break. Each file covers one independent task.

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
| Run the backend API and call the model | [run-backend-inference-api.md](./run-backend-inference-api.md) |

## Typical workflows

**Edit training code on the server (explorer, not terminal):**

1. [login-ssh-terminal.md](./login-ssh-terminal.md) — optional, if you need terminal first
2. [open-project-remote-ssh.md](./open-project-remote-ssh.md) — Remote SSH + open folder

**Use a trained model in the local backend + frontend:**

1. Pick one model source:
   - [upload-model-to-huggingface.md](./upload-model-to-huggingface.md) — best for versioning and sharing
   - [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md) — best for quick local-only dev
2. [run-backend-inference-api.md](./run-backend-inference-api.md) — start API, test with `curl`

## Do not do this

- **Do not** run `source ~/.ssh/config` — that file is for the `ssh` command, not your shell.
- **Do not** use `persuasive-computing-lab.cs.dal.ca` as the SSH hostname — it does not resolve from outside; use `persuasive.research.cs.dal.ca`.
