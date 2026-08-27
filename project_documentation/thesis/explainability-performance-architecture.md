# Explainability Latency: Root-Cause Analysis and Architectural Optimisation

Thesis-facing write-up of the `/explain` performance redesign (backend API server).
Covers the problem, the cost analysis, the three optimisation techniques, measured
results, and the correctness/trade-off discussion.

## 1. Motivation

The dashboard's Explainability page asks the backend to justify a classification with
four independent XAI methods (LIME, SHAP, attention rollout, integrated gradients).
In the original implementation a single request could take **over a minute** on CPU,
which is unacceptable for an interactive moderation dashboard and for live demos.

## 2. Baseline architecture and cost analysis

Original flow (`POST /explain` → `explain_service.explain_text`):

- Methods executed **strictly sequentially** in one request thread.
- **LIME ran twice** (second run feeds the `lime_stability_jaccard` metric), each run
  perturbing the input **500 times** (`EXPLAIN_LIME_SAMPLES=500`) and re-classifying
  every perturbation → ~1,000 model forward passes.
- **SHAP** (partition explainer over the tokenizer masker) issues hundreds of masked
  re-classifications.
- **Integrated gradients** used **50 interpolation steps**, each a forward+backward pass.
- **Attention rollout** is a single forward pass — the only cheap method.
- Per-method faithfulness metrics added ~2 further predictions per method.

Estimated cost per request: **1,500+ sequential model evaluations**, single-threaded,
on CPU (`INFERENCE_DEVICE=auto` → `cpu` on the dev machine). Every repeat of the same
request recomputed everything — no caching existed.

## 3. Optimisations

### 3.1 Content-addressed response cache

Explanations are a pure function of `(language, methods, text)` for a fixed model, so
the full payload is cached in SQLite (new `explanations` table) keyed by
`sha256(language | sorted-methods | text)`. The key is **content-addressed and
user-independent**: different users asking about the same text share one entry, which
suits a multi-tenant service where client platforms moderate overlapping content.
Cache hits return in single-digit milliseconds. Implemented in `app/main.py`
(`/explain` handler) with storage helpers `db.get_cached_explanation` /
`db.save_cached_explanation`.

### 3.2 Concurrent method execution

The four methods (plus the second LIME run) are independent and **read-only** against
the already-loaded model, so they now run on a `ThreadPoolExecutor`
(`EXPLAIN_MAX_WORKERS=4`) inside `explain_service.explain_text`. PyTorch releases the
GIL during native inference, so threads give real parallelism even on CPU; per-method
error isolation (`_safe_call`) and the response schema are unchanged. Wall time is now
bounded by the **slowest** method instead of the **sum** of all methods.

### 3.3 Tuned computation budgets

- `EXPLAIN_LIME_SAMPLES`: 500 → **200** (LIME runs twice; this is the dominant cost).
  Local-linear fidelity changes by only a few points at 200 samples on short posts.
- `EXPLAIN_IG_STEPS`: 50 → **32** interpolation steps; attributions on short texts
  converge well before 50.
- Both remain env-configurable per deployment (accuracy-vs-latency knob), as is the
  thread-pool size.

## 4. Evaluation

Setup: Apple M1 (8 cores), CPU inference, `afro-xlmr-igbo-hate`, ~15-token Igbo text,
all four methods requested (the dashboard's default).

| Scenario | Baseline | Optimised | Speed-up |
|----------|----------|-----------|----------|
| First request (cold, incl. warm-up) | 107.8 s | 49.5 s | 2.2× |
| Steady-state, unseen text | 70.9 s | 12.9 s | **5.5×** |
| Repeated identical request | 70.9 s (recomputed) | **0.003 s** (cache hit) | ~4 orders of magnitude |

Correctness: the optimised payload is schema-identical to the baseline (same
`methods` keys, same 16 `metrics` keys including `lime_stability_jaccard`); cached
responses verified byte-identical to fresh ones (modulo the echo `id`). Thread-safety
verified with 3 concurrent `/explain` requests across languages — all 200 OK at
~13 s each with no cross-talk.

## 5. Trade-offs and limitations

- **Accuracy vs latency**: fewer LIME samples/IG steps slightly noisier attributions;
  env vars restore the old budgets where fidelity matters more than speed.
- **Cache staleness**: the cache assumes a fixed model per deployment. A model swap
  should bump the key namespace (e.g. include the model id — currently the language
  implies it, since routing is per-language and configured at startup).
- **Threads, not processes**: CPU parallelism is bounded by torch's intra-op threads;
  a GPU (`INFERENCE_DEVICE=cuda`) remains the single largest lever (est. 10–50× on
  every model call) and composes multiplicatively with all three techniques above.

## 6. Incremental rendering (frontend)

Building on the per-method `methods` allow-list, the Explainability page no longer
issues one monolithic `/explain` request. It fires **four parallel single-method
requests** (`useExplanationMethods`, react-query `useQueries`) and renders each panel
the moment its method returns; pending methods show skeleton placeholders
(`ExplanationComparison`), as do unresolved confidence metrics (`ConfidenceMeter`).
Because the four browser requests run concurrently against the backend's thread pool,
first-load wall time is roughly the slowest method rather than the total.

Per-method timings (same M1/CPU setup, ~15-token Igbo text, cold cache):

| Method | Latency | Panel appears |
|--------|---------|---------------|
| Attention rollout | ~1.0 s | almost instantly |
| Integrated gradients | ~4.1 s | after ~4 s |
| LIME (2×200 samples) | ~18.6 s | after ~19 s |
| SHAP | ~37.2 s | after ~37 s |
| Any repeat (cache hit) | ~0.004 s | instantly |

Cross-method agreement (`cross_method_agreement_mean`) needs all methods' outputs, so
it is computed **client-side** (`src/lib/explain-agreement.ts`) with the same top-5
Jaccard formula as the backend, updating as panels complete. SHAP is the residual
bottleneck and the main target for future work (approximate eval budgets, GPU).

## 7. Future work

- **Async job pattern**: `POST /explain` → `202 + job_id`, background worker, client
  polls — caps worst-case UI wait regardless of hardware.
- **Per-tab lazy loading**: superseded by incremental per-method rendering (section 6);
  a further step would request methods only when their panel scrolls into view.
- **GPU inference** on the lab server for production traffic.

## Files touched

Backend:
- `app/explain_service.py` — thread-pool execution, `EXPLAIN_LIME_SAMPLES=200`,
  `EXPLAIN_IG_STEPS=32`, `EXPLAIN_MAX_WORKERS=4`
- `app/main.py` — `/explain` cache lookup/store
- `app/db.py` — `explanations` table + cache helpers
- `backend_api_server/.env.example`, `project_documentation/backend-api-reference.md` — configuration
  and endpoint docs

Frontend (incremental rendering):
- `src/hooks/use-explanations.ts` — `useExplanationMethods`: one react-query per method
- `src/lib/api/client.ts` — `fetchExplanationMethod(post, method)`
- `src/lib/explain-agreement.ts` — client-side cross-method agreement
- `src/pages/Explainability.tsx` — merges partial payloads per completed method
- `src/components/explainability/ExplanationComparison.tsx` — per-panel skeletons
- `src/components/explainability/ConfidenceMeter.tsx` — per-metric skeletons
