# Log in to the server via SSH (terminal)

Use this for **command-line work**: training scripts, `git`, `tmux`, copying files, uploading to Hugging Face.

## Quick connect

```bash
ssh enejak@persuasive.research.cs.dal.ca
```

Enter your lab password when prompted.

## Shortcut host `pcl` (recommended)

Add once to `~/.ssh/config` on your Mac:

```sshconfig
Host *
    UseKeychain yes

Host pcl
    HostName persuasive.research.cs.dal.ca
    User enejak
    # Remote project: ~/thesis-hasoc-model-training
```

Then connect with:

```bash
ssh pcl
```

**Important:** Do **not** run `source ~/.ssh/config`. That file is only read by the `ssh` command.

## Wrong hostnames (do not use)

| Hostname | Status |
|----------|--------|
| `persuasive.research.cs.dal.ca` | Correct (external SSH) |
| `persuasive-computing-lab.cs.dal.ca` | **NXDOMAIN** — does not resolve |
| `persuasive-computing-lab` | Internal name only — appears in prompt after you are already logged in |

## After login

```bash
cd ~/thesis-hasoc-model-training
ls
# dataset  modeling  notebooks  runs  kc_train_venv  run_all.sh  ...
```

Activate the training environment:

```bash
source kc_train_venv/bin/activate
```

Check GPUs:

```bash
nvidia-smi
```

Check trained runs:

```bash
ls runs/
# afriberta_large  afro_xlmr_base  afro_xlmr_joint  xlm_roberta_base
```

## Long-running jobs (`tmux`)

Training should run inside `tmux` so it survives disconnect:

```bash
tmux new -s train
cd ~/thesis-hasoc-model-training
source kc_train_venv/bin/activate
./run_all.sh

# Detach: Ctrl+b  then  d
# Reattach later:
tmux attach -t train
```

## Copy files between Mac and server

With `pcl` configured:

```bash
# Server → Mac
scp pcl:~/thesis-hasoc-model-training/logs/training_*.log ./

# Mac → Server
scp ./some_file.py pcl:~/thesis-hasoc-model-training/
```

For large folders (model checkpoints), use `rsync` — see [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md).

## Related

- Browser login: [login-jupyterhub-browser.md](./login-jupyterhub-browser.md)
- Cursor file explorer: [open-project-remote-ssh.md](./open-project-remote-ssh.md)
