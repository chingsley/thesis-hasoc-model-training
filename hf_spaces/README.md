# Hugging Face Spaces

This folder contains a **Gradio Space** for paste-and-test classification in the browser.

The Space is **not** part of your thesis repo on the server — it is deployed to a **separate Hugging Face Space repository** (like a mini website hosted by HF).

Source lives here:

```text
hf_spaces/hate-speech-tester/
  app.py              ← Gradio UI + inference
  requirements.txt    ← Python deps for the Space
  README.md           ← Space config (HF reads the YAML frontmatter)
```

---

## Hugging Face Spaces and PRO

**Gradio Spaces on Hugging Face now require a [PRO subscription](https://huggingface.co/pro)** to create/host (402 Payment Required). Model repos (weights) are still free.

| Option | Cost | Paste-and-test UI |
|--------|------|-------------------|
| HF Gradio Space | PRO (~$9/mo) | Yes, in browser |
| **Run Gradio on server** | Free | Yes, via SSH tunnel |
| Your dashboard `/testing` | Free | Yes, already built |
| Python `pipeline()` in terminal | Free | No UI |

### Free alternative — run Gradio on the server

```bash
cd ~/thesis-hasoc-model-training
export HF_TOKEN=hf_...
bash hf_spaces/run_local.sh
```

On your **laptop** (new terminal), forward the port:

```bash
ssh -L 7860:localhost:7860 enejak@<server-host>
```

Open in your laptop browser: **http://localhost:7860**

---

## Deploy to Hugging Face (requires PRO or existing Space)

You are on the server via **SSH** — you do **not** need to download files to your laptop.
The files are already at `~/thesis-hasoc-model-training/hf_spaces/hate-speech-tester/`.

### Option A — One command from the server (easiest)

```bash
cd ~/thesis-hasoc-model-training
source kc_train_venv/bin/activate
export HF_TOKEN=hf_...   # your token

python hf_spaces/deploy_space.py --private
```

Then open this URL in a browser **on your laptop** (type it manually — don't click links in Cursor SSH):

`https://huggingface.co/spaces/chingsley/hate-speech-tester`

Add **Settings → Repository secrets → `HF_TOKEN`** if your models are private. Wait for the build, then open the **App** tab.

### Option B — Git push from the server

```bash
cd ~/thesis-hasoc-model-training/hf_spaces/hate-speech-tester
git init
git remote add origin https://huggingface.co/spaces/chingsley/hate-speech-tester
git add app.py requirements.txt README.md
git commit -m "Add hate speech tester"
git push
# Username: chingsley   Password: your HF token (not account password)
```

### Option C — Upload via HF website (from your laptop browser)

1. On your **local** machine, open https://huggingface.co/new-space and create the Space.
2. In **Cursor** (SSH), open the files in the left sidebar:
   `hf_spaces/hate-speech-tester/app.py` (and the other two).
3. On HF Space → **Files** → **Create new file** → paste each file's contents → Save.

### Option D — Copy files to laptop, then drag-drop upload

Only if you prefer the web UI file picker:

```bash
# Run on YOUR LAPTOP (not the server), in a local terminal:
scp -r enejak@<server-host>:~/thesis-hasoc-model-training/hf_spaces/hate-speech-tester ~/Downloads/
```

Then upload from `~/Downloads/hate-speech-tester/` via the HF Files tab.

---

### Step 1 — Create the Space on the website (if not using deploy_space.py)

1. Open **https://huggingface.co/new-space**
2. **Owner:** `chingsley`
3. **Space name:** `hate-speech-tester` (or any name you like)
4. **SDK:** Gradio
5. **Visibility:** Private (recommended — models are private)
6. Click **Create Space**

You now have an empty Space repo, e.g.  
`https://huggingface.co/spaces/chingsley/hate-speech-tester`

### Step 2 — Upload the three files

On the Space page, open the **Files** tab (not Model card).

Click **Add file → Upload files** and upload from your project:

| Local file | Upload as |
|------------|-----------|
| `hf_spaces/hate-speech-tester/app.py` | `app.py` (repo root) |
| `hf_spaces/hate-speech-tester/requirements.txt` | `requirements.txt` (repo root) |
| `hf_spaces/hate-speech-tester/README.md` | `README.md` (repo root) |

All three go in the **root** of the Space repo (same level as each other, not in a subfolder).

HF will detect `app.py` and start building automatically.

### Step 3 — Add secret for private models

1. On the Space page: **Settings** (gear icon)
2. **Repository secrets**
3. Add:
   - **Name:** `HF_TOKEN`
   - **Value:** your HF token (read access to private models)

Save. Go to **App** tab — after the build finishes (~2–5 min), you get a text box and **Submit**.

---

## Deploy via git (alternative)

```bash
cd ~/thesis-hasoc-model-training/hf_spaces/hate-speech-tester

git init
git remote add origin https://huggingface.co/spaces/chingsley/hate-speech-tester
git add app.py requirements.txt README.md
git commit -m "Add hate speech tester Space"
git push
```

Use a [HF git credential](https://huggingface.co/settings/tokens) when prompted.

---

## Where this is NOT

| Location | Purpose |
|----------|---------|
| `backend_api_server/` | Your FastAPI inference API |
| `model_training/` | Training code |
| Model repo `chingsley/afro-xlmr-igbo-hate` | Weights only — no Gradio here |
| `huggingface.co/tasks/text-classification` | Generic HF demo — not your models |

---

## Test locally before uploading (optional)

```bash
cd ~/thesis-hasoc-model-training/hf_spaces/hate-speech-tester
source ../../kc_train_venv/bin/activate
pip install gradio
export HF_TOKEN=hf_...
python app.py
```

Opens a local URL with the same UI.
