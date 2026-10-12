# Review & Report module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/triage` · **Page:** `frontend_dashboard/src/pages/Triage.tsx`

The queue shows **your own** Hate/Abuse predictions in **three tabs**: **All** (every toxic post, **500** per page) · **Flagged** · **Relabelled**. Each tab shows its count.

## End-to-end flow (plain English)

Stats and paginated tables use `GET /predictions/triage/stats` and `GET /predictions/triage/posts?bucket=…` with your Bearer token. The backend reads `predictions` (your org, chosen language; Normal/Hate/Abuse) joined to `triage` (`o<org>_pred_<id>` keys, `status`, `flagged`). Relabel state lives on `predictions`: `predicted_label` is the saved label, `relabelled`, `initial_model_prediction`, `reviewer_user_id`, `reviewed_at`.

- **All** (`pending` bucket) — every queued prediction (paginated, 500 rows per page). Default triage status is `pending` (not flagged). **Flag** / **Unflag** and **Relabel**; flagged posts **stay in this table** and also appear under Flagged.
- **Flagged** — `status = flagged` (incident report list). **Unflag** sets `pending` and clears the flag bit; the post remains in Queue.
- **Relabelled** — `relabelled = true`. **Edit** opens the relabel sheet. Setting the label back to `initial_model_prediction` clears relabel state and removes the row from Relabelled.

There is **no Cleared bucket**. Non-flagged posts are simply `pending` in the database.

Summary cards: always the **full queue** (All bucket) — total plus Normal/Abusive/Hateful counts. **Prediction label** chips (All / Normal / Abuse / Hate) highlight the matching card and filter the table. **Bucket** tabs (All / Flagged / Relabelled) only change the post list; their counts follow the selected prediction label (e.g. Normal + All shows `pending.normal`, not the full-queue total). Summary strip counts stay on the full queue. Tab counts use `9999+` when over 9,999. Each label card shows **flagged** and **relabelled** subcounts for the full queue.

Actions: `POST /predictions/pred_N/flag`, `POST …/triage` (`{"status":"pending"|"flagged"}`), `POST …/relabel` (`label` plus optional `"bucket":"flagged"`).

Queue tables show **Prediction** (original model output, from `initial_model_prediction` when relabelled) and **Reviewer label** (current saved label when `relabelled`). Post text is truncated to 20 words; click the post (or **View/Relabel** / **Edit**) to open the same relabel side panel with **Correct label** and, on the All bucket, **Also flag for incident report**. Hate probability filter uses a dual-thumb range slider.

**Export CSV (N):** Downloads **all rows matching the current bucket, prediction label, search, date range, and hate-% filters** (not only the visible page). Client paginates `GET /predictions/triage/posts` in chunks of 500 until `total` is reached, then builds CSV with `id,tweet,model_prediction,reviewer_label,hate_probability,triage_status,flagged,reported_date`.

---

## Buckets (technical)

**Frontend:** `useTriagePostsPage` + `useTriageStats` (`client.ts`). React Query invalidates triage keys after flag/triage/relabel.

**Backend:** `db.org_triage_stats` / `db.org_triage_posts_page` — `pending` bucket SQL is all toxic rows (`1=1`); `flagged` and `relabelled` filter as before.

**Relabel sheet:** create mode = correct label + optional “Also flag”; edit mode = label only.

**Migration:** legacy `cleared` / `reviewed` triage statuses become `pending` at startup.
