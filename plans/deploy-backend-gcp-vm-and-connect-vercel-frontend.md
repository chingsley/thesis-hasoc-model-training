# Deploy the HateGuard backend on a Google Cloud VM (free trial) and connect the Vercel frontend

Written 2026-10-30. This runbook is for a coding agent on the **researcher's Mac**, and for the researcher. It puts the backend on a Google Cloud virtual machine (VM) paid for by the free-trial credit. Some steps are for the researcher, and some run on the VM over SSH. Every step says who runs it.

Use this when the lab server is not available. There are three runbooks; deploy to one host at a time:
- lab server: [deploy-backend-server-and-connect-vercel-frontend.md](deploy-backend-server-and-connect-vercel-frontend.md)
- Google Cloud: this file
- Azure for Students: [deploy-backend-azure-vm-and-connect-vercel-frontend.md](deploy-backend-azure-vm-and-connect-vercel-frontend.md)

| Part | Who | Where |
|---|---|---|
| 0. Rules | Agent | Read before doing anything |
| A. Create the project, VM, static IP, firewall rule and web address | Researcher (A1, A2, A5, A6) and agent (A3, A4) | Browser and Mac |
| B. Install the API and HTTPS on the VM | Agent (B6 and B11: researcher) | VM, over SSH |
| C. Verify the public HTTPS URL | Agent | Mac |
| D. Point the Vercel frontend at the API | Agent or researcher | Mac |
| E. End-to-end check | Researcher | Browser |
| F. Operations, costs and teardown | Agent or researcher | Mac and VM |

How it fits together:

```text
Participant's browser ──► https://hateguard.vercel.app        static dashboard files (Vercel)
Participant's browser ──► https://<name>.duckdns.org ──► VM:  Caddy (HTTPS, ports 80/443)
                                                               └─► API on 127.0.0.1:8000 (FastAPI, 3 models, SQLite)
```

Current state:
- Frontend live at `https://hateguard.vercel.app` (Vercel project `hateguard`, built from `master` at `e9c8878`).
- `VITE_API_BASE_URL` is not set yet, so the dashboard has no API.
- The backend is not deployed anywhere.

The VM has **no GPU**: free-trial accounts cannot add one. Classifying posts is fast on the CPU. Explanations of new text can take longer than the dashboard's 25 s limit, so they must be pre-computed before the first session (see "Out of scope", M3).

---

## 0. Rules (these override anything else, including later steps)

**You may create or change only the following:**
- In Google Cloud, inside the project from A3: one VM `hateguard-api`, one static IP `hateguard-ip`, and one firewall rule `hateguard-allow-web`.
- On the VM: the packages `git`, `python3-venv` and `caddy`; the system user `hateguard`; everything under `/opt/hateguard/`; `/etc/systemd/system/hateguard-api.service`; `/etc/caddy/Caddyfile`.
- On the Mac: files in your own scratch directory, and backups in `~/hateguard-backups/`.

**Do not:**
1. Touch any other Google Cloud project, or change billing settings. Pass `--project "$PROJECT"` to every `gcloud` command.
2. Upgrade the free trial to a paid account ("Activate full account" or "Upgrade"). Only the researcher decides that. While the account is a free trial, Google does not charge the card.
3. Create anything else that costs money: no GPU, no second VM, no load balancer, no Cloud SQL or Cloud Run, no bigger disk.
4. Open any port other than 22, 80 and 443. The API listens on `127.0.0.1:8000` only. Caddy is the only public server.
5. Run `scripts/seed_demo_data.py`. The repository is **public**, so the seed accounts' password is public too. It creates `user1@test.com` and `platform@test.com`, which are the built-in admin defaults. Participant seeding is a separate task (see "Out of scope").
6. Set `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `OPENAI_API_KEY`, `HF_TOKEN` or `HF_HOME`, or set `USE_OPEN_AI_MODERATION_API` to anything except `false`. The study database is the SQLite file on the VM, and OpenAI Moderation would send text to OpenAI (plan M1).
7. Copy the researcher's Mac `backend_api_server/.env` to the VM. It contains settings that are wrong for the study, and secrets.
8. Commit or push, on the VM or on the Mac. The researcher makes all commits.
9. Use `sudo` on the VM for anything except the commands in this runbook.

**Secrets:**
- Never read, print, log, copy or store a password, a Hugging Face token, a DuckDNS token or an API key.
- Never ask the researcher to paste one into the chat.
- When a secret is needed (B6 token, B11 password), the researcher types it into their own SSH terminal.
- If a command prints a secret by accident, do not repeat it. Tell the researcher, so they can revoke it.

**Stop and ask the researcher** when:
- a check's output differs from what this runbook expects;
- a step fails twice;
- a resource with the same name already exists;
- the free trial is not active (A1);
- Caddy cannot get a certificate (B10).

Report the exact command and its output.

---

## Inputs from the researcher (ask for these before Part A)

| Input | Used in | Notes |
|---|---|---|
| `ADMIN_EMAIL`: the researcher's own login email for the dashboard | B7, B11 | Not a `@test.com` address |
| Commit to deploy | B4 | Default: current `origin/master`. Must match the commit the Vercel frontend was built from (plan M6: fixed git commit). |
| Region and zone | A4 | Default `northamerica-northeast1` and `northamerica-northeast1-a` (Montreal, close to Halifax). Any region works. |
| DuckDNS subdomain | A5 | For example `hateguard-study`, which gives `hateguard-study.duckdns.org` |
| Study end date | A1, F | The free trial ends 90 days after sign-up. It must last past the study. |

On the Mac, every command below assumes these variables. Set them again in every new shell:

```bash
export PROJECT=<project ID from A3>
export REGION=northamerica-northeast1
export ZONE=northamerica-northeast1-a
export VM=hateguard-api
export API_HOST=<subdomain>.duckdns.org
```

Layout on the VM:

```text
/opt/hateguard/                 home of system user hateguard (mode 750)
├── app/                        git checkout (detached), backend in app/backend_api_server/
│   └── backend_api_server/.env deployment config (mode 600, git-ignored)
├── venv/                       Python environment for the API only
├── constraints.txt             pins torch to the CPU build installed in B5
├── data/dashboard.db           SQLite: users, prediction logs, triage, explanation cache
├── backups/
├── hf-cache/                   Hugging Face model cache
├── .cache/huggingface/token    written by `hf auth login` in B6
└── DEPLOYMENT_RECORD.md        what is deployed (plan M6)
/etc/systemd/system/hateguard-api.service   runs the API, starts at boot
/etc/caddy/Caddyfile                        HTTPS for API_HOST, forwards to 127.0.0.1:8000
```

Logs go to the system journal: `journalctl -u hateguard-api` and `journalctl -u caddy`.

---

## Part A. Create the cloud resources

### A1. Start the free trial (researcher, browser)

1. Go to <https://cloud.google.com/free> and start the free trial with a Google account. Google asks for a card to confirm your identity. It does not charge the card during the trial.
2. In the console, open **Billing → Overview**. It must show the free-trial credit (US$300) and the date the trial ends. Write down the end date, and check that it is after the study end date.
3. Never click **Activate full account** or **Upgrade**.

### A2. Install and sign in to the Google Cloud CLI (researcher, Mac)

```bash
brew install --cask gcloud-cli
gcloud auth login              # opens the browser
gcloud billing accounts list   # expected: one account with OPEN True
```

Give the agent the `ACCOUNT_ID` from the last command. It is not a secret.

### A3. Create a project for the study (agent, Mac)

A separate project keeps the study apart from anything else in the account, and makes teardown one command.

```bash
export PROJECT=hateguard-study-$(openssl rand -hex 3)
echo "$PROJECT"    # tell the researcher; set it in every new shell
gcloud projects create "$PROJECT" --name="HateGuard study"
gcloud billing projects link "$PROJECT" --billing-account=<ACCOUNT_ID from A2>
gcloud services enable compute.googleapis.com --project "$PROJECT"
```

If `gcloud billing accounts list` showed more than one open account, stop and ask which one is the free trial.

### A4. Reserve a static IP, open ports 80 and 443, create the VM (agent, Mac)

The static IP keeps the same address when the VM is stopped and started, so the web address in A5 never needs updating.

```bash
gcloud compute addresses create hateguard-ip --project "$PROJECT" --region "$REGION"
IP=$(gcloud compute addresses describe hateguard-ip --project "$PROJECT" --region "$REGION" --format='value(address)')
echo "$IP"

gcloud compute firewall-rules create hateguard-allow-web --project "$PROJECT" \
  --network default --direction INGRESS --action ALLOW --rules tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 --target-tags hateguard-web

gcloud compute instances create "$VM" --project "$PROJECT" --zone "$ZONE" \
  --machine-type e2-standard-4 \
  --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
  --boot-disk-size 50GB --boot-disk-type pd-balanced \
  --address "$IP" --tags hateguard-web

gcloud compute instances describe "$VM" --project "$PROJECT" --zone "$ZONE" \
  --format='value(status,machineType.basename(),networkInterfaces[0].accessConfigs[0].natIP)'
gcloud compute firewall-rules list --project "$PROJECT"
```

Expected:
- `RUNNING  e2-standard-4  <IP>`.
- Firewall rules: `hateguard-allow-web` plus Google's defaults for a new project (`default-allow-ssh`, `default-allow-icmp`, `default-allow-internal`, `default-allow-rdp`). Nothing on the VM listens on 3389 (RDP), so leave the defaults alone.

`e2-standard-4` has 4 vCPUs and 16 GB of memory. The three models and the explanation methods need about 6 GB.

If the zone has no capacity for `e2-standard-4`, try zone `-b`, then `-c`, in the same region. Change `ZONE` everywhere.

### A5. Get a free web address (researcher, browser)

The browser needs a hostname to get an HTTPS certificate. DuckDNS gives one for free.

1. Go to <https://www.duckdns.org> and sign in.
2. Add the subdomain, for example `hateguard-study`.
3. In its **current ip** field, enter the IP from A4 and click **update ip**.
4. Keep the DuckDNS token to yourself. The VM does not need it, because its IP never changes.

The agent checks it on the Mac. It must print exactly the IP from A4 (it can take a minute):

```bash
dig +short "$API_HOST"
```

### A6. First SSH login (researcher, Mac)

```bash
gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE"
```

The first run creates the key `~/.ssh/google_compute_engine` and asks for a passphrase. If you set one, run `ssh-add --apple-use-keychain ~/.ssh/google_compute_engine` afterwards, so the agent's commands don't stop to ask for it. Type `exit` to leave the VM.

### How to run the Part B blocks

Each block in Part B runs on the VM. Each block also stands alone: nothing carries over from one block to the next.
- **Researcher:** paste the block into an SSH session opened as in A6.
- **Agent on the Mac:** save the block to a file in your scratch directory, then run:
  ```bash
  gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --command 'bash -s' < <block file>
  ```
- Replace every `<...>` placeholder first.
- Blocks marked **researcher** need hidden input typed in a terminal. The agent must not run them.

---

## Part B. Install and run the API on the VM

### B1. Preflight (agent, read-only)

```bash
cd /
. /etc/os-release && echo "$PRETTY_NAME"
echo "cpus $(nproc)"; free -h | head -2; df -h /
id hateguard 2>/dev/null && echo "USER EXISTS: stop and ask"
ls -d /opt/hateguard 2>/dev/null && echo "FOLDER EXISTS: stop and ask"
sudo ss -ltnp | grep -E ':(80|443|8000)\s' || echo "ports 80, 443 and 8000 are free"
```

Expected: `Ubuntu 24.04.x LTS`, `cpus 4`, about 15 GiB total memory, at least 40 GB free on `/`, and `ports 80, 443 and 8000 are free`.

### B2. Install packages (agent)

```bash
set -euo pipefail
cd /
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git python3-venv caddy
python3 --version
caddy version
systemctl is-active caddy
```

Expected: Python 3.12.x, Caddy v2.6 or newer, and `active`. Installing Caddy starts it with a placeholder page on port 80; B10 replaces its configuration.

If apt reports that another process holds its lock, the VM is still installing its first-boot updates. Wait two minutes and run the block again.

### B3. Create the service user and folders (agent)

The API runs as its own unprivileged user, never as root or as your login user.

```bash
set -euo pipefail
cd /
sudo useradd --system --create-home --home-dir /opt/hateguard --shell /usr/sbin/nologin hateguard
sudo chmod 750 /opt/hateguard
sudo -u hateguard mkdir -p /opt/hateguard/data /opt/hateguard/backups /opt/hateguard/hf-cache
sudo ls -la /opt/hateguard
```

### B4. Get the code at a fixed commit (agent)

The repository is public, so no credentials are needed.

```bash
cd /
sudo -u hateguard -H bash -s <<'EOF'
set -euo pipefail
cd /opt/hateguard
git clone https://github.com/chingsley/thesis-hasoc-model-training.git app
cd app
git checkout --detach origin/master        # or: git checkout --detach <commit from the researcher>
git log -1 --format='%H %cs %s'
ls backend_api_server/app/main.py backend_api_server/requirements.txt backend_api_server/requirements-explain.txt
EOF
```

### B5. Python environment (agent)

Install the CPU-only build of PyTorch first, then pin it so pip never replaces it with the much larger CUDA build:

```bash
cd /
sudo -u hateguard -H bash -s <<'EOF'
set -euo pipefail
cd /opt/hateguard
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install "torch>=2.2,<3" --index-url https://download.pytorch.org/whl/cpu
python -c "import torch; print('torch==' + torch.__version__)" > constraints.txt
cat constraints.txt
cd app/backend_api_server
python -m pip install -c /opt/hateguard/constraints.txt -r requirements.txt -r requirements-explain.txt
python - <<'PY'
import numpy, torch, transformers, fastapi, uvicorn, sklearn, huggingface_hub
import lime, shap, captum
print("numpy", numpy.__version__, "| torch", torch.__version__, "| transformers", transformers.__version__)
print("threads", torch.get_num_threads(), "| cuda available", torch.cuda.is_available())
PY
EOF
```

Expected: `constraints.txt` holds a torch version ending in `+cpu`; the import check passes, with numpy 1.26.x, `threads 4` and `cuda available False`.

If an install or import fails, make one fix attempt **inside the venv**, for example by installing the compatible version pip suggests. If it still fails, stop and report the full error.

### B6. Hugging Face access

The three model repositories are **private**, so the API needs a read token.

**Researcher**, in your own SSH session (A6):

```bash
cd /
sudo -u hateguard -H /opt/hateguard/venv/bin/hf auth login
```

- Paste a **read-only** token. Best: a fine-grained token that can read only the three `chingsley/afro-xlmr-*-hate` repositories. The input is hidden.
- Answer `n` to "Add token as git credential?".
- If `hf` is not found, run `sudo -u hateguard -H /opt/hateguard/venv/bin/huggingface-cli login` instead.

The token is saved in `/opt/hateguard/.cache/huggingface/token`. Only the `hateguard` user and root can read it.

**Agent**: check access. This does not print the token.

```bash
cd /
sudo -u hateguard -H /opt/hateguard/venv/bin/python - <<'EOF'
from huggingface_hub import model_info
for repo in ("chingsley/afro-xlmr-igbo-hate",
             "chingsley/afro-xlmr-yoruba-hate",
             "chingsley/afro-xlmr-joint-igbo-yoruba-hate"):
    info = model_info(repo)
    print(repo, info.sha, "private" if info.private else "public")
EOF
```

Expected: three lines, each with a revision SHA and `private`. Keep the SHAs for the record (B12). If this fails with 401 or `RepositoryNotFound`, the login did not work. Ask the researcher to repeat it.

### B7. Deployment config (agent)

Replace the email first:

```bash
set -euo pipefail
cd /
ADMIN_EMAIL=<researcher's email>
sudo -u hateguard bash -c 'umask 077 && cat > /opt/hateguard/app/backend_api_server/.env' <<EOF
# HateGuard study deployment on a Google Cloud VM. Git-ignored. Do not commit.
INFERENCE_DEVICE=cpu

HF_MODEL_SET=original
HF_MODEL_ID_IGBO=chingsley/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=chingsley/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=chingsley/afro-xlmr-joint-igbo-yoruba-hate
HF_HUB_CACHE=/opt/hateguard/hf-cache
HF_HUB_DISABLE_TELEMETRY=1

# The study database: SQLite on this VM only.
DASHBOARD_DB_PATH=/opt/hateguard/data/dashboard.db

CORS_ORIGINS=https://hateguard.vercel.app

# Replace the built-in @test.com admin defaults.
PLATFORM_ADMIN_EMAILS=$ADMIN_EMAIL
API_KEY_ADMIN_EMAILS=$ADMIN_EMAIL
INVITE_ADMIN_EMAILS=$ADMIN_EMAIL

# Must stay false: Moderation mode sends text to OpenAI (plan M1).
USE_OPEN_AI_MODERATION_API=false
LOG_LEVEL=INFO
EOF
sudo ls -l /opt/hateguard/app/backend_api_server/.env
sudo grep -E '^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|OPENAI_API_KEY|HF_TOKEN|HF_HOME)=' /opt/hateguard/app/backend_api_server/.env && echo "FORBIDDEN KEY: fix" || echo "OK no forbidden keys"
sudo -u hateguard git -C /opt/hateguard/app status --short    # must print nothing: .env is git-ignored
```

- `HF_MODEL_SET=original` matches the researcher's current local set-up: the published models with test macro-F1 of Igbo ≈ 0.86 and Yoruba ≈ 0.67. Change it to `merged` only if the researcher says so.
- `INFERENCE_DEVICE=cpu`: the VM has no GPU.
- The file must be `-rw-------` and owned by `hateguard`.

### B8. Run the API as a system service (agent)

systemd starts the API at boot and restarts it if it crashes. Use **one worker**, and never `--reload`. Each worker loads all three models, and SQLite expects a single writer process.

```bash
cd /
sudo tee /etc/systemd/system/hateguard-api.service >/dev/null <<'EOF'
[Unit]
Description=HateGuard API (thesis user study)
After=network-online.target
Wants=network-online.target

[Service]
User=hateguard
Group=hateguard
WorkingDirectory=/opt/hateguard/app/backend_api_server
EnvironmentFile=/opt/hateguard/app/backend_api_server/.env
ExecStart=/opt/hateguard/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now hateguard-api
```

Wait for start-up. The first start downloads about 3.3 GB of models, then loads them. Poll every 10 seconds for up to 10 minutes (run this in the background if your tool does not allow sleeping in the foreground):

```bash
for i in $(seq 1 60); do
  curl -sf http://127.0.0.1:8000/health && { echo; echo READY; break; }
  systemctl is-active --quiet hateguard-api || { echo "API NOT RUNNING"; sudo journalctl -u hateguard-api -n 60 --no-pager; break; }
  sleep 10
done
```

If the API is not running, read the journal output, fix the cause within the rules, then `sudo systemctl restart hateguard-api` and wait again.

### B9. Verify on the VM (agent)

```bash
cd /
curl -s http://127.0.0.1:8000/health | python3 -m json.tool

# Listens on loopback only: expected 127.0.0.1:8000, never 0.0.0.0 or *
sudo ss -ltn | grep ':8000 '

# Authentication is enforced: expected 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8000/predict \
  -H 'Content-Type: application/json' -d '{"text":"test","language":"igbo"}'

# CORS allows the study frontend: expected HTTP 200 and access-control-allow-origin: https://hateguard.vercel.app
curl -s -o /dev/null -D - -X OPTIONS http://127.0.0.1:8000/auth/login \
  -H "Origin: https://hateguard.vercel.app" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" | grep -iE "^HTTP|access-control-allow-origin"

# CORS rejects other origins: expected HTTP 400 and no allow-origin header
curl -s -o /dev/null -D - -X OPTIONS http://127.0.0.1:8000/auth/login \
  -H "Origin: https://example.com" -H "Access-Control-Request-Method: POST" | grep -iE "^HTTP|access-control-allow-origin"
```

The `/health` output must show all of the following:
- `"status": "ok"`
- `"device": "cpu"`
- `"models"` containing `igbo`, `yoruba` and `joint` with the three IDs from B7
- `"model_set": "original"`
- `"use_openai_moderation": false`

If moderation is `true`, stop the API (`sudo systemctl stop hateguard-api`) and fix it.

### B10. Public HTTPS with Caddy (agent)

Caddy gets a free certificate from Let's Encrypt and renews it by itself. It needs port 80 open (A4) and `API_HOST` pointing at this VM (A5).

```bash
set -euo pipefail
cd /
API_HOST=<subdomain>.duckdns.org
getent ahostsv4 "$API_HOST" | head -1    # must show the static IP from A4
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
# HateGuard API: public HTTPS for the thesis study. Caddy gets and renews the certificate itself.
$API_HOST {
	reverse_proxy 127.0.0.1:8000
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sleep 30
sudo journalctl -u caddy --since "-3min" --no-pager | grep -iE "certificate obtained|error" || true
sudo ss -ltn | grep -E ':(80|443)\s'
```

Expected: a line containing `certificate obtained successfully`, and listeners on ports 80 and 443.

If the journal shows an error instead, check that `dig +short "$API_HOST"` on the Mac prints the static IP and that the firewall rule from A4 exists. Then run `sudo systemctl reload caddy` once more. If it still fails, stop and ask.

Caddy adds no CORS headers. The API sets them.

### B11. Researcher creates their dashboard account (researcher runs this)

**Researcher**, in your own SSH session. It asks for a password, which must not pass through the agent:

```bash
cd /
sudo -u hateguard -H bash -c 'cd /opt/hateguard/app/backend_api_server && /opt/hateguard/venv/bin/python scripts/create_user.py --email <ADMIN_EMAIL> --name "<full name>" --org "HateGuard Research Team"'
```

The script reads `.env`, so the account goes into the deployment database. Don't add `--key-name`; an API key isn't needed.

**Agent**: check that the account exists. This prints emails only:

```bash
cd /
sudo -u hateguard /opt/hateguard/venv/bin/python -c "import sqlite3; print(sqlite3.connect('/opt/hateguard/data/dashboard.db').execute('select email from users').fetchall())"
```

Expected: exactly one row, the researcher's email.

### B12. Deployment record (plan M6)

Write `/opt/hateguard/DEPLOYMENT_RECORD.md` as the `hateguard` user (for example with `sudo -u hateguard tee`). Include no secrets.
- Date (UTC); project ID, zone, machine type and static IP; the free-trial end date from A1.
- Git commit (full SHA and subject); the commit Vercel was built from (`e9c8878` at the time of writing).
- Python, torch, transformers, numpy and Caddy versions.
- `HF_MODEL_SET`, the three model IDs and their revision SHAs (from B6).
- `CORS_ORIGINS`, `USE_OPEN_AI_MODERATION_API=false`, `DASHBOARD_DB_PATH`.
- Public API URL: `https://<API_HOST>`, once Part C passes.

### B13. Report to the researcher

Report:
- the B9 check results;
- `API_HOST` and the Caddy certificate line from B10;
- the B11 account check.

---

## Part C. Verify the public HTTPS URL (agent, Mac)

Use the URL **without a trailing slash**:

```bash
API_URL=https://$API_HOST
curl -sS -o /dev/null -w "HTTP %{http_code} | TLS verify %{ssl_verify_result}\n" "$API_URL/health"
curl -sS "$API_URL/health" | python3 -m json.tool
curl -s -o /dev/null -D - -X OPTIONS "$API_URL/auth/login" \
  -H "Origin: https://hateguard.vercel.app" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" | grep -iE "^HTTP|access-control-allow-origin"
```

Expected:
- `HTTP 200 | TLS verify 0`;
- the same `/health` JSON as in B9;
- exactly **one** `access-control-allow-origin: https://hateguard.vercel.app` line.

Add `API_URL` to `DEPLOYMENT_RECORD.md`.

---

## Part D. Point the Vercel frontend at the API (Mac, Vercel CLI logged in)

The value is built into the JavaScript at build time, so changing it needs a rebuild. Set it for **Production** only. Preview deployments use other domains, which `CORS_ORIGINS` does not allow.

```bash
API_URL=https://$API_HOST     # exact URL from Part C, no trailing slash
curl -sS "$API_URL/health"

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
2. Sign in with the account from B11.
3. DevTools, Network tab: API requests go to `API_URL` directly, not to `hateguard.vercel.app`.
4. Classify Posts: classify one Igbo sentence. A label and confidence come back. On the VM, `sudo journalctl -u hateguard-api -n 5 --no-pager` shows `POST /predict` with status 200.
5. Performance: the metrics load for Igbo and Yoruba.
6. Reload the browser on `/explainability`. The page loads, with no 404.
7. Explainability: explain one sentence, and note how long each method takes. On CPU, a method on new text may pass the dashboard's 25 s limit and show an error. That is expected, and it is why M3 must be done before the first session.

---

## Part F. Operations, costs and teardown

| Task | Where | Command |
|---|---|---|
| Status | Mac | `curl -s https://$API_HOST/health` |
| Status | VM | `systemctl is-active hateguard-api caddy && curl -s http://127.0.0.1:8000/health` |
| Logs | VM | `sudo journalctl -u hateguard-api -n 100 --no-pager` (Caddy: `-u caddy`) |
| Restart the API | VM | `sudo systemctl restart hateguard-api`, then repeat the B8 wait loop and B9 (needed after any `.env` change) |
| Stop the VM | Mac | `gcloud compute instances stop "$VM" --project "$PROJECT" --zone "$ZONE"` |
| Start the VM | Mac | `gcloud compute instances start "$VM" --project "$PROJECT" --zone "$ZONE"`, wait about 2 minutes, then check Status (Mac) |

After the VM starts, both services start by themselves, and the models load from the local cache in about a minute. Before each study session, check Status from the Mac.

**Costs.** The credit pays for everything here; nothing is charged to the card while the account is a free trial. Prices are approximate:
- VM running: about US$0.15 per hour (about $3.50 a day).
- VM stopped: about $0.40 a day, for the disk and the reserved IP.
- Left running all the time, the US$300 credit lasts about 80 days, which is less than the 90-day trial. **Stop the VM on days without sessions.**
- Check the remaining credit weekly in the console: **Billing → Overview**.
- When the trial ends, or the credit runs out, Google stops the VM and later deletes its data unless the account is upgraded. Download the backups before then.

**Back up the study database** before and after each session day. On the VM:

```bash
cd /
sudo -u hateguard /opt/hateguard/venv/bin/python - <<'EOF'
import datetime, sqlite3
src = "/opt/hateguard/data/dashboard.db"
dst = "/opt/hateguard/backups/backup-" + datetime.datetime.now().strftime("%Y%m%d-%H%M") + ".db"
with sqlite3.connect(dst) as out:
    sqlite3.connect(src).backup(out)
print(dst)
EOF
```

Then copy the newest backup to the Mac and check it:

```bash
mkdir -p ~/hateguard-backups
NAME=$(gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --command 'sudo ls -1t /opt/hateguard/backups | head -1')
gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --command "sudo cat /opt/hateguard/backups/$NAME" > ~/hateguard-backups/"$NAME"
python3 -c "import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute('pragma integrity_check').fetchone())" ~/hateguard-backups/"$NAME"
```

Expected: `('ok',)`. `~/hateguard-backups/` is outside the repository; never commit a backup.

**Update to a new commit.** Only on the researcher's instruction, and not between participants without recording it. The Vercel frontend must be rebuilt from the same commit. On the VM:

```bash
cd /
sudo -u hateguard -H bash -s <<'EOF'
set -euo pipefail
cd /opt/hateguard/app
OLD=$(git rev-parse HEAD)
git fetch origin && git checkout --detach <commit or origin/master>
git diff --stat "$OLD" HEAD -- backend_api_server/requirements.txt backend_api_server/requirements-explain.txt
EOF
```

If the requirements changed, rerun the second `pip install` line of B5 (inside the venv, with the constraints file). Then restart the API and run B9. Update `DEPLOYMENT_RECORD.md` (old SHA, new SHA, date).

**Roll back:** check out the previous SHA from the record the same way, then restart the API and run B9.

**Move to another host** (for example the lab server, once it has HTTPS):
1. Stop the API (`sudo systemctl stop hateguard-api`), make a backup and copy it to the Mac.
2. On the new host, deploy the same commit. Put the backup at the new `DASHBOARD_DB_PATH` before the API's first start. The researcher's account is already in it, so skip the account-creation step there.
3. Run Part D with the new URL. Then stop this VM.

**After the study:**
1. Make a final backup, copy it to the Mac and check it.
2. Remove `VITE_API_BASE_URL` from Vercel.
3. Only when the researcher says so, delete the whole project. This is permanent and removes the VM, its disk, the IP and the firewall rule:
   ```bash
   gcloud projects delete "$PROJECT"
   ```
4. The researcher deletes the subdomain on duckdns.org.
5. Keep the backups as the REB protocol requires. That is the researcher's decision.

---

## Out of scope (separate tasks, not part of this runbook)

- **Pre-computing explanations and measuring latency** (plan M3/B5). **Required before the first session on this CPU-only VM.** Warm the cache for every study post, and for the sentence and file used in task T8. Then check the per-method latency against the dashboard's 25 s request limit. The cache is shared by all users, so one run covers every participant.
- **Per-participant organizations and seeding** (plan M4/M7): one organization and account per participant, seeded within one hour before their session. This needs its own script; never `seed_demo_data.py`.
- **An alert for task T9** (plan M5): classify a prepared batch within one hour before the session.
