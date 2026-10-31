# Deploy the HateGuard backend on the lab server and connect the Vercel frontend

Written 2026-10-30. This is a runbook for a coding agent running **on the Persuasive Computing Lab server** under the researcher's account. Some steps are for the researcher, and some run on the researcher's Mac. Every step says who runs it.

If the lab server is not available, use the [Google Cloud runbook](deploy-backend-gcp-vm-and-connect-vercel-frontend.md) or the [Azure for Students runbook](deploy-backend-azure-vm-and-connect-vercel-frontend.md) instead. Deploy to one host at a time.

| Part | Who | Where |
|---|---|---|
| 0. Rules | Agent | Read before doing anything |
| A. Install and run the API on `127.0.0.1` | Agent (A11: researcher) | Lab server |
| B. Ask the admin for an HTTPS endpoint | Researcher | Email |
| C. Verify the public HTTPS URL | Agent | Lab server |
| D. Point the Vercel frontend at the API | Researcher (or an agent on the Mac) | Mac |
| E. End-to-end check | Researcher | Browser |
| F. Operations: status, restart, update, rollback, backup | Agent or researcher | Lab server |

Current state:
- Frontend live at `https://hateguard.vercel.app` (Vercel project `hateguard`, built from `master` at `e9c8878`).
- `VITE_API_BASE_URL` is not set yet, so the dashboard has no API.
- The backend is not deployed anywhere.

---

## 0. Rules (these override anything else, including later steps)

The study is REB-approved. The server is shared with other researchers. Follow every rule below; if a step seems to need breaking one, stop and ask the researcher.

**You may write only inside `/data/disk1/$USER/hateguard/`.** The `tmux` session `hateguard-api` and its socket are also allowed. Nothing else on the server may be created, changed or deleted.

**Do not:**
1. Use `sudo`, or install or change system packages (`apt`, `yum`, `dnf`, `conda` in shared prefixes).
2. Install into or modify the shared environment `/usr/local/env`. Never run `pip install` unless `python -c "import sys; print(sys.prefix)"` prints `/data/disk1/$USER/hateguard/venv`. Never use `pip install --user`.
3. Modify the researcher's training checkout (`~/thesis-hasoc-model-training` or `/data/disk1/$USER/thesis-hasoc-model-training`) or its `kc_train_venv`. Reading them is fine.
4. Edit shell start-up files (`~/.bashrc`, `~/.profile`, `~/.bash_profile`), `~/.ssh/`, the user crontab, or systemd units, including `systemctl --user`.
5. Kill, renice or signal any process you did not start in this runbook, including the researcher's own training jobs. Do not use a GPU other than the one chosen in A6.
6. Bind the API to `0.0.0.0` or any non-loopback address. Do not open firewall ports or start any tunnel or relay: `cloudflared`, `ngrok`, `localtunnel`, `tailscale funnel`, `ssh -R`, or similar. A tunnel would open a shared university server to the internet without the admin's approval. Public HTTPS comes only from the server admin (Part B).
7. Run port scans or connect to other users' services.
8. Run `scripts/seed_demo_data.py`. The repository is **public**, so the seed accounts' password is public too. It creates `user1@test.com` and `platform@test.com`, which are the built-in admin defaults. Participant seeding is a separate task (see "Out of scope").
9. Set `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `OPENAI_API_KEY` or `HF_HOME`, or set `USE_OPEN_AI_MODERATION_API` to anything except `false`. Study data must stay in SQLite on this server, and OpenAI Moderation would send text to OpenAI.
10. Copy the researcher's Mac `backend_api_server/.env` to the server. It contains settings that are wrong for the study.
11. Commit or push from the server. The deployment is a detached checkout.

**Secrets:**
- Never read, print, log, copy or store a password, a Hugging Face token or an API key.
- Never ask the researcher to paste one into the chat.
- When a secret is needed (A5 token, A11 password), the researcher types it into their own SSH terminal.
- If a command prints a secret by accident, do not repeat it. Tell the researcher, so they can revoke it.

**Stop and ask the researcher** when:
- a check's output differs from what this runbook expects;
- a step fails twice;
- `/data/disk1/$USER/hateguard` already exists;
- no GPU has enough free memory;
- anything would touch something outside your write area.

Report the exact command and its output.

---

## Inputs from the researcher (ask for these before Part A)

| Input | Used in | Notes |
|---|---|---|
| `ADMIN_EMAIL`: the researcher's own login email for the dashboard | A7, A11 | Not a `@test.com` address |
| Commit to deploy | A3 | Default: current `origin/master`. Must match the commit the Vercel frontend was built from (plan M6: fixed git commit). |
| `<server-host>`: the public hostname in the JupyterHub URL (without `:8000`) | B, C | `hostname -f` returns the internal name, which is not reachable from outside. Don't use it. |
| Study end date | B | For the admin request |

Every command below assumes this variable. Set it again in every new shell:

```bash
export BASE=/data/disk1/$USER/hateguard
```

Target layout:

```text
/data/disk1/$USER/hateguard/        (mode 700)
├── app/                    git checkout (detached), backend in app/backend_api_server/
│   └── backend_api_server/.env   deployment config (mode 600, git-ignored)
├── venv/                   Python environment for the API only
├── bin/env.sh              sets up the environment (sourced)
├── bin/start-api.sh        runs uvicorn in the foreground (inside tmux)
├── data/dashboard.db       SQLite: users, prediction logs, triage, explanation cache
├── hf-cache/               Hugging Face model cache
├── pip-cache/
├── logs/api.log
├── constraints.txt         pins torch to the version found in A4
└── DEPLOYMENT_RECORD.md    what is deployed (plan M6)
```

---

## Part A. Install and run the API on the server (agent)

### A1. Preflight (read-only)

```bash
whoami; hostname -f
ls -ld /data/disk1/$USER && df -h /data/disk1/$USER "$HOME"
ls -d /data/disk1/$USER/hateguard 2>/dev/null && echo "EXISTS: stop and ask"
command -v git curl tmux python3
nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv
pgrep -u "$USER" -af "uvicorn|app.main" || echo "no API process of ours running"
env | grep -E '^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|OPENAI_API_KEY|HF_HOME|HF_TOKEN)=' | cut -d= -f1
```

The last line prints only variable **names**. Report any that are set. `bin/env.sh` unsets the database and OpenAI ones. Leave `HF_HOME` alone: the Hugging Face token lives there.

Check the shared environment:

```bash
( source /usr/local/env/bin/activate && python - <<'EOF'
import sys, torch
print("python", sys.version.split()[0])
print("prefix", sys.prefix, "| base_prefix", sys.base_prefix)
print("torch", torch.__version__, "| cuda", torch.version.cuda, "| available", torch.cuda.is_available())
EOF
)
```

Expected: Python ≥ 3.10, and `available True`. Otherwise stop and ask.

### A2. Create the deployment folder

```bash
mkdir -p "$BASE"/{bin,data,logs,hf-cache,pip-cache}
chmod 700 "$BASE"
```

### A3. Get the code at a fixed commit

The repository is public, so no credentials are needed.

```bash
git clone https://github.com/chingsley/thesis-hasoc-model-training.git "$BASE/app"
cd "$BASE/app"
git checkout --detach origin/master        # or: git checkout --detach <commit from the researcher>
git log -1 --format='%H %cs %s'
ls backend_api_server/app/main.py backend_api_server/requirements.txt backend_api_server/requirements-explain.txt
```

### A4. Python environment

Build a venv on top of the shared environment, so it reuses the admin-installed, CUDA-matched PyTorch:

```bash
( source /usr/local/env/bin/activate && python -m venv --system-site-packages "$BASE/venv" )
( source /usr/local/env/bin/activate && source "$BASE/venv/bin/activate" && \
  python -c "import sys, torch; print(sys.prefix); print(torch.__version__, torch.__file__, torch.cuda.is_available())" )
```

Decide from the output:
- **Case S** (expected): prints `$BASE/venv`, then the shared torch version, a path under `/usr/local/env`, and `True`. Continue.
- **Case P**: `ModuleNotFoundError: No module named 'torch'`. This means `/usr/local/env` is itself a venv, so its packages are not inherited. Recreate the venv **without** `--system-site-packages`, then install the same torch build as the shared environment (values from A1):
  ```bash
  rm -rf "$BASE/venv"
  ( source /usr/local/env/bin/activate && python -m venv "$BASE/venv" )
  ( source "$BASE/venv/bin/activate" && PIP_CACHE_DIR="$BASE/pip-cache" \
    python -m pip install "torch==<shared version without the +suffix>" \
      --index-url https://download.pytorch.org/whl/cu<cuda version without the dot> )
  ```
  For example, torch `2.5.1+cu121` with CUDA `12.1` gives `torch==2.5.1` and `.../whl/cu121`. Then rerun the check above. It must print `True`.
- **Anything else** (for example torch imports but `False`): stop and ask.

Install the backend dependencies with torch pinned, so pip never replaces it:

```bash
source /usr/local/env/bin/activate && source "$BASE/venv/bin/activate"
python -c "import sys; assert sys.prefix == '$BASE/venv', sys.prefix; print('OK venv')"
export PIP_CACHE_DIR="$BASE/pip-cache"
python -c "import torch; print('torch==' + torch.__version__)" > "$BASE/constraints.txt"
cd "$BASE/app/backend_api_server"
python -m pip install -c "$BASE/constraints.txt" -r requirements.txt -r requirements-explain.txt
python - <<'EOF'
import numpy, torch, transformers, fastapi, uvicorn, sklearn, huggingface_hub
import lime, shap, captum
print("numpy", numpy.__version__, "| torch", torch.__version__, "| transformers", transformers.__version__)
print("cuda available", torch.cuda.is_available(), "| devices", torch.cuda.device_count())
EOF
```

The import check must pass and print `cuda available True`. If an import fails, make one fix attempt **inside the venv** (for example, install the compatible version pip suggests). If it still fails, stop and report the full error.

### A5. Hugging Face access

This only checks that the model repositories are reachable. It does not print the token.

```bash
source /usr/local/env/bin/activate && source "$BASE/venv/bin/activate"
python - <<'EOF'
from huggingface_hub import model_info
for repo in ("chingsley/afro-xlmr-igbo-hate",
             "chingsley/afro-xlmr-yoruba-hate",
             "chingsley/afro-xlmr-joint-igbo-yoruba-hate"):
    info = model_info(repo)
    print(repo, info.sha, "private" if info.private else "public")
EOF
```

Keep the three revision SHAs for the record (A12).

If this fails with 401 or `RepositoryNotFound`, the server has no token. Ask the researcher to run `hf auth login` in **their own SSH terminal**, with a read-only token (older versions: `huggingface-cli login`). Then retry. Do not set `HF_TOKEN` in any file.

### A6. Choose the GPU and the port

```bash
nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv,noheader
```

Choose the GPU with the most free memory (total minus used). It needs at least **6 GiB free**: three XLM-R base models plus explanation work. If none qualifies, stop and ask. Never free a GPU by stopping someone else's job.

Find a free loopback port in 8090–8099:

```bash
python3 - <<'EOF'
import socket
for port in range(8090, 8100):
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", port))
        print(port)
        break
    except OSError:
        continue
    finally:
        s.close()
EOF
```

### A7. Deployment config

Replace the three values first:

```bash
PORT=<port from A6>; GPU=<GPU index from A6>; ADMIN_EMAIL=<researcher's email>
umask 077
cat > "$BASE/app/backend_api_server/.env" <<EOF
# HateGuard study deployment on the lab server. Git-ignored. Do not commit.
HATEGUARD_PORT=$PORT
CUDA_VISIBLE_DEVICES=$GPU
INFERENCE_DEVICE=cuda

HF_MODEL_SET=original
HF_MODEL_ID_IGBO=chingsley/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=chingsley/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=chingsley/afro-xlmr-joint-igbo-yoruba-hate
HF_HUB_CACHE=$BASE/hf-cache
HF_HUB_DISABLE_TELEMETRY=1

# SQLite on this server only.
DASHBOARD_DB_PATH=$BASE/data/dashboard.db

CORS_ORIGINS=https://hateguard.vercel.app

# Replace the built-in @test.com admin defaults.
PLATFORM_ADMIN_EMAILS=$ADMIN_EMAIL
API_KEY_ADMIN_EMAILS=$ADMIN_EMAIL
INVITE_ADMIN_EMAILS=$ADMIN_EMAIL

# Must stay false: Moderation mode sends text to OpenAI (plan M1).
USE_OPEN_AI_MODERATION_API=false
LOG_LEVEL=INFO
EOF
chmod 600 "$BASE/app/backend_api_server/.env"
grep -E '^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|OPENAI_API_KEY|HF_TOKEN|HF_HOME)=' "$BASE/app/backend_api_server/.env" && echo "FORBIDDEN KEY: fix" || echo "OK no forbidden keys"
cd "$BASE/app" && git status --short    # must be empty: .env is git-ignored
```

- `HF_MODEL_SET=original` matches the researcher's current local set-up: the published models with test macro-F1 of Igbo ≈ 0.86 and Yoruba ≈ 0.67. Change it to `merged` only if the researcher says so.
- `INFERENCE_DEVICE=cuda` (not `auto`) makes start-up fail loudly instead of silently falling back to CPU. On CPU, explanations exceed the dashboard's 25 s limit.

### A8. Start-up scripts

```bash
cat > "$BASE/bin/env.sh" <<'EOF'
# Sourced by start-api.sh and by manual admin commands: sets up the HateGuard API environment.
BASE="/data/disk1/$USER/hateguard"
unset DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL OPENAI_API_KEY USE_OPEN_AI_MODERATION_API
source /usr/local/env/bin/activate
source "$BASE/venv/bin/activate"
cd "$BASE/app/backend_api_server"
set -a
source ./.env
set +a
EOF

cat > "$BASE/bin/start-api.sh" <<'EOF'
#!/usr/bin/env bash
# Runs the HateGuard API in the foreground; start it inside tmux session hateguard-api.
set -eo pipefail
exec >> "/data/disk1/$USER/hateguard/logs/api.log" 2>&1
source "/data/disk1/$USER/hateguard/bin/env.sh"
echo "=== start $(date -u +%FT%TZ) commit $(git -C "$BASE/app" rev-parse --short HEAD)"
exec python -m uvicorn app.main:app --host 127.0.0.1 --port "$HATEGUARD_PORT" --workers 1
EOF
chmod 700 "$BASE/bin/start-api.sh"
chmod 600 "$BASE/bin/env.sh"
```

Use **one worker**, and never `--reload`. Each worker loads all three models, and SQLite expects a single writer process.

### A9. Start the API

Start it from an **SSH** session, not a JupyterHub terminal. Processes under JupyterHub can be stopped when the hub culls an idle server. `tmux` keeps the API running after you disconnect.

```bash
tmux new-session -d -s hateguard-api "/data/disk1/$USER/hateguard/bin/start-api.sh"
PORT=$(grep '^HATEGUARD_PORT=' "$BASE/app/backend_api_server/.env" | cut -d= -f2)
```

Wait for start-up. The first start downloads about 3.3 GB of models, so it can take several minutes. Poll every 10 seconds for up to 15 minutes (run this in the background if your tool does not allow sleeping in the foreground):

```bash
for i in $(seq 1 90); do
  curl -sf "http://127.0.0.1:$PORT/health" && { echo; echo READY; break; }
  tmux has-session -t hateguard-api 2>/dev/null || { echo "API EXITED"; tail -n 60 "$BASE/logs/api.log"; break; }
  sleep 10
done
```

If the API exits, read `$BASE/logs/api.log`, fix the cause within the rules, and start again.

### A10. Verify

```bash
curl -s "http://127.0.0.1:$PORT/health" | python3 -m json.tool
```

The output must show all of the following:
- `"status": "ok"`
- `"device": "cuda"`
- `"models"` containing `igbo`, `yoruba` and `joint` with the three IDs from A7
- `"model_set": "original"`
- `"use_openai_moderation": false`

If `device` is `cpu` or moderation is `true`, stop the API (F2) and fix it.

```bash
# Listens on loopback only
ss -ltn 2>/dev/null | grep ":$PORT " || netstat -ltn 2>/dev/null | grep ":$PORT "
# expected: 127.0.0.1:<PORT>, never 0.0.0.0 or *

# Our process is on the chosen GPU only (match the pid's gpu_uuid to the A6 index)
pgrep -u "$USER" -f "uvicorn app.main:app"
nvidia-smi --query-compute-apps=pid,gpu_uuid,used_memory --format=csv
nvidia-smi --query-gpu=index,uuid --format=csv

# Authentication is enforced: expected 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:$PORT/predict" \
  -H 'Content-Type: application/json' -d '{"text":"test","language":"igbo"}'

# CORS allows the study frontend: expected HTTP 200 and access-control-allow-origin: https://hateguard.vercel.app
curl -s -o /dev/null -D - -X OPTIONS "http://127.0.0.1:$PORT/auth/login" \
  -H "Origin: https://hateguard.vercel.app" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" | grep -iE "^HTTP|access-control-allow-origin"

# CORS rejects other origins: expected HTTP 400 and no allow-origin header
curl -s -o /dev/null -D - -X OPTIONS "http://127.0.0.1:$PORT/auth/login" \
  -H "Origin: https://example.com" -H "Access-Control-Request-Method: POST" | grep -iE "^HTTP|access-control-allow-origin"
```

### A11. Researcher creates their dashboard account (researcher runs this)

Ask the researcher to run this in **their own SSH terminal**. It asks for a password, which must not pass through the agent:

```bash
source /data/disk1/$USER/hateguard/bin/env.sh
python scripts/create_user.py --email <ADMIN_EMAIL> --name "<full name>" --org "HateGuard Research Team"
```

`env.sh` sets `DASHBOARD_DB_PATH`, so the account goes into the deployment database. Don't add `--key-name`; an API key isn't needed. Then check that the account exists. This prints emails only:

```bash
source "$BASE/bin/env.sh"
python -c "import os, sqlite3; print(sqlite3.connect(os.environ['DASHBOARD_DB_PATH']).execute('select email from users').fetchall())"
```

Expected: exactly one row, the researcher's email.

### A12. Deployment record (plan M6)

Write `$BASE/DEPLOYMENT_RECORD.md` with the values you found. Include no secrets.
- Date (UTC) and the server's internal hostname.
- Git commit (full SHA and subject); the commit Vercel was built from (`e9c8878` at the time of writing).
- Python, torch, CUDA, transformers and numpy versions; which case from A4 applied.
- GPU index and name; port.
- `HF_MODEL_SET`, the three model IDs and their revision SHAs (from A5).
- `CORS_ORIGINS`, `USE_OPEN_AI_MODERATION_API=false`, `DASHBOARD_DB_PATH`.
- Public API URL: "pending admin" until Part C.

### A13. Report to the researcher

Report:
- the A10 check results;
- the port and the server username;
- the filled-in admin request from Part B.

**The API is not yet reachable by participants.** Stop here until the admin answers.

---

## Part B. Ask the server admin for an HTTPS endpoint (researcher)

Participants' browsers load the dashboard from `https://hateguard.vercel.app`, so the API must be on HTTPS: browsers block calls from an HTTPS page to an HTTP API. Without root, the account cannot obtain a certificate or open a port, and third-party tunnels are ruled out (rule 6). Send this to the admin, filled in. Do not include any password.

> **Subject:** HTTPS reverse proxy for a thesis study API on `<server-host>`
>
> Hi,
>
> For my REB-approved thesis user study, I am running a small web API (FastAPI) under my account `<username>` on `<server-host>`. It listens only on `127.0.0.1:<PORT>`. The study dashboard is a static site at `https://hateguard.vercel.app`, and participants' browsers need to call this API directly over HTTPS. Participant data stays on this server, and no third-party service is involved.
>
> Could you set up a reverse proxy to it? Either form works for me:
> 1. `https://<server-host>:<a public port, e.g. 8443>/` → `http://127.0.0.1:<PORT>/`
> 2. `https://<server-host>/hateguard-api/` → `http://127.0.0.1:<PORT>/`, with the `/hateguard-api` prefix stripped
>
> Requirements:
> - a publicly trusted TLS certificate (the one used for JupyterHub is fine);
> - reachable from off-campus networks, as some participants join remotely;
> - all methods (including `OPTIONS`) and headers (`Authorization`, `Content-Type`) passed through unchanged, with no CORS headers added by the proxy (the app sets them);
> - a read timeout of at least 120 s (some explanation requests are slow) and a request body limit of at least 10 MB.
>
> I need it until `<study end date>` and will tell you when it can be removed. Is it also OK for me to keep this process running in `tmux` and use one GPU (about 4–6 GB) during that period?
>
> Thank you,
> `<name>`

---

## Part C. Verify the public HTTPS URL (agent, after the admin replies)

Use the URL the admin gives, **without a trailing slash**:

```bash
API_URL=https://...
curl -sS -o /dev/null -w "HTTP %{http_code} | TLS verify %{ssl_verify_result}\n" "$API_URL/health"
curl -sS "$API_URL/health" | python3 -m json.tool
curl -s -o /dev/null -D - -X OPTIONS "$API_URL/auth/login" \
  -H "Origin: https://hateguard.vercel.app" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" | grep -iE "^HTTP|access-control-allow-origin"
```

Expected:
- `HTTP 200 | TLS verify 0`;
- the same `/health` JSON as in A10;
- exactly **one** `access-control-allow-origin: https://hateguard.vercel.app` line.

If the header appears twice, the proxy is adding CORS headers. Ask the researcher to have the admin remove them.

Add `API_URL` to `DEPLOYMENT_RECORD.md` and give it to the researcher for Part D.

---

## Part D. Point the Vercel frontend at the API (researcher's Mac, Vercel CLI logged in)

The value is built into the JavaScript at build time, so changing it needs a rebuild. Set it for **Production** only. Preview deployments use other domains, which `CORS_ORIGINS` does not allow.

```bash
API_URL=https://...        # exact URL from Part C, no trailing slash
curl -sS "$API_URL/health" # must also work from off the server

printf '{"key":"VITE_API_BASE_URL","value":"%s","type":"plain","target":["production"]}' "$API_URL" \
  | vercel api "/v10/projects/hateguard/env?upsert=true" -X POST --input -
vercel redeploy hateguard.vercel.app --target production
```

If `redeploy` rejects the alias, take the newest production deployment URL from `vercel ls hateguard` and pass that instead.

Check that the URL is in the deployed bundle. Vite splits the JavaScript into chunks, and the API config is not in `index-*.js`, so search every chunk. At least one must match:

```bash
JS=$(curl -s https://hateguard.vercel.app/ | grep -o '/assets/index-[^"]*\.js' | head -1)
for c in $(curl -s "https://hateguard.vercel.app$JS" | grep -o 'assets/[A-Za-z0-9_-]*\.js' | sort -u) "${JS#/}"; do
  curl -s "https://hateguard.vercel.app/$c" | grep -qF "$API_URL" && echo "found in $c"
done
```

Do **not** add a Vercel rewrite, function or middleware that proxies the API. Do not enable Vercel Web Analytics or Speed Insights.

---

## Part E. End-to-end check (researcher, browser)

1. Open `https://hateguard.vercel.app` in a private window. The login page appears.
2. Sign in with the account from A11.
3. DevTools, Network tab: API requests go to `API_URL` directly, not to `hateguard.vercel.app`.
4. Classify Posts: classify one Igbo sentence. A label and confidence come back. On the server, `tail -n 5 $BASE/logs/api.log` shows `POST /predict` with status 200.
5. Performance: the metrics load for Igbo and Yoruba.
6. Reload the browser on `/explainability`. The page loads, with no 404.

---

## Part F. Operations

Run these on the server with `BASE` and `PORT` set as in A9.

| Task | Command |
|---|---|
| F1. Status | `tmux has-session -t hateguard-api && curl -s http://127.0.0.1:$PORT/health` |
| Logs | `tail -n 100 $BASE/logs/api.log` |
| F2. Stop | `tmux send-keys -t hateguard-api C-c`, then confirm `tmux has-session -t hateguard-api` fails |
| F3. Start | `tmux new-session -d -s hateguard-api "$BASE/bin/start-api.sh"`, then repeat the A9 wait loop and A10 checks |
| Restart | F2, then F3 (needed after any `.env` change) |

**After a server reboot**, the tmux session is gone and the API does not start by itself. Run F3 and A10. Before each study session, run F1. Add a `@reboot` crontab entry only if the researcher and the admin both agree.

**Back up the study database** before and after each session day:

```bash
source "$BASE/bin/env.sh"
python - <<'EOF'
import datetime, os, sqlite3
src = os.environ["DASHBOARD_DB_PATH"]
dst = os.path.join(os.path.dirname(src), "backup-" + datetime.datetime.now().strftime("%Y%m%d-%H%M") + ".db")
with sqlite3.connect(dst) as out:
    sqlite3.connect(src).backup(out)
print(dst)
EOF
```

**Update to a new commit.** Only on the researcher's instruction, and not between participants without recording it. The Vercel frontend must be rebuilt from the same commit.

```bash
cd "$BASE/app"
OLD=$(git rev-parse HEAD)
git fetch origin && git checkout --detach <commit or origin/master>
git diff --stat "$OLD" HEAD -- backend_api_server/requirements.txt backend_api_server/requirements-explain.txt
```

If the requirements changed, rerun the install part of A4 (inside the venv, with the constraints file). Then restart and run A10. Update `DEPLOYMENT_RECORD.md` (old SHA, new SHA, date).

**Roll back:** `git checkout --detach <previous SHA from the record>`, then restart and run A10.

**After the study:**
1. Stop the API (F2).
2. The researcher tells the admin the proxy can be removed and removes `VITE_API_BASE_URL` from Vercel.
3. Do not delete `data/` or the backups. Retention follows the REB protocol, and that is the researcher's decision.

---

## Out of scope (separate tasks, not part of this runbook)

- **Per-participant organizations and seeding** (plan M4/M7): one organization and account per participant, seeded within one hour before their session. This needs its own script; never `seed_demo_data.py` on this server.
- **An alert for task T9** (plan M5): classify a prepared batch within one hour before the session.
- **Pre-computing explanations and measuring latency** (plan M3/B5): warm the cache for every study post. Check per-method latency on the GPU against the dashboard's 25 s request limit.
