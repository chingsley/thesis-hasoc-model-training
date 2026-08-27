# Triage Queue module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/triage` · **Page:** `frontend_dashboard/src/pages/Triage.tsx`

---

## End-to-end flow (plain English)

Opening the page sends `GET /predictions?language=<selected>&label=Hate,Abuse` with your
`Authorization: Bearer` token (no body). The backend checks the token, then reads the SQLite
`predictions` table — **your** rows only, in the chosen language, keeping only Hate/Abuse,
newest first (up to 500 matches; the label filter happens in SQL, so older toxic posts are not
cut off by the limit). Each row is joined with its triage state (your personal
`u<you>_pred_<id>` keys in the `triage` table) and returned as post objects with text, label,
probabilities, `flagged`, and `triage_status`. The page then lets you search/filter that list
locally (search box matches text or id; the dropdown filters by New/Reviewed/Reported).

Each row is a table row (shared `DataTable`): Post ID, Post, Prediction, hate-probability bar,
status, date, and a **Flag** action. Clicking **Flag** sends `POST /predictions/pred_N/flag`. The backend verifies
the post is yours (otherwise 404), writes `flagged = true`, `status = "reported"` to your
triage record, and returns the updated post. The list refetches: the status becomes
**Reported** and the button disables. Flagged posts are exactly what **Reports → Export Report**
exports as CSV — the header text on this page says so.

---

## Flagging / Triage Queue table

**When it loads:** Opening the Triage page. React Query key `['triage', language]`; changing the language selector refetches. Header shows `(N posts)`, plus a hint line: “Flagging a post marks it as reported and adds it to your incident report (Reports → Export Report).”

**Request:** `GET /predictions?language=igbo|yoruba&label=Hate,Abuse` — no body. Header: `Authorization: Bearer <token>` (`fetchTriagePosts` in `client.ts`).

**Backend:** `main.py` → `user_posts_service.list_user_posts` → `db.user_prediction_rows` with the label filter applied **in SQL** (`WHERE user_id = ? AND language = ? AND predicted_label IN ('Hate','Abuse')`, newest first, limit 500). Server-side filtering matters: toxic posts older than the overall newest-500 window still appear, because the limit applies to *matches*, not to all rows. Triage state per row comes from per-user keys `u<user_id>_pred_<id>` in the shared `triage` table.

**Frontend processing (`TriageTable.tsx`):** Two client-side filters on the returned list — a search box (substring match on text or post id) and a status dropdown (All / New / Reviewed / Reported). Empty result → “No posts match your filters”.

**Render (`TriageTable.tsx` + shared `DataTable`):** Columns Post ID, Post (2-line clamp), Prediction (Abuse amber `#fbe08a`, Hate red; a `True:` badge only when `label` differs from `predicted_label`), hate-probability bar (red >70%, `amber-500` >40%, green otherwise), Status, Date, and Actions (**Flag**, disabled + labelled “Reported” once flagged). Empty result → “No posts match your filters”.

**Flag action:** Click **Flag** → `POST /predictions/pred_N/flag` (Bearer, no body) → backend verifies the prediction belongs to you (404 for unknown ids or another user's row), sets `flagged = true` and `triage_status = "reported"` → frontend invalidates the `posts` and `triage` queries so the row updates in place.

**Data note:** This queue is **your own processed texts** (Testing Tools / API calls), per user per language. Rows flagged here show up in **Reports → Export Report** (`/predictions/incidents.csv`).
