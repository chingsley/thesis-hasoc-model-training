# Triage Queue module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/triage` · **Page:** `frontend_dashboard/src/pages/Triage.tsx`

The queue shows **your own** Hate/Abuse predictions (from Testing Tools / API calls), sorted into **four bucket tabs**: Pending · Cleared · Flagged · Relabelled. Each tab label shows its count.

## End-to-end flow (plain English)

Opening the page sends `GET /predictions?language=<selected>&label=Hate,Abuse` with your
`Authorization: Bearer` token (no body). The backend checks the token, then reads the SQLite
`predictions` table — your rows only, chosen language, Hate/Abuse machine labels, newest first
(up to 500 matches; the label filter runs in SQL, so older toxic posts are not cut off). Each
row is joined with your triage state (per-user `u<you>_pred_<id>` keys in the `triage` table,
which also stores your `manual_label` when you relabel) and returned as post objects.

The four tabs filter that list in the browser. Each tab's table has a left-aligned title
(**Pending Reviews** / **Cleared Posts** / **Flagged Posts** / **Relabelled Posts**), three
summary cards (filtered total, Abusive, Hateful — same style as Export Report), and the same
filter row as the Export Report tab: search-with-icon (text or post id, left), **Start Date**,
**End Date** (processing date, empty = unbounded), **Hate Probability range** (Min–Max % ÷ 100
vs `probabilities.hate`), and the **All / Hate / Abuse** label pills (right end, counts computed
before filtering) — all client-side, each bucket table keeping its own filter state.
Every table also has an **Export CSV (N rows)** button below it: generates the CSV client-side
from exactly the displayed (filtered) rows — columns `id,tweet,label,predicted_label,
hate_probability,flagged,manual_label,reported_date` — downloaded as
`triage_<bucket>_<language>_<today>.csv`. Disabled when the table is empty.
The Status column is dropped (the bucket tab already says it):

- **Pending** — status `pending` (default for new predictions). Actions: **Flag**, **Clear**, **Relabel**.
- **Cleared** — status `cleared` (checked, not worth reporting). Action: **Reopen** (→ pending).
- **Flagged** — status `flagged` (worth reporting; this is the incident report). Action: **Unflag** (→ pending).

All three status buckets share one column set: Post ID · Post · Prediction · **Manual label** (`--` when not relabelled) · Hate probability · Date.
- **Relabelled** — posts where your `manual_label` differs from the model's `predicted_label`. Extra column: **Manual label** next to the shared **Prediction** column (no status column). Action: **Edit** (slide-over).

Pending/cleared/flagged are mutually exclusive (one status each). Relabelled overlaps: a
relabelled post also lives in cleared or flagged. Editing its manual label to match the model's
label removes it from Relabelled only — it keeps its bucket until you Reopen/Unflag it.

Actions hit the backend: `POST /predictions/pred_N/flag` (idempotent → flagged),
`POST /predictions/pred_N/triage` (`{"status": "pending"|"cleared"|"flagged"}`), and
`POST /predictions/pred_N/relabel` (`{"manual_label": "Normal"|"Abuse"|"Hate", "bucket": "cleared"|"flagged"?}`).
All verify ownership (404 for other users' posts) and persist to SQLite (refresh-safe).

---

## Buckets (technical)

**Data fetch:** `useTriagePosts()` → `fetchTriagePosts` (`client.ts`) → `GET /predictions?language=…&label=Hate,Abuse`. React Query key `['triage', language]`; language switch refetches. After any action, the updated post is patched into the cached lists and `reported-posts` is invalidated, so Triage, Reports, and Borderline views update in place.

**Backend:** `main.py` → `user_posts_service` → `db.user_prediction_rows` + `db.get_triage_state` / `db.upsert_triage`.

**Relabel slide-over (`RelabelSheet.tsx`):** right-side panel, slides in on open and out on Cancel/Save/✕/backdrop (state-driven `translate-x` + `opacity` transitions, 300ms). Create mode (from Pending) asks for the correct label **and** the destination bucket (Flagged/Cleared); edit mode (from Relabelled) changes the label only. The form remounts per post (`key`), so state always initializes from the selected post.

**Status badge:** none — bucket tabs/titles carry the status (the shared `TriageStatusBadge` component was removed with the Status column).

**Data note (retraining):** the model's label is immutable in `predictions`; the reviewer's correction lives in `triage.manual_label`. A future retraining export = join predictions ⋈ triage on `u<user_id>_pred_<id>` where `manual_label IS NOT NULL`. Old statuses (`new`/`reviewed`/`reported`) are migrated to `pending`/`cleared`/`flagged` at backend startup.
