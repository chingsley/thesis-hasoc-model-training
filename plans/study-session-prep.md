# Study session prep

Checklist for usability-study session days on the Azure deployment. Claude can run every command here except the password step.

- Posts, timestamps and the reasoning behind the answer key: [usability-seed-content.md](usability-seed-content.md)
- VM setup and operations: [deploy-backend-azure-vm-and-connect-vercel-frontend.md](deploy-backend-azure-vm-and-connect-vercel-frontend.md)

## Fixed values

| Item | Value |
|---|---|
| Dashboard | https://hateguard.vercel.app |
| API | https://hateguard-d7bcc6.mexicocentral.cloudapp.azure.com |
| Study organization | HateGuard Study Forum |
| Model set | Original. Never switch to Merged during the study: the seed posts were checked against Original only. |
| VM start command | `backend_api_server/azure-deployment/start_vm.txt` (gitignored) |
| VM auto-deallocation | Every night at 05:00 UTC: 01:00 Halifax in winter, 02:00 in summer |
| Backups | On the VM in `/opt/hateguard/backups/`; on the Mac in `~/hateguard-backups/` |

Shell helper on the Mac. Paste it once per terminal; the commands below use it.

```bash
vm() { ssh -i ~/.ssh/hateguard_azure -o IdentitiesOnly=yes azureuser@hateguard-d7bcc6.mexicocentral.cloudapp.azure.com "$@"; }
```

## Once, before the first session

1. **Create the participant accounts.** Sign in as platform admin, then go to Settings → Team invites. Set Organization to HateGuard Study Forum, enter the email and send the invite. Copy the temporary password; it is shown only once.
2. **Set each account's password.** In a private window, sign in once with each new account and change its password to the one the participant will use. The dashboard forces this change at first sign-in, so doing it in advance keeps T1 a plain sign-in. Don't use `Password123@`.
3. **Choose the T8 sentence and file.** Avoid content the model labels Hate with P ≥ 0.9: it creates a newer alert, which changes the T9 answer. Send the content to Claude to pre-compute its explanations; this is not done yet.
4. **Decision task.** Its posts must not include any of the 30 seed posts (seed content, section 7).
5. **`user1@test.com`** is not used. Its password is random, so it cannot sign in. To use it anyway, run the password command below in your own terminal; it asks for the password twice and rejects `Password123@`.

   ```bash
   ssh -t -i ~/.ssh/hateguard_azure -o IdentitiesOnly=yes azureuser@hateguard-d7bcc6.mexicocentral.cloudapp.azure.com \
     "cd / && sudo -u hateguard -H bash -c 'cd /opt/hateguard/app/backend_api_server && /opt/hateguard/venv/bin/python scripts/seed_study_org.py --set-password'"
   ```

## Session day

1. **Start the VM** with the command in `start_vm.txt`.
2. **Check the API.** About 2 minutes after the start, run:

   ```bash
   curl -s https://hateguard-d7bcc6.mexicocentral.cloudapp.azure.com/health
   ```

   The response must show `"status":"ok"`, `"model_set":"original"` and `"use_openai_moderation":false`.

3. **Before each participant**, run steps a and b, between 10:00 and 19:00 Halifax time on the session day.

   a. **Back up the database.** The reset deletes the previous participant's flags, relabels, T8 uploads and alerts, so back up first.

   ```bash
   NAME=backup-$(date -u +%Y%m%d-%H%M).db
   vm "cd / && sudo -u hateguard /opt/hateguard/venv/bin/python -c 'import sqlite3; sqlite3.connect(\"/opt/hateguard/data/dashboard.db\").backup(sqlite3.connect(\"/opt/hateguard/backups/$NAME\"))'"
   vm "sudo cat /opt/hateguard/backups/$NAME" > ~/hateguard-backups/$NAME
   python3 -c "import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute('pragma integrity_check').fetchone())" ~/hateguard-backups/$NAME
   ```

   The last command must print `('ok',)`.

   b. **Reset the study organization.** Use `--language igbo` or `--language yoruba`, the participant's session language.

   ```bash
   vm "cd / && sudo -u hateguard -H bash -c 'cd /opt/hateguard/app/backend_api_server && /opt/hateguard/venv/bin/python scripts/seed_study_org.py --reset --language igbo'"
   ```

   The reset takes about 1 minute. Its output must include:
   - `All 30 posts match the plan's labels and P(Hate) bounds.`
   - `Inserted 30 posts; igbo is the session language`
   - exactly one `alert: hate_threshold ...` line
   - `All explanations are cached.`

   The reset keeps every account and password. Posts stay in their range tabs for at least 17 hours.

4. **Give each participant a fresh private browser window.** A normal window remembers the last range tab and the Custom dates (localStorage key `hateguard-volume-selection`).

## Answer key (per session language, right after the reset)

Read the final answer from the dashboard at task time.

| Range tab | Normal | Abuse | Hate |
|---|---|---|---|
| 24h | 1 | 1 | 1 |
| 7d | 2 | 2 | 2 |
| 1m | 4 | 4 | 3 |
| 3m | 4 | 5 | 4 |
| All | 5 | 5 | 5 |
| Custom (opens on the last 7 days) | 2 | 2 | 2 |

- **T2:** 2 Hate posts in the last 7 days, out of 6 posts in total. The busiest day in the last month is 9 days ago, with 4 posts; the next is today, with 3.
- **T3:** every Hate post has P(Hate) ≥ 0.99 and every other post has P(Hate) ≤ 0.01. The number of posts with P(Hate) ≥ 70% in a range therefore equals the number of Hate posts in it.
- **T7:** rose. The "Hate Δ window" is about +33 points.
- **T9:** one "High-confidence hate detected (100%)" alert. In Igbo it is `test_igbo_00350` ("@username ndi ofe mmanu can never be trusted.."). In Yoruba it is `dev_yoruba_00581` ("Oloriburuku Omo IPOB. Go back to your land."). If a T8 input was labelled Hate with P ≥ 0.9, a newer alert comes first.

## After the last session of the day

1. Back up the database (step 3a).
2. Deallocate the VM, or let the 05:00 UTC timer do it. Use the `start_vm.txt` command with `deallocate` instead of `start`. Never use `az vm stop`: a stopped VM is still billed.

## Rules

- Never run `seed_demo_data.py` on the VM.
- Never use `Password123@` or the shared test login.
- Survey, questionnaire and interview answers stay in Canada. Never put them on the VM, on Vercel or in any non-Canadian service.
- OpenAI Moderation stays off. `/health` must show `"use_openai_moderation":false`.

## If something fails

| Symptom | Action |
|---|---|
| `/health` doesn't answer 3 minutes after the start | `vm "sudo systemctl restart hateguard-api"`, wait 1 minute, check again. For logs: `vm "sudo journalctl -u hateguard-api -n 50 --no-pager"` |
| Reset prints `would be ... admin` | The VM's `.env` admin email lists changed. Restore them before resetting. |
| Reset prints `no longer match the plan` | Nothing was written. Check that Settings → Model set shows Original. |
| A seed post's explanation takes over 25 s | Run the reset again. It recomputes any missing explanations; all 120 take about 20 minutes. |
