# Open server project in Cursor / VS Code (Remote SSH)

Use this to browse and edit server files in the **sidebar explorer** (not `ls` / `vim` in terminal).

## Prerequisites

- SSH access works: [login-ssh-terminal.md](./login-ssh-terminal.md)
- **Remote SSH extension** installed in Cursor

## Install Remote SSH (first time only)

1. `Shift+Cmd+P` → type **Remote: Install Remote Development Extensions**
2. Install **Remote - SSH** by **Cursor** (`anysphere.remote-ssh`) — not Microsoft’s VS Code-only extension
3. `Shift+Cmd+P` → **Developer: Reload Window**

After install, `Shift+Cmd+P` → **Remote-SSH: Connect to Host…** should appear.

## Connect and open the project

1. `Shift+Cmd+P` → **Remote-SSH: Connect to Host…**
2. Select **`pcl`** or enter `enejak@persuasive.research.cs.dal.ca`
3. Enter password
4. **File → Open Folder…**
5. Open: **`/home/enejak/thesis-hasoc-model-training`**

The explorer shows the live server tree: `modeling/`, `runs/`, `notebooks/`, etc.

## Map: server folder vs local repo

| On server | On your Mac (`kc_train`) |
|-----------|---------------------------|
| `~/thesis-hasoc-model-training/` | `model_training/` |
| `backend_api_server/` (if synced) | `backend_api_server/` |
| Full dashboard / monorepo | `frontend_dashboard/`, root `how_to/` |

The server copy is the **training bundle**; your Mac repo is the **full thesis monorepo**.

## Git warning: “too many active changes”

If you see:

> The git repository has too many active changes, only a subset of Git features will be enabled.

Cause: huge untracked folders (`runs/`, `kc_train_venv/`, `logs/`) — often tens of thousands of files.

**Fix on the server** (Remote SSH terminal):

```bash
cd ~/thesis-hasoc-model-training

# See what is flooding Git
git status -u --short | wc -l

# Ensure .gitignore includes (at repo root):
#   runs/
#   kc_train_venv/
#   logs/
#   __pycache__/
#   .ipynb_checkpoints/
#   new_dataset/
#   *.safetensors
#   checkpoint-*/

# Stop tracking bulky dirs if they were ever committed (files stay on disk)
git rm -r --cached runs/ kc_train_venv/ logs/ 2>/dev/null || true

git status -u --short | wc -l   # should be a small number
```

Then **Developer: Reload Window**.

Clicking **OK** on the warning is fine — editing still works; only Git sidebar features are limited.

## Remote SSH troubleshooting

| Problem | Fix |
|---------|-----|
| No “Connect to Host” command | Install extension (see above) |
| Clicking host does nothing | Extension gear → **Install Another Version** → try `1.0.50`; disable **Auto Update** |
| Server install timeout | On server: `rm -rf ~/.cursor-server` then reconnect |
| Slow connect | Settings JSON: `"remote.SSH.connectTimeout": 120` |

## Fallback without Remote SSH

Sync to Mac and edit locally:

```bash
rsync -avz pcl:~/thesis-hasoc-model-training/ ./server_mirror/
```

See [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md) for `rsync` patterns.

## Related

- Terminal-only SSH: [login-ssh-terminal.md](./login-ssh-terminal.md)
- Use models in backend: [run-backend-inference-api.md](./run-backend-inference-api.md)
