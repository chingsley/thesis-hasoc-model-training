# Deploy the HateGuard backend on an Azure for Students VM and connect the Vercel frontend

Written 2026-10-30. This runbook is for a coding agent on the **researcher's Mac**, and for the researcher. It puts the backend on an Azure virtual machine (VM) paid for by the Azure for Students credit (US$100, no card). Some steps are for the researcher, and some run on the VM over SSH. Every step says who runs it.

Use this when the lab server is not available. There are three runbooks; deploy to one host at a time:
- lab server: [deploy-backend-server-and-connect-vercel-frontend.md](deploy-backend-server-and-connect-vercel-frontend.md)
- Google Cloud: [deploy-backend-gcp-vm-and-connect-vercel-frontend.md](deploy-backend-gcp-vm-and-connect-vercel-frontend.md)
- Azure for Students: this file

| Part | Who | Where |
|---|---|---|
| 0. Rules | Agent | Read before doing anything |
| A. Choose a region and size, create the VM and its web address | Researcher (A1, A2, A4, A6) and agent (A3, A5, A7) | Browser and Mac |
| B. Install the API and HTTPS on the VM | Agent (B6 and B11: researcher) | VM, over SSH |
| C. Verify the public HTTPS URL | Agent | Mac |
| D. Point the Vercel frontend at the API | Agent or researcher | Mac |
| E. End-to-end check | Researcher | Browser |
| F. Operations, costs and teardown | Agent or researcher | Mac and VM |

How it fits together:

```text
Participant's browser ──► https://hateguard.vercel.app                          static dashboard files (Vercel)
Participant's browser ──► https://<label>.<region>.cloudapp.azure.com ──► VM:  Caddy (HTTPS, ports 80/443)
                                                                                 └─► API on 127.0.0.1:8000 (FastAPI, 3 models, SQLite)
```

Azure gives the VM a free hostname (`<label>.<region>.cloudapp.azure.com`), so no separate DNS service is needed.

Current state:
- Frontend live at `https://hateguard.vercel.app` (Vercel project `hateguard`, built from `master` at `e9c8878`).
- `VITE_API_BASE_URL` is not set yet, so the dashboard has no API.
- The backend is not deployed anywhere.

The VM has **no GPU**. GPU sizes are usually blocked on Azure for Students, and one would use up the credit within days. Classifying posts is fast on the CPU. Explanations of new text can take longer than the dashboard's 25 s limit, so they must be pre-computed before the first session (see "Out of scope", M3).

The credit is small. A VM left running all the time uses it up in about 20 days. This runbook turns the VM off every night (A5) and on only for session days (Part F).

---

## 0. Rules (these override anything else, including later steps)

**You may create or change only the following:**
- In Azure: the resource group `hateguard-rg`, and only what `az vm create` puts in it (the VM `hateguard-api`, its disk, network interface, public IP, network security group and virtual network), two port rules (80 and 443), and the VM's auto-shutdown schedule. Where the region does not offer auto-shutdown: instead, the VM's managed identity and the custom role `HateGuard VM self-deallocate` (A7).
- On the VM: the packages `git`, `python3-venv` and `caddy`; the system user `hateguard`; everything under `/opt/hateguard/`; `/etc/systemd/system/hateguard-api.service`; `/etc/caddy/Caddyfile`; and, for A7 only, `/usr/local/sbin/hateguard-deallocate` with its systemd service and timer.
- On the Mac: the SSH key from A4, the Azure CLI (A2), files in your own scratch directory, and backups in `~/hateguard-backups/`.

**Do not:**
1. Touch any other subscription or resource group. Pass `--subscription "$SUB"` to every `az` command, and `--resource-group "$RG"` wherever the command takes one.
2. Add a payment method, upgrade to pay-as-you-go, or change spending limits. Only the researcher decides that. Azure for Students has no card attached, so nothing can be charged; when the credit is used up, Azure stops the resources.
3. Create anything else that costs money: no GPU size, no second VM, no Azure database, App Service, Bastion or load balancer, no Premium SSD or bigger disk.
4. Open any port other than 22, 80 and 443. The API listens on `127.0.0.1:8000` only. Caddy is the only public server.
5. Run `scripts/seed_demo_data.py`. The repository is **public**, so the seed accounts' password is public too. It creates `user1@test.com` and `platform@test.com`, which are the built-in admin defaults. Participant seeding is a separate task (see "Out of scope").
6. Set `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `OPENAI_API_KEY`, `HF_TOKEN` or `HF_HOME`, or set `USE_OPEN_AI_MODERATION_API` to anything except `false`. The study database is the SQLite file on the VM, and OpenAI Moderation would send text to OpenAI (plan M1).
7. Copy the researcher's Mac `backend_api_server/.env` to the VM. It contains settings that are wrong for the study, and secrets.
8. Commit or push, on the VM or on the Mac. The researcher makes all commits.
9. Use `sudo` on the VM for anything except the commands in this runbook.
10. Use `az vm stop`. A stopped VM is still billed; use `az vm deallocate` (Part F).

**Secrets:**
- Never read, print, log, copy or store a password, a Hugging Face token, an SSH private key or an API key.
- Never ask the researcher to paste one into the chat.
- When a secret is needed (B6 token, B11 password), the researcher types it into their own SSH terminal.
- If a command prints a secret by accident, do not repeat it. Tell the researcher, so they can revoke it.

**Stop and ask the researcher** when:
- a check's output differs from what this runbook expects;
- a step fails twice;
- the resource group `hateguard-rg` already exists;
- no region and size pass the A3 checks;
- an Azure command fails with `RequestDisallowedByPolicy` or a quota error;
- Caddy cannot get a certificate (B10).

Report the exact command and its output.

---

## Inputs from the researcher (ask for these before Part A)

| Input | Used in | Notes |
|---|---|---|
| `ADMIN_EMAIL`: the researcher's own login email for the dashboard | B7, B11 | Not a `@test.com` address |
| Commit to deploy | B4 | Default: current `origin/master`. Must match the commit the Vercel frontend was built from (plan M6: fixed git commit). |
| Study end date and session days | A1, F | The credit lasts 12 months, or until it is used up |
| Region preference | A3 | Default: `canadacentral` (Toronto) if the subscription allows it |

On the Mac, every command below assumes these variables. Set them again in every new shell:

```bash
export SUB=<subscription ID from A2>
export RG=hateguard-rg
export VM=hateguard-api
export LOCATION=<region from A3, e.g. canadacentral>
export SIZE=<VM size from A3, e.g. Standard_D4as_v5>
export SSH_KEY=$HOME/.ssh/hateguard_azure
export API_HOST=<hostname from A5>
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

### A1. Activate Azure for Students (researcher, browser)

1. Go to <https://azure.microsoft.com/free/students> and click **Start free**. Sign in, and verify with your Dalhousie email. No card is needed.
2. Check the credit and its end date with the credit command in Part F (after A2), or in the Azure portal under **Cost Management + Billing → Credits**. Write down the end date, and check that it is after the study end date. Don't use microsoftazuresponsorships.com: it doesn't show Azure for Students credit held under a Microsoft Customer Agreement, and says "no active Sponsorship".
3. Never upgrade the subscription or add a card.

### A2. Install and sign in to the Azure CLI (researcher, Mac)

```bash
brew install azure-cli
az config set core.login_experience_v2=off   # no interactive subscription picker, so an agent can run az login
az login     # opens the browser
az account list --query "[].{name:name, id:id, state:state}" -o tsv
```

Expected: a row named `Azure for Students` with state `Enabled`. Give its `id` to the agent as `SUB`. It is not a secret. (`-o table` hides the `id` column, so use `-o tsv`.)

If Homebrew fails (it builds OpenSSL from source and fails on an Intel Mac with the newest macOS), install the CLI with pip into its own venv instead, using any Python 3.10 or newer:

```bash
/usr/local/bin/python3 -m venv ~/.local/share/azure-cli-venv
~/.local/share/azure-cli-venv/bin/python -m pip install -q azure-cli
export PATH="$HOME/.local/share/azure-cli-venv/bin:$PATH"    # in every new shell
```

### A3. Choose the region and the VM size (agent, Mac)

Azure for Students allows only a few regions (often about five, different for each student), and some VM sizes may be blocked.

```bash
for ns in Microsoft.Compute Microsoft.Network Microsoft.DevTestLab; do
  az provider register --subscription "$SUB" --namespace "$ns" --wait
done
az policy assignment list --subscription "$SUB" \
  --query "[].{name:displayName, allowed:parameters.listOfAllowedLocations.value}" -o json
```

Choose `LOCATION`:
- `canadacentral` if it is in an `allowed` list;
- otherwise, the allowed region nearest to the participants (ask the researcher if unsure);
- if no assignment lists allowed locations, use `canadacentral`.

Then choose the size. It needs 4 vCPUs and 16 GiB of memory; the three models and the explanation methods use about 2–6 GB. A size is usable only if **both** of these hold:
- the region offers it to this subscription without a `Location` restriction (a `Zone` restriction is fine, because the VM is not pinned to a zone);
- its family has a quota of at least 4 vCPUs (Limit minus CurrentValue), and `Total Regional vCPUs` has at least 4 free.

First the quotas, which are quick:

```bash
az vm list-usage --subscription "$SUB" --location "$LOCATION" -o json | python3 -c '
import json, sys
for u in json.load(sys.stdin):
    lim, cur = int(u["limit"]), int(u["currentValue"])
    if lim > 0 and ("Family" in u["name"]["value"] or u["name"]["value"] == "cores"):
        print("%s: used %d of %d" % (u["localName"], cur, lim))'
```

Then the sizes the region offers. This takes about two minutes per region:

```bash
az vm list-skus --subscription "$SUB" --location "$LOCATION" --resource-type virtualMachines -o json | python3 -c '
import json, sys
for s in json.load(sys.stdin):
    caps = {c["name"]: c["value"] for c in s.get("capabilities", [])}
    if caps.get("vCPUs") == "4" and caps.get("MemoryGB") == "16":
        blocked = any(r.get("type") == "Location" for r in s.get("restrictions", []))
        print(s["name"], "BLOCKED" if blocked else "usable")' | sort
```

Choose `SIZE`: the first usable size, in this order, whose family has quota: `Standard_D4as_v4` (family DASv4), `Standard_D4s_v4` (DSv4), `Standard_D4as_v5` (DASv5), `Standard_D4s_v5` (DSv5), `Standard_B4as_v2` (Basv2), `Standard_B4ms` (BS). The B sizes are burstable. They are fine for short bursts, but they slow down under long, heavy work such as pre-computing explanations, so prefer the D sizes. If no size passes, repeat the checks with the next allowed region. If none passes anywhere, stop and ask.

On 2026-10-30, the researcher's subscription allowed `francecentral`, `swedencentral`, `mexicocentral`, `belgiumcentral` and `denmarkeast`. Every region had a quota of 4 vCPUs for the v4 D families and 0 for the v5 D families, and `francecentral` offered only v7 sizes. The deployment used `mexicocentral` with `Standard_D4as_v4`.

### A4. Create an SSH key (researcher, Mac, or the agent if the researcher agrees to no passphrase)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/hateguard_azure -C hateguard-azure
ssh-add --apple-use-keychain ~/.ssh/hateguard_azure     # only if you set a passphrase
```

The second command stores the passphrase in the macOS keychain, so the agent's commands don't stop to ask for it. Without a passphrase, the agent can create the key itself with `ssh-keygen -t ed25519 -f ~/.ssh/hateguard_azure -C hateguard-azure -N '' -q`.

### A5. Create the VM, open ports 80 and 443, set nightly shutdown (agent, Mac)

```bash
export DNS_LABEL=hateguard-$(openssl rand -hex 3)
az group create --subscription "$SUB" --name "$RG" --location "$LOCATION"

az vm create --subscription "$SUB" --resource-group "$RG" --name "$VM" --location "$LOCATION" \
  --image Canonical:ubuntu-24_04-lts:server:latest --size "$SIZE" \
  --admin-username azureuser --ssh-key-values "$SSH_KEY.pub" \
  --public-ip-sku Standard --public-ip-address-dns-name "$DNS_LABEL" \
  --os-disk-size-gb 64 --storage-sku StandardSSD_LRS \
  --nsg-rule SSH

az vm open-port --subscription "$SUB" --resource-group "$RG" --name "$VM" --port 80 --priority 1010
az vm open-port --subscription "$SUB" --resource-group "$RG" --name "$VM" --port 443 --priority 1020
az vm auto-shutdown --subscription "$SUB" --resource-group "$RG" --name "$VM" --time 0500

az vm show -d --subscription "$SUB" --resource-group "$RG" --name "$VM" \
  --query "{power:powerState, size:hardwareProfile.vmSize, ip:publicIps, fqdn:fqdns}" -o json
az network nsg rule list --subscription "$SUB" --resource-group "$RG" --nsg-name "${VM}NSG" \
  --query "[].{name:name, port:destinationPortRange, priority:priority, access:access}" -o table
```

Expected:
- `"power": "VM running"`, the chosen size, an IP, and `fqdn` equal to `<DNS_LABEL>.<LOCATION>.cloudapp.azure.com`.
- Exactly three inbound rules, all `Allow`: port 22 (from `--nsg-rule SSH`), 80 and 443.

Set `API_HOST` to the `fqdn` value in every shell from now on. Check it on the Mac. It must print the VM's IP:

```bash
dig +short "$API_HOST"
```

Notes:
- If `az vm create` rejects the Ed25519 key, the researcher creates an RSA key instead (`ssh-keygen -t rsa -b 4096 -f ~/.ssh/hateguard_azure_rsa`). Then set `SSH_KEY` to that path and rerun `az vm create`.
- `--time 0500` deallocates the VM every day at 05:00 UTC (1:00 or 2:00 a.m. in Halifax), so a VM left on by mistake costs at most one day. If a session would run past that time, change it with the same command.
- If `az vm auto-shutdown` fails with `LocationNotAvailableForResourceType` (as in `mexicocentral`), the region has no auto-shutdown. Set up the replacement in A7.
- The public IP is static, so the hostname stays the same after the VM is deallocated and started again.

### A6. First SSH login (researcher or agent, Mac)

```bash
ssh -i "$SSH_KEY" azureuser@"$API_HOST"
```

Answer `yes` to the host-key question, then type `exit`. An agent instead runs its first command with `-o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes`.

### A7. Nightly self-deallocate (agent; only if auto-shutdown failed in A5)

The VM gets a managed identity that may only read and deallocate itself. A systemd timer on the VM then asks Azure to deallocate it at 05:00 UTC. This is free, and nothing else gets this permission.

On the Mac:

```bash
cat > "<scratch dir>/role.json" <<EOF
{
  "Name": "HateGuard VM self-deallocate",
  "Description": "Lets the hateguard-api VM deallocate itself every night (cost safety net for the thesis study).",
  "Actions": ["Microsoft.Compute/virtualMachines/read", "Microsoft.Compute/virtualMachines/deallocate/action"],
  "NotActions": [], "DataActions": [], "NotDataActions": [],
  "AssignableScopes": ["/subscriptions/$SUB/resourceGroups/$RG"]
}
EOF
az role definition create --subscription "$SUB" --role-definition @"<scratch dir>/role.json"
PRINCIPAL=$(az vm identity assign --subscription "$SUB" -g "$RG" -n "$VM" --query systemAssignedIdentity -o tsv)
VM_ID=$(az vm show --subscription "$SUB" -g "$RG" -n "$VM" --query id -o tsv)
az role assignment create --subscription "$SUB" --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "HateGuard VM self-deallocate" --scope "$VM_ID"
```

If the assignment says the role does not exist, the new role is still propagating. Wait 20 seconds and retry.

On the VM (a Part B style block):

```bash
set -euo pipefail
cd /
sudo tee /usr/local/sbin/hateguard-deallocate >/dev/null <<'EOF'
#!/bin/sh
# Deallocates this VM (stops compute billing) with its managed identity. Run nightly by hateguard-deallocate.timer.
# Usage: hateguard-deallocate [--check]   (--check only reads the VM, to test the identity and role)
set -eu
imds="http://169.254.169.254/metadata"
rid=$(curl -sf -H Metadata:true "$imds/instance/compute/resourceId?api-version=2021-02-01&format=text")
token=$(curl -sf -H Metadata:true "$imds/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])')
if [ "${1:-}" = "--check" ]; then
  printf 'Authorization: Bearer %s\n' "$token" \
    | curl -sf -H @- "https://management.azure.com$rid?api-version=2024-07-01" \
    | python3 -c 'import json, sys; d = json.load(sys.stdin); print("identity OK, can read", d["name"])'
  exit 0
fi
echo "deallocating $rid"
printf 'Authorization: Bearer %s\n' "$token" \
  | curl -sf -X POST -H @- -H "Content-Length: 0" "https://management.azure.com$rid/deallocate?api-version=2024-07-01"
EOF
sudo chmod 750 /usr/local/sbin/hateguard-deallocate

sudo tee /etc/systemd/system/hateguard-deallocate.service >/dev/null <<'EOF'
[Unit]
Description=Deallocate this VM (HateGuard nightly cost safety net)

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/hateguard-deallocate
EOF

sudo tee /etc/systemd/system/hateguard-deallocate.timer >/dev/null <<'EOF'
[Unit]
Description=Deallocate this VM every night at 05:00 UTC

[Timer]
OnCalendar=*-*-* 05:00:00 UTC
Persistent=false

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now hateguard-deallocate.timer
systemctl list-timers hateguard-deallocate.timer --no-pager | head -3
sudo /usr/local/sbin/hateguard-deallocate --check
```

Expected: the next run at 05:00 UTC, and `identity OK, can read hateguard-api`. The identity can take a minute to work after A7's Mac part; retry `--check` if it fails at first. `Persistent=false` matters: when the VM starts after a missed 05:00, the timer does not deallocate it straight away.

### How to run the Part B blocks

Each block in Part B runs on the VM. Each block also stands alone: nothing carries over from one block to the next.
- **Researcher:** paste the block into an SSH session opened as in A6.
- **Agent on the Mac:** save the block to a file in your scratch directory, then run:
  ```bash
  ssh -i "$SSH_KEY" azureuser@"$API_HOST" 'bash -s' < <block file>
  ```
- Replace every `<...>` placeholder first.
- Blocks marked **researcher** need hidden input typed in a terminal. The agent must not run them.
- If SSH times out, the nightly shutdown has probably deallocated the VM. Start it (Part F) and wait two minutes.

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

Expected: `Ubuntu 24.04.x LTS`, `cpus 4`, about 15–16 GiB total memory, at least 50 GB free on `/`, and `ports 80, 443 and 8000 are free`.

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

The API runs as its own unprivileged user, never as root or as `azureuser`.

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

Expected: `constraints.txt` holds a torch version ending in `+cpu`; the import check passes, with numpy 1.26.x and `cuda available False`. `threads` is the number of physical cores: 2 on `Standard_D4as_v4`, whose 4 vCPUs are 2 cores with hyper-threading. A `Failed to initialize NumPy` warning from the `constraints.txt` line is harmless, because numpy is installed after it.

If an install or import fails, make one fix attempt **inside the venv**, for example by installing the compatible version pip suggests. If it still fails, stop and report the full error.

### B6. Hugging Face access

The three model repositories are **private**, so the API needs a read token.

**Researcher**, in your own SSH session (A6):

```bash
cd /
sudo -u hateguard -H /opt/hateguard/venv/bin/hf auth login
```

- Paste a **read-only** token. Best: a fine-grained token that can read only the six model repositories: the three `chingsley/afro-xlmr-*-hate` repositories (original) and the three `chingsley/afro-xlmr-*-hate-v2-merged` repositories (merged, needed only for Settings → Model set). The input is hidden.
- An existing fine-grained token can be extended instead of replaced: on huggingface.co, Settings → Access Tokens → the token's **Edit permissions** → add the merged repositories → Save. The VM picks this up at the next download; no new login is needed.
- Answer `n` to "Add token as git credential?".
- If `hf` is not found, run `sudo -u hateguard -H /opt/hateguard/venv/bin/huggingface-cli login` instead.

The token is saved in `/opt/hateguard/.cache/huggingface/token`. `hf` creates it with mode 664; the agent tightens it to 600 below.

An agent can open a Terminal window for the researcher with the login already running. Write a small script in the scratch directory, run `ssh -t -i "$SSH_KEY" -o IdentitiesOnly=yes azureuser@"$API_HOST" "cd / && sudo -u hateguard -H /opt/hateguard/venv/bin/hf auth login"`, and open it with `osascript -e 'tell application "Terminal" to do script "bash <script>"'`. Do the same for B11.

**Agent**: tighten the token file and check access. This does not print the token.

```bash
cd /
sudo -u hateguard chmod 600 /opt/hateguard/.cache/huggingface/token
sudo -u hateguard -H /opt/hateguard/venv/bin/python - <<'EOF'
from huggingface_hub import model_info
for repo in ("chingsley/afro-xlmr-igbo-hate",
             "chingsley/afro-xlmr-yoruba-hate",
             "chingsley/afro-xlmr-joint-igbo-yoruba-hate",
             "chingsley/afro-xlmr-igbo-hate-v2-merged",
             "chingsley/afro-xlmr-yoruba-hate-v2-merged",
             "chingsley/afro-xlmr-joint-igbo-yoruba-hate-v2-merged"):
    try:
        info = model_info(repo)
        print(repo, info.sha, "private" if info.private else "public")
    except Exception as exc:
        print(repo, "NO ACCESS:", type(exc).__name__)
EOF
```

Expected: six lines, each with a revision SHA and `private`. Keep the SHAs for the record (B12). If the three original repositories show `NO ACCESS`, the login did not work; ask the researcher to repeat it. If only the three merged ones do, the API still works, but Settings → Model set cannot switch to merged until the researcher adds them to the token.

### B7. Deployment config (agent)

Replace the email first:

```bash
set -euo pipefail
cd /
ADMIN_EMAIL=<researcher's email>
sudo -u hateguard bash -c 'umask 077 && cat > /opt/hateguard/app/backend_api_server/.env' <<EOF
# HateGuard study deployment on an Azure VM. Git-ignored. Do not commit.
INFERENCE_DEVICE=cpu

HF_MODEL_SET=original
HF_MODEL_ID_IGBO=chingsley/afro-xlmr-igbo-hate
HF_MODEL_ID_YORUBA=chingsley/afro-xlmr-yoruba-hate
HF_MODEL_ID_JOINT=chingsley/afro-xlmr-joint-igbo-yoruba-hate
# Merged-dataset models: loaded only when a platform admin switches in Settings → Model set.
HF_MODEL_ID_IGBO_MERGED=chingsley/afro-xlmr-igbo-hate-v2-merged
HF_MODEL_ID_YORUBA_MERGED=chingsley/afro-xlmr-yoruba-hate-v2-merged
HF_MODEL_ID_JOINT_MERGED=chingsley/afro-xlmr-joint-igbo-yoruba-hate-v2-merged
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
- `HF_MODEL_SET` is only the default. A platform admin can switch between original and merged in Settings → Model set without editing this file. That choice is saved in the database and wins over `HF_MODEL_SET` until it is changed again in Settings.
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

Caddy gets a free certificate from Let's Encrypt and renews it by itself. It needs port 80 open (A5) and `API_HOST` pointing at this VM.

```bash
set -euo pipefail
cd /
API_HOST=<fqdn from A5>
getent ahostsv4 "$API_HOST" | head -1    # must show the VM's public IP from A5
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

If the journal shows an error instead:
- Check that `dig +short "$API_HOST"` on the Mac prints the VM's IP, and that the port 80 rule from A5 exists. Then run `sudo systemctl reload caddy` once more.
- If the error mentions a rate limit for `cloudapp.azure.com`, ask the researcher to get a free DuckDNS name pointing at the VM's IP (as in A5 of the Google Cloud runbook). Put that name in the Caddyfile and in `API_HOST`, and reload.
- If it still fails, stop and ask.

Caddy adds no CORS headers. The API sets them.

### B11. Researcher creates their dashboard account (researcher runs this)

**Researcher**, in your own SSH session. It asks for a password, which must not pass through the agent:

```bash
cd /
sudo -u hateguard -H bash -c 'cd /opt/hateguard/app/backend_api_server && /opt/hateguard/venv/bin/python scripts/create_user.py --email <ADMIN_EMAIL> --name "<full name>" --org "HateGuard Research Team"'
```

The script reads `.env`, so the account goes into the deployment database. Don't add `--key-name`; an API key isn't needed. It asks for the password only once, without confirmation. If the login later fails with "Invalid email or password", set the password again with the reset tool in Part F.

**Agent**: check that the account exists. This prints emails only:

```bash
cd /
sudo -u hateguard /opt/hateguard/venv/bin/python -c "import sqlite3; print(sqlite3.connect('/opt/hateguard/data/dashboard.db').execute('select email from users').fetchall())"
```

Expected: exactly one row, the researcher's email.

### B12. Deployment record (plan M6)

Write `/opt/hateguard/DEPLOYMENT_RECORD.md` as the `hateguard` user (for example with `sudo -u hateguard tee`). Include no secrets.
- Date (UTC); subscription name, resource group, region, VM size, public IP and hostname; the credit end date from A1; the auto-shutdown time.
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
| Turn the VM off (stops compute billing) | Mac | `az vm deallocate --subscription "$SUB" --resource-group "$RG" --name "$VM"` |
| Turn the VM on | Mac | `az vm start --subscription "$SUB" --resource-group "$RG" --name "$VM"`, wait about 2 minutes, then check Status (Mac) |
| Power state | Mac | `az vm show -d --subscription "$SUB" --resource-group "$RG" --name "$VM" --query powerState -o tsv` |
| Change the nightly shutdown (A5 auto-shutdown) | Mac | `az vm auto-shutdown --subscription "$SUB" --resource-group "$RG" --name "$VM" --time <HHMM in UTC>` (`--off` removes it) |
| Change the nightly shutdown (A7 timer) | VM | Edit `OnCalendar=` in `/etc/systemd/system/hateguard-deallocate.timer`, then `sudo systemctl daemon-reload`. Pause it for a late session with `sudo systemctl stop hateguard-deallocate.timer`; it comes back at the next boot. |
| Switch original ⇄ merged models | Browser | Settings → Model set (platform admin only). No restart. The first switch to merged downloads about 3.3 GB into `/opt/hateguard/hf-cache` (several minutes); the current models keep serving until it finishes. Needs the `*_MERGED` lines in `.env` (B7) and token access to the merged repositories (B6). Keep it on original during the study. |

After the VM starts, both services start by themselves, and the models load from the local cache in about a minute.

**Reset a dashboard password.** The agent installs this tool once, on the VM:

```bash
set -euo pipefail
cd /
sudo -u hateguard bash -c 'umask 077 && cat > /opt/hateguard/set_password.py' <<'EOF'
"""Set a new password for an existing dashboard user (asks twice, hidden input).

Usage, on the VM:  sudo -u hateguard -H /opt/hateguard/venv/bin/python /opt/hateguard/set_password.py <email>
"""

import getpass
import sys

from dotenv import load_dotenv

BACKEND = "/opt/hateguard/app/backend_api_server"
sys.path.insert(0, BACKEND)
load_dotenv(f"{BACKEND}/.env")

from app import auth, db  # noqa: E402

email = sys.argv[1].strip().lower()
user = db.get_user_by_email(email)
if user is None:
    sys.exit(f"error: no user {email}")
password = getpass.getpass("New password: ")
if not password or password != getpass.getpass("Repeat password: "):
    sys.exit("error: the passwords are empty or do not match; nothing changed")
db.update_user_password(int(user["id"]), auth.hash_password(password))
print(f"Password updated for {email}")
EOF
```

The **researcher** then runs it in their own SSH session: `cd / && sudo -u hateguard -H /opt/hateguard/venv/bin/python /opt/hateguard/set_password.py <email>`.

**Each session day:** turn the VM on at least 15 minutes before the first session, then check Status from the Mac. Turn it off after the last session. The nightly shutdown is only a safety net.

**Costs.** The credit pays for everything here; nothing can be charged, because no card is attached. Prices are approximate and depend on the region and size:
- VM running: about US$0.17–0.20 per hour (about $4–5 a day).
- VM deallocated: about $0.30 a day, for the disk and the public IP.
- Left running all the time, the US$100 credit lasts about 20 days. Running it only on session days makes it last for the whole study.
- Check the remaining credit weekly (Mac). New charges can take a day or two to appear:
  ```bash
  BA=$(az billing account list --query "[0].name" -o tsv)
  BP=$(az rest --method get --url "https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BA/billingProfiles?api-version=2024-04-01" --query "value[0].name" -o tsv)
  az rest --method get --url "https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BA/billingProfiles/$BP/providers/Microsoft.Consumption/lots?api-version=2023-05-01" \
    --query "value[].{source:properties.source, original:properties.originalAmount.value, remaining:properties.closedBalance.value, expires:properties.expirationDate}" -o table
  ```
- When the credit runs out, or the 12 months end, Azure disables the subscription. The VM stops and cannot be started, and its data is deleted later. Download the backups before then.

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
NAME=$(ssh -i "$SSH_KEY" azureuser@"$API_HOST" 'sudo ls -1t /opt/hateguard/backups | head -1')
ssh -i "$SSH_KEY" azureuser@"$API_HOST" "sudo cat /opt/hateguard/backups/$NAME" > ~/hateguard-backups/"$NAME"
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
3. Run Part D with the new URL. Then deallocate this VM.

**After the study:**
1. Make a final backup, copy it to the Mac and check it.
2. Remove `VITE_API_BASE_URL` from Vercel.
3. Only when the researcher says so, delete the resource group. This is permanent and removes the VM, its disk, the IP, the network and the shutdown schedule:
   ```bash
   az group delete --subscription "$SUB" --name "$RG" --yes
   ```
4. Keep the backups as the REB protocol requires. That is the researcher's decision.

---

## Out of scope (separate tasks, not part of this runbook)

- **Pre-computing explanations and measuring latency** (plan M3/B5). **Required before the first session on this CPU-only VM.** Warm the cache for every study post, and for the sentence and file used in task T8. Then check the per-method latency against the dashboard's 25 s request limit. The cache is shared by all users, so one run covers every participant.
- **Per-participant organizations and seeding** (plan M4/M7): one organization and account per participant, seeded within one hour before their session. This needs its own script; never `seed_demo_data.py`.
- **An alert for task T9** (plan M5): classify a prepared batch within one hour before the session.
