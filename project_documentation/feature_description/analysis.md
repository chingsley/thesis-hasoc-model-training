# Analysis module

> **Keep this file current.** When you change routes, UI behavior, data sources, or processing logic for any component below, update its section in the same PR/commit. Stale docs are not acceptable. See `.cursor/rules/feature-documentation.mdc`.

**Route:** `/analysis` · **Page:** `frontend_dashboard/src/pages/Analysis.tsx`

Tabs: Toxic Word Cloud · Model Drift · Post Volume · Post Clusters

---

## Toxic Word Cloud tab

**When it loads:** The Analysis page opens with this tab selected by default (`defaultValue="wordcloud"`). The tab panels are **not** pre-mounted — the Base UI `Tabs.Panel` mounts content only when its tab becomes active (no `keepMounted`). So the API calls fire when the tab mounts at page open (default tab) and again on remount after you switch away and back; React Query's 60-second cache makes remounts instant. Changing the language selector refetches.

The tab shows **two side-by-side clouds** (`Analysis.tsx`), both rendered by `ToxicWordCloud` with different `source` props:

### Cloud 1 — Frequent Terms in Toxic Posts (`source="frequent"`)

**Request:** `GET /predictions/wordcloud?language=igbo|yoruba` — no body. Header: `Authorization: Bearer <token>` (`fetchWordCloud` in `client.ts`).

**Backend:** `main.py` → `analytics_service.user_word_cloud(user_id, language)` → `user_posts_service.list_user_posts` reads your **newest 500** SQLite `predictions` rows for your user and language → `_word_cloud_from_posts` keeps posts where `predicted_label` is `Hate` or `Abuse`, splits tweets into words (regex), drops words ≤2 characters and common stopwords, counts frequency, returns top 40 `{text, value}` pairs.

**Purpose:** raw frequency — surfaces the **targets** of toxicity (e.g. a group/place name like “biafra”), whether or not the word itself is toxic.

### Cloud 2 — Most Toxic Terms (`source="toxic"`)

**Request:** `GET /predictions/toxic-terms?language=igbo|yoruba` — no body. Same auth (`fetchToxicTerms` in `client.ts`).

**Backend:** `main.py` selects the already-loaded language model and passes its `predict_batch` to `analytics_service.user_toxic_terms(...)`. Over your newest **80** Hate/Abuse posts (`TOXIC_TERMS_MAX_POSTS`), each candidate word is removed in turn and the post re-classified (**leave-one-out**); a word's `contribution` = drop in toxic probability (`1 − prob_normal`) when removed. `value` = contribution × occurrences, so ranking needs a word to be both common **and** toxicity-driving. Words with near-zero contribution (pure targets, neutral context words) are filtered out (<0.005). Results cached in-memory per `(user, language)`, invalidated when your toxic log changes (fingerprint = count + newest post id).

**Response example:**
```json
[{ "text": "mgbu", "value": 1.3182, "count": 2, "contribution": 0.6591 },
 { "text": "biafra", "value": 0.8556, "count": 9, "contribution": 0.0951 }]
```
Note how “biafra” ranks high on *total* value through frequency (9×) but its **per-occurrence contribution is low** — the model says the word itself is not the toxic driver. Slurs like “mgbu”/“teroristi” score 6–7× higher per occurrence.

**Response example (cloud 1):**
```json
[{ "text": "stupid", "value": 12 }, { "text": "idiot", "value": 8 }]
```

**Frontend processing:** React Query caches 60s (`staleTime` in `ToxicWordCloud.tsx`); separate cache keys per source. A spinner shows while loading (“Measuring word toxicity…” for the toxic cloud — first call re-classifies hundreds of reduced texts).

**Render:** Each word’s font size (12–48px), opacity, and red intensity scale with `value / max(value)`. Hover: cloud 1 shows `word: N occurrences`; cloud 2 shows `word: Nx in toxic posts, +X% toxicity per occurrence`. Empty → “No toxic terms to display” / “No toxic terms identified yet”.

**Data note:** Both clouds come from **your logged predictions** (Testing page / API calls), not the static test-set CSV.

---

## Model Drift tab

**When it loads:** Clicking **Model Drift** shows the chart card. The data fetch starts when you open the **Analysis** page (parent `useDriftData()` in `Analysis.tsx`), not when you click the tab. React Query caches results for 60 seconds; changing the language selector refetches.

**Request:** `GET /analytics/drift?language=igbo|yoruba` — no body, no `days` param (backend default **30 days**). Header: `Authorization: Bearer <token>` (`fetchDriftData` in `client.ts`).

**Backend:** `main.py` → `analytics_service.drift_by_day(days=30, user_id=<you>, language=...)` → SQLite `predictions` table via `db.prediction_rows_since` (`WHERE ts >= last 30 days AND user_id = ?`). Only rows for the selected language are kept.

**Processing:** For each calendar day, the backend sums `prob_normal`, `prob_abuse`, and `prob_hate` across all your logged predictions that day, then divides by count to get three daily averages. These are **average model confidence scores**, not post counts.

**Response example:**
```json
[
  {
    "date": "2026-08-27",
    "normal_avg_confidence": 0.71,
    "abuse_avg_confidence": 0.18,
    "hate_avg_confidence": 0.11
  }
]
```

**Frontend render:** `ModelDriftChart` draws three Recharts lines (green Normal, `amber-500` Abuse, red Hate) over date on the x-axis, y-axis 50%–100%. Tooltip shows percentages. Footer text explains that sustained drift may mean retraining is needed.

**Data note:** Points appear only on days when you ran **`/predict`** or **`/predict/batch`** (Testing Tools). No predictions logged → empty chart. Data is **per user**, not global test-set stats.

---

## Post Volume tab

**When it loads:** Clicking **Post Volume** shows the chart. The fetch starts when you open the **Analysis** page (`useQuery` with `fetchVolumeData` in `Analysis.tsx`), not when you click the tab. Refetches when language changes; React Query key `['volume', language]`.

**Request:** `GET /analytics/volume?language=igbo|yoruba` — no body, no `hours` param (backend default **24 hours**, max 168). Header: `Authorization: Bearer <token>` (`fetchVolumeData` in `client.ts`).

**Backend:** `main.py` → `analytics_service.volume_by_hour(hours=24, user_id=<you>, language=...)` → SQLite `predictions` via `db.prediction_rows_since` (last 24 hours, filtered to your `user_id` and language).

**Processing:** Each logged prediction is placed in an **hour bucket** from its timestamp. The backend counts how many were labeled Normal, Abuse, or Hate per hour, and sets `total` = sum of the three. It returns **one row per hour** for the window (including hours with zero counts).

**Response example:**
```json
[
  {
    "hour": "2026-08-28T10:00",
    "normal_count": 2,
    "abuse_count": 1,
    "hate_count": 0,
    "total": 3
  }
]
```

**Frontend processing:** `VolumeChart` keeps the last 168 points if the API ever sends more (`slice(-168)`); with the default 24-hour API, all points are shown. Hour labels are shortened for the x-axis (`hour.slice(-5)`).

**Render:** Four Recharts lines — Total (primary color), Normal (green), Abuse (`amber-500`), Hate (red). Chart appears only after `volumeData` is truthy (no dedicated spinner on this tab).

**Data note:** Counts come from **`/predict`** and **`/predict/batch`** calls logged to SQLite. Per user, per language. No activity → flat zero lines.

---

## Post Clusters tab

**When it loads:** Clicking **Post Clusters** shows the list (spinner while loading). The fetch starts when you open the **Analysis** page (`useQuery` + `fetchClusters` in `Analysis.tsx`), not when you click the tab. Refetches when language changes; key `['clusters', language]`.

**Request:** `GET /predictions/clusters?language=igbo|yoruba` — no body. Header: `Authorization: Bearer <token>` (`fetchClusters` in `client.ts`).

**Backend:** `main.py` → `analytics_service.user_clusters(user_id, language)` → `user_posts_service.list_user_posts` reads your **newest 500** SQLite `predictions` rows → `_clusters_from_posts`.

**Processing:** Keeps only Hate/Abuse posts. **0 posts → empty array `[]`**; fewer than 6 → one cluster containing all of them. Otherwise: **TF-IDF** vectorizes tweet text (words 3+ chars, up to 2000 features) → **KMeans** groups similar texts, with cluster count `k = min(6, max(2, n/10))` (n = number of toxic posts) and a **fixed random seed (42)**, so identical data always yields identical clusters. Each cluster includes up to 20 sample posts (full post objects: id, tweet, label, probabilities, triage fields), total `size`, and a **representative_text** (tweet closest to the cluster center/centroid). Recomputed on each request (your log grows; there is no server-side cache for user clusters). Requires **scikit-learn**; missing → HTTP 503.

**Response example:**
```json
[
  {
    "cluster_id": 0,
    "size": 15,
    "representative_text": "example tweet…",
    "posts": [{ "id": "pred_3", "tweet": "…", "label": "Abuse", "predicted_label": "Abuse", … }]
  }
]
```

**Frontend render:** `PostClusters` shows collapsible cards per cluster (Cluster #1, post count, representative preview). Expanding lists posts with label/id badges and full tweet text. Empty array → “No similar post clusters detected”.

**Data note:** Clusters use **your logged predictions** (Testing), not the static test-set CSV. Needs enough similar Hate/Abuse texts to form meaningful groups.

---
