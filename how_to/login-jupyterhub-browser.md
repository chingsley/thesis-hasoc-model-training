# Log in to the server via browser (JupyterHub)

Use this when you want **notebooks in the browser**, JupyterLab, or the **Terminal tab inside JupyterHub** — not when you want Cursor’s file explorer (see [open-project-remote-ssh.md](./open-project-remote-ssh.md)).

## URL

```
https://persuasive.research.cs.dal.ca:8000
```

After login, your workspace is typically:

```
https://persuasive.research.cs.dal.ca:8000/user/enejak/lab
```

## Credentials

- **Username:** `enejak` (your lab account)
- **Password:** the password provided by the lab / supervisor

## Chrome “Your connection is not private” (`NET::ERR_CERT_AUTHORITY_INVALID`)

The server uses HTTPS on port 8000. Chrome may show a certificate warning even when the cert is valid (proxy, antivirus HTTPS scanning, or cached state).

**Workarounds:**

1. Click **Advanced** → **Proceed to persuasive.research.cs.dal.ca (unsafe)**.
2. Try **Firefox** or another browser.
3. Confirm your Mac’s **date and time** are correct.
4. Temporarily disable **antivirus HTTPS scanning** if enabled.

From a terminal on your Mac, you can verify the host is reachable:

```bash
curl -sI https://persuasive.research.cs.dal.ca:8000/ | head -5
```

A response with `x-jupyterhub-version` means JupyterHub is running.

## What you get in JupyterHub

- **Notebooks** — open `notebooks/finetune_from_config.ipynb` or `full_modeling_pipeline.ipynb`
- **Terminal** — same shell as SSH, but inside the browser
- **File browser** — browse files in the Jupyter UI (not the same as Cursor’s explorer)

Shared Python packages (`torch`, etc.) are already available in JupyterHub; you do **not** need `source /usr/local/env/bin/activate` in JupyterHub (only when using plain SSH in some setups).

## Project path

In JupyterHub terminal or file browser, your training project is:

```bash
cd ~/thesis-hasoc-model-training
# same as: /home/enejak/thesis-hasoc-model-training
```

Activate the project venv when running scripts:

```bash
source kc_train_venv/bin/activate
```

## When to use browser vs SSH vs Remote SSH

| Goal | Use |
|------|-----|
| Run Jupyter notebooks | Browser (this guide) |
| Quick terminal commands | SSH ([login-ssh-terminal.md](./login-ssh-terminal.md)) or JupyterHub Terminal |
| Edit code in Cursor sidebar | [open-project-remote-ssh.md](./open-project-remote-ssh.md) |
