# Triage Queue module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/triage` · **Page:** `frontend_dashboard/src/pages/Triage.tsx`

The queue shows **your own** Hate/Abuse predictions in **three tabs**: **All** (every toxic post, **500** per page) · **Flagged** · **Relabelled**. Each tab shows its count.

## End-to-end flow (plain English)

Stats and paginated tables use `GET /predictions/triage/stats` and `GET /predictions/triage/posts?bucket=…` with your Bearer token. The backend reads SQLite `predictions` (your org, chosen language, Hate/Abuse only) joined to `triage` (`o<org>_pred_<id>` keys, `manual_label`, `status`, `flagged`).

- **All** (`pending` bucket) — every Hate/Abuse prediction (paginated, 500 rows per page). Default triage status is `pending` (not flagged). **Flag** / **Unflag** and **Relabel**; flagged posts **stay in this table** and also appear under Flagged.
- **Flagged** — `status = flagged` (incident report list). **Unflag** sets `pending` and clears the flag bit; the post remains in Queue.
- **Relabelled** — `manual_label` differs from `predicted_label`. **Edit** opens the relabel sheet. Matching the model label removes the row from Relabelled only.

There is **no Cleared bucket**. Non-flagged posts are simply `pending` in the database.

Summary cards: tab total plus Abusive/Hateful counts for the **active tab**. Abuse/Hate cards also show **flagged**, **relabelled**, and **others** (mutually exclusive segments that sum to the main count).

Actions: `POST /predictions/pred_N/flag`, `POST …/triage` (`{"status":"pending"|"flagged"}`), `POST …/relabel` (`manual_label` plus optional `"bucket":"flagged"`).

---

## Buckets (technical)

**Frontend:** `useTriagePostsPage` + `useTriageStats` (`client.ts`). React Query invalidates triage keys after flag/triage/relabel.

**Backend:** `db.org_triage_stats` / `db.org_triage_posts_page` — `pending` bucket SQL is all toxic rows (`1=1`); `flagged` and `relabelled` filter as before.

**Relabel sheet:** create mode = correct label + optional “Also flag”; edit mode = label only.

**Migration:** legacy `cleared` / `reviewed` triage statuses become `pending` at startup.
