# Explainability module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/explainability` · **Page:** `frontend_dashboard/src/pages/Explainability.tsx`

---

## Post list — “Select a Post”

**When it loads:** Opening the Explainability page (not a separate click).

**Request:** `GET /predictions?language=igbo|yoruba&label=Hate,Abuse` — no body. Header: `Authorization: Bearer <token>` (`client.ts` → `fetchTriagePosts`).

**Backend:** `main.py` → `user_posts_service.list_user_posts` → SQLite `predictions` table with the label filter in SQL (`WHERE user_id = ? AND language = ? AND predicted_label IN ('Hate','Abuse')`, newest first, limit 500 matching rows). These are texts you classified earlier via Testing (`/predict`).

**Frontend processing:** None in live mode — the backend already filtered to Hate/Abuse. The list shows the first 30 (`Explainability.tsx`).

**Response used:** Array of posts with `id` (e.g. `pred_7` = 7th saved prediction for your account), `tweet`, `label`, `predicted_label`, probabilities, triage fields.

**Render:** Scrollable buttons with tweet preview, id badge, and label badge.

---

## Clicking a post (e.g. `pred_7`)

**User action:** Click a row in the post list.

**Frontend:** `setSelectedPost(post)` highlights the row. `useExplanationMethods` starts **four parallel** requests — one per XAI method (`use-explanations.ts`).

**Request (×4):** `POST /explain`  
Body example:
```json
{ "text": "<tweet>", "language": "igbo", "methods": ["shap"], "post_id": "pred_7" }
```
Same auth header. Each call sends **one** method (`lime`, `shap`, `attention_rollout`, or `integrated_gradients`).

**Backend:** Auth via `get_caller_user`. Cache key = hash of `(language, methods, text)` in the SQLite `explanations` table. On miss: load language model → `explain_text` runs only the requested method (token attributions via LIME/SHAP/attention/integrated gradients). On hit: return cached JSON instantly.

**Response:** Partial `ExplanationPayload` per call — `methods` with one entry, optional `metrics`, `label`, `text`.

**Frontend merge:** Results merge as each finishes (`Explainability.tsx`). `crossMethodAgreementMean` adds agreement metric. `ConfidenceMeter` shows metrics; `ExplanationComparison` shows each method panel with loading spinners until its query completes. Re-clicking the same post uses React Query cache (`staleTime: Infinity`).

---

## Components not yet documented

- *(Add subsections here when other Explainability UI pieces change.)*
