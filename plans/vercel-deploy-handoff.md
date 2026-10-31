# Handoff: deploy the HateGuard frontend to Vercel

Written 2026-10-30 from the thesis-report session (`~/Desktop/thesis-report-v2`), so that a Claude Code session started in this repo has the context it needs. Facts below were checked against the repo on that date.

## Goal

Host `frontend_dashboard/` on Vercel for the HateGuard user study (thesis Chapter 4). The backend stays on the Dalhousie Persuasive Computing Lab server (GPU). This is the author's planned set-up (plan M7, 2026-10-28).

## Repository state

- Branch `evaluation-readiness-fixes`, 6 commits ahead of `master`. `master` = `origin/master` = `e2025cc`, so merging is a fast-forward. Nothing on this branch has been pushed.
- Commits: LIME explains the predicted class and the explanation cache is versioned (`1821c9f`); seeded posts spread over 120 days (`d31c278`); Postgres read transactions no longer left open (`e4d414d`); data-provenance doc (`fe91b70`); old screenshot removed (`59ec8a3`); Explanation Confidence help with Plain language / Technical tabs (`cac677a`).
- `local_test_login_cred.txt` holds the local test login. It is untracked and listed in `.gitignore`. Never commit, push or print it.
- `frontend_dashboard/.env` is local configuration; do not commit it.

## Frontend facts

- Vite + React + TypeScript in `frontend_dashboard/`. Build: `npm run build` (`tsc -b && vite build`), output `dist/`. Lint: `npm run lint` (oxlint).
- Routing uses `BrowserRouter` (`src/App.tsx`). Vercel therefore needs a rewrite of all paths to `/index.html` (a `vercel.json` in `frontend_dashboard/`); otherwise reloading or opening `/explainability` directly returns 404.
- Environment variables (see `frontend_dashboard/.env.example`):
  - `VITE_API_BASE_URL`: the deployed API URL in production (empty in development, where the Vite proxy forwards `/api`).
  - `VITE_USE_MOCK=false`.
- In the Vercel project, the root directory is `frontend_dashboard`.

## Backend facts

- FastAPI app in `backend_api_server/` (`uvicorn app.main:app`).
- CORS comes from the `CORS_ORIGINS` environment variable (comma-separated; default `http://localhost:5173`). It must include the Vercel domain(s) used for the study.
- The backend is **not deployed on the lab server yet** (plan M3/M7). Until it is, a Vercel frontend has no reachable API: `localhost` only works on the author's machine.
- It must be served over **HTTPS**; browsers block calls from an HTTPS page (Vercel) to an HTTP API.

## Study constraints (REB) that affect hosting

- **No participant data may leave Canada.**
  - Vercel may serve only the static build. Do not add Vercel serverless functions, middleware or rewrites that proxy API calls through Vercel. Point `VITE_API_BASE_URL` straight at the lab server, so data goes from the browser to the server in Canada.
  - Do not enable Vercel Web Analytics or Speed Insights for the study deployment.
- The OpenAI Moderation mode must stay **off**, because it sends text to OpenAI (plan M1; done).
- Each participant gets their own organization and account; never use the shared test login in the study (plan M4/M7). Per-participant seeding is still to do.

## Where the full plan lives

- `~/Desktop/thesis-report-v2/thesis-report/chapter-4/chapter-4-plan.md`:
  - Part C3 (study set-up);
  - Part E1 (system fixes M1–M8, including M3 GPU deployment and M7 hosting).
- `~/Desktop/thesis-report-v2/usability_evalution/session_protocol_and_observation_sheet.md` (session set-up checklist).
- `project_documentation/thesis/data-provenance-collection-annotation.md` (data provenance).
