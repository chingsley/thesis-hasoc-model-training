# Reports module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/reports` · **Page:** `frontend_dashboard/src/pages/Reports.tsx`

Tabs: Borderline Review · Export Report

---

## Borderline Review tab

**When it loads:** This is the default tab (`defaultValue="borderline"`). Tab panels mount only when active (Base UI `Tabs.Panel`, no `keepMounted`), so the fetch fires when `BorderlineReview` mounts at page open; remounts after switching tabs are served from React Query cache. Key `['borderline', language]`; changing the language selector refetches.

**Request:** `GET /predictions?language=igbo|yoruba&hate_min=0.4&hate_max=0.6` — no body. Header: `Authorization: Bearer <token>` (`fetchBorderlinePosts` in `client.ts`).

**Backend:** `main.py` → `user_posts_service.list_user_posts` → `db.user_prediction_rows` with the probability filter applied **in SQL** (`WHERE user_id = ? AND language = ? AND prob_hate BETWEEN 0.4 AND 0.6`, newest first, limit 500 matching rows). Server-side filtering matters: borderline posts older than the overall newest-500 window still appear, because the limit applies to *matches*, not to all rows.

**Frontend processing:** None in live mode — the list renders as returned. (Mock mode still filters mock posts client-side.)

**Render:** Shared `DataTable` (same header/zebra as Incident Report) with columns Post ID, Post, Prediction, Normal %, Abuse %, Hate probability (bar), Date. Empty state: “No borderline posts found — Posts with 40-60% confidence will appear here”. This list is **read-only** — flag actions live on the Triage Queue page.

**Data note:** For user-logged predictions there is no human ground truth — `label` mirrors `predicted_label`, so the `True:` and `Pred:` badges always match here (a leftover from the old test-set view, where they could differ).

---

## Export Report tab

**User action:** The incident report is **displayed on screen** — pick **Start Date** / **End Date** (defaults: 7 days ago → today), optionally filter with the **All / Hate / Abuse** pills (with counts) or the search box (text or post id), then click **Export CSV (N rows)** (`ExportReport.tsx`).

**Request:** `GET /predictions?language=<lang>&limit=5000` — no body. Header: `Authorization: Bearer <token>` (via `apiFetch`; the tab no longer uses a raw fetch). React Query key `['reported-posts', language]`; refetches on language change.

**Backend:** `main.py` → `user_posts_service.list_user_posts` → SQLite `predictions` (your rows, chosen language, newest first, up to 5000) joined with your per-user triage state.

**Frontend processing:** Client-side filter to `triage_status === 'reported'` whose **processing date** falls inside `[start, end]`, then the label pill and search text. Summary cards show Reported Posts / Hateful / Abusive counts for the filtered set; the pill counts are computed before search/label filtering.

**Render:** Shared `DataTable` with columns Post ID, Post, Prediction, Hate probability, Date, and Actions. Prediction uses the shared Abuse amber / Hate red badges. Empty state: “No reported posts in this range — Flag posts in the Triage Queue to add them to your incident report.”

**Actions:** The Actions cell is a right-aligned icon group so more icons can be added later. **Remove** (trash) sends `POST /predictions/{id}/triage` with `{ "status": "new" }`, which clears `flagged` and drops the row from the report (the prediction itself stays in your log). The table refetches via React Query (`reported-posts`, `triage`, `posts`).

**Export:** The CSV is generated **client-side from exactly the displayed rows** (WYSIWYG) with columns `id,tweet,label,predicted_label,hate_probability,flagged,reported_date`, downloaded as `incident_report_<language>_<start>_<end>.csv`. Disabled when the table is empty. The server-side endpoint `GET /predictions/incidents.csv` (same columns, language+date filters only) remains available for API consumers; its reported-posts read uses the same raised 5000-row limit.

**Data note:** Per user — only posts **you** flagged/reported appear.
