from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from . import analytics_service, db, posts_service, user_posts_service
from .auth import (
    bearer_token,
    create_session_token,
    get_caller_user,
    get_session_user,
    new_api_key,
    sha256_hex,
    verify_password,
)
from .explain_service import explain_text
from .metrics_service import load_metrics
from .model_service import ModelRouter
from .schemas import (
    ApiKeyCreateRequest,
    ApiKeyCreatedResponse,
    ApiKeyInfo,
    BatchPredictItem,
    BatchPredictRequest,
    BatchPredictResponse,
    ExplainRequest,
    HealthResponse,
    Language,
    LoginRequest,
    LoginResponse,
    ModelMetricsResponse,
    OverviewStatsResponse,
    PostResponse,
    PredictRequest,
    PredictResponse,
    Probabilities,
    RelabelRequest,
    TriageUpdateRequest,
    UserInfo,
)

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

_router: ModelRouter | None = None


@lru_cache(maxsize=1)
def get_router() -> ModelRouter:
    global _router
    if _router is None:
        _router = ModelRouter(device=os.getenv("INFERENCE_DEVICE", "auto"))
    return _router


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.get_conn()
    get_router()
    yield


app = FastAPI(
    title="KC Train Hate Speech API",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Auth: dashboard sessions, API keys ---


def _user_info(user: dict) -> UserInfo:
    return UserInfo(id=user["id"], email=user["email"], org_name=user["org_name"])


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    user = db.get_user_by_email(payload.email)
    if user is None or not user["is_active"] or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session_token(user["id"])
    logger.info("login user_id=%s email=%s", user["id"], user["email"])
    return LoginResponse(token=token, user=_user_info(user))


@app.post("/auth/logout")
def logout(request: Request, user: dict = Depends(get_session_user)) -> dict:
    token = bearer_token(request)
    if token is not None:
        db.delete_session(sha256_hex(token))
    return {"status": "ok"}


@app.get("/auth/me", response_model=UserInfo)
def auth_me(user: dict = Depends(get_session_user)) -> UserInfo:
    return _user_info(user)


@app.get("/auth/keys", response_model=list[ApiKeyInfo])
def list_keys(user: dict = Depends(get_session_user)) -> list[ApiKeyInfo]:
    return [ApiKeyInfo(**row) for row in db.list_api_keys(user["id"])]


@app.post("/auth/keys", response_model=ApiKeyCreatedResponse, status_code=201)
def create_key(payload: ApiKeyCreateRequest, user: dict = Depends(get_session_user)) -> ApiKeyCreatedResponse:
    plaintext, prefix, key_hash = new_api_key()
    key_id = db.insert_api_key(user["id"], payload.name, prefix, key_hash)
    row = next(r for r in db.list_api_keys(user["id"]) if r["id"] == key_id)
    logger.info("api_key created user_id=%s key_id=%s name=%s", user["id"], key_id, payload.name)
    return ApiKeyCreatedResponse(key=ApiKeyInfo(**row), api_key=plaintext)


@app.delete("/auth/keys/{key_id}")
def revoke_key(key_id: int, user: dict = Depends(get_session_user)) -> dict:
    if not db.revoke_api_key(key_id, user["id"]):
        raise HTTPException(status_code=404, detail=f"Unknown or already revoked key_id={key_id}")
    logger.info("api_key revoked user_id=%s key_id=%s", user["id"], key_id)
    return {"status": "ok"}


@app.get("/stats/overview", response_model=OverviewStatsResponse)
def stats_overview(
    language: Language = Query(default="igbo"),
    user: dict = Depends(get_caller_user),
) -> OverviewStatsResponse:
    return OverviewStatsResponse(**db.overview_stats(user["id"], language))


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    router = get_router()
    return HealthResponse(
        status="ok",
        device=router.inference_device,
        models=router.model_map(),
    )


@app.get("/metrics", response_model=ModelMetricsResponse)
def metrics(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> ModelMetricsResponse:
    try:
        return ModelMetricsResponse(**load_metrics(language))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, user: dict = Depends(get_caller_user)) -> PredictResponse:
    router = get_router()
    try:
        service = router.get(payload.language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    used_fallback = router.used_fallback(payload.language)
    text = payload.text.strip()
    result = service.predict_batch([text])[0]
    db.log_predictions(
        [
            {
                "ts": db.utc_now(),
                "language": payload.language,
                "text": text,
                "predicted_label": result["predicted_label"],
                "prob_normal": result["probabilities"]["normal"],
                "prob_abuse": result["probabilities"]["abuse"],
                "prob_hate": result["probabilities"]["hate"],
                "source": "single",
                "user_id": user["id"],
            }
        ]
    )
    logger.info(
        "predict user_id=%s language=%s model_id=%s used_fallback=%s label=%s",
        user["id"],
        payload.language,
        service.model_id,
        used_fallback,
        result["predicted_label"],
    )
    return PredictResponse(
        predicted_label=result["predicted_label"],
        probabilities=Probabilities(**result["probabilities"]),
        model_id=service.model_id,
        language=payload.language,
        used_fallback=used_fallback,
    )


@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(
    payload: BatchPredictRequest, user: dict = Depends(get_caller_user)
) -> BatchPredictResponse:
    router = get_router()
    try:
        service = router.get(payload.language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    used_fallback = router.used_fallback(payload.language)
    texts = [text.strip() for text in payload.texts if text.strip()]
    raw_results = service.predict_batch(texts)
    now = db.utc_now()
    db.log_predictions(
        [
            {
                "ts": now,
                "language": payload.language,
                "text": item["text"],
                "predicted_label": item["predicted_label"],
                "prob_normal": item["probabilities"]["normal"],
                "prob_abuse": item["probabilities"]["abuse"],
                "prob_hate": item["probabilities"]["hate"],
                "source": "batch",
                "user_id": user["id"],
            }
            for item in raw_results
        ]
    )
    results = [
        BatchPredictItem(
            text=item["text"],
            predicted_label=item["predicted_label"],
            probabilities=Probabilities(**item["probabilities"]),
        )
        for item in raw_results
    ]
    logger.info(
        "predict_batch user_id=%s language=%s model_id=%s used_fallback=%s count=%d",
        user["id"],
        payload.language,
        service.model_id,
        used_fallback,
        len(results),
    )
    return BatchPredictResponse(
        results=results,
        model_id=service.model_id,
        language=payload.language,
        used_fallback=used_fallback,
    )


# --- Per-user posts (the caller's own prediction log) ---


@app.get("/predictions", response_model=list[PostResponse])
def list_user_predictions(
    language: Language = Query(default="igbo"),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    hate_min: float | None = Query(default=None, ge=0.0, le=1.0),
    hate_max: float | None = Query(default=None, ge=0.0, le=1.0),
    label: str | None = Query(default=None),
    user: dict = Depends(get_caller_user),
) -> list[dict]:
    labels = None
    if label:
        labels = [part.strip() for part in label.split(",") if part.strip() in ("Normal", "Abuse", "Hate")]
        if not labels:
            raise HTTPException(status_code=422, detail=f"Invalid label filter: {label}")
    return user_posts_service.list_user_posts(
        user["id"], language, limit, offset, hate_min=hate_min, hate_max=hate_max, labels=labels
    )


@app.post("/predictions/{post_ref}/flag", response_model=PostResponse)
def flag_user_prediction(post_ref: str, user: dict = Depends(get_caller_user)) -> dict:
    pred_id = user_posts_service.parse_pred_ref(post_ref)
    post = None
    if pred_id is not None:
        # Idempotent "move to flagged bucket" — other transitions use /triage or /relabel.
        post = user_posts_service.apply_user_triage(
            user["id"], pred_id, flagged=True, status="flagged"
        )
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_ref}")
    return post


@app.post("/predictions/{post_ref}/relabel", response_model=PostResponse)
def relabel_user_prediction(
    post_ref: str, payload: RelabelRequest, user: dict = Depends(get_caller_user)
) -> dict:
    pred_id = user_posts_service.parse_pred_ref(post_ref)
    post = None
    if pred_id is not None:
        post = user_posts_service.relabel_user_post(
            user["id"], pred_id, payload.manual_label, payload.bucket
        )
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_ref}")
    return post


@app.post("/predictions/{post_ref}/triage", response_model=PostResponse)
def triage_user_prediction(
    post_ref: str, payload: TriageUpdateRequest, user: dict = Depends(get_caller_user)
) -> dict:
    pred_id = user_posts_service.parse_pred_ref(post_ref)
    post = None
    if pred_id is not None:
        post = user_posts_service.apply_user_triage(
            user["id"], pred_id, flagged=payload.status == "flagged", status=payload.status
        )
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_ref}")
    return post


@app.get("/predictions/wordcloud")
def user_wordcloud(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    return analytics_service.user_word_cloud(user["id"], language)


@app.get("/predictions/toxic-terms")
def user_toxic_terms_route(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    router = get_router()
    try:
        service = router.get(language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return analytics_service.user_toxic_terms(service.predict_batch, user["id"], language)


@app.get("/predictions/clusters")
def user_analytics_clusters(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    try:
        return analytics_service.user_clusters(user["id"], language)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/predictions/incidents.csv", response_class=PlainTextResponse)
def user_incidents_report(
    language: Language = Query(default="igbo"),
    start: str = Query(default=""),
    end: str = Query(default=""),
    user: dict = Depends(get_caller_user),
) -> str:
    return analytics_service.user_incidents_csv(user["id"], language, start, end)


# --- Live dashboard data (posts, triage, analytics, alerts, explanations) ---


@app.get("/posts", response_model=list[PostResponse])
def list_posts(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    try:
        return posts_service.get_posts(language)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/posts/{post_id}/flag", response_model=PostResponse)
def flag_post(post_id: str, user: dict = Depends(get_caller_user)) -> dict:
    post = posts_service.apply_triage(post_id, flagged=True, status="flagged")
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_id}")
    return post


@app.post("/posts/{post_id}/triage", response_model=PostResponse)
def update_triage(
    post_id: str, payload: TriageUpdateRequest, user: dict = Depends(get_caller_user)
) -> dict:
    post = posts_service.apply_triage(
        post_id,
        flagged=payload.status == "flagged",
        status=payload.status,
    )
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_id}")
    return post


@app.get("/posts/wordcloud")
def wordcloud(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    try:
        return analytics_service.word_cloud(language)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/analytics/volume")
def analytics_volume(
    hours: int = Query(default=24, ge=1, le=168),
    language: Language | None = Query(default=None),
    user: dict = Depends(get_caller_user),
) -> list[dict]:
    return analytics_service.volume_by_hour(hours, user_id=user["id"], language=language)


@app.get("/analytics/drift")
def analytics_drift(
    days: int = Query(default=30, ge=1, le=365),
    language: Language | None = Query(default=None),
    user: dict = Depends(get_caller_user),
) -> list[dict]:
    return analytics_service.drift_by_day(days, user_id=user["id"], language=language)


@app.get("/analytics/clusters")
def analytics_clusters(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    try:
        return analytics_service.clusters(language)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/alerts")
def list_alerts(user: dict = Depends(get_caller_user)) -> list[dict]:
    return analytics_service.list_alerts(user["id"])


@app.post("/alerts/{alert_id}/read")
def read_alert(alert_id: str, user: dict = Depends(get_caller_user)) -> dict:
    if not db.mark_alert_read(alert_id, user["id"]):
        raise HTTPException(status_code=404, detail=f"Unknown alert_id={alert_id}")
    return {"status": "ok"}


@app.post("/explain")
def explain(payload: ExplainRequest, user: dict = Depends(get_caller_user)) -> dict:
    router = get_router()
    try:
        service = router.get(payload.language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    import hashlib

    text = payload.text.strip()
    explanation_id = payload.post_id or f"adhoc_{hashlib.md5(text.encode('utf-8')).hexdigest()[:8]}"

    # Explanations depend only on (language, methods, text) — cache them
    # content-addressed so repeat requests (any user) return instantly.
    methods_key = ",".join(sorted(payload.methods)) if payload.methods else "all"
    cache_key = sha256_hex(f"{payload.language}|{methods_key}|{text}")
    cached = db.get_cached_explanation(cache_key)
    if cached is not None:
        cached["id"] = explanation_id
        logger.info("explain cache hit language=%s methods=%s", payload.language, methods_key)
        return cached

    result = explain_text(service, text, explanation_id, methods=payload.methods)
    db.save_cached_explanation(cache_key, payload.language, result)
    return result


@app.get("/reports/incidents.csv", response_class=PlainTextResponse)
def incidents_report(
    language: Language = Query(default="igbo"),
    start: str = Query(default=""),
    end: str = Query(default=""),
    user: dict = Depends(get_caller_user),
) -> str:
    try:
        return analytics_service.incidents_csv(language, start, end)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
