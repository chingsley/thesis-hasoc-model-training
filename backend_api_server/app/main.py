from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from . import analytics_service, db, posts_service, user_posts_service
from .auth import (
    bearer_token,
    can_invite_users,
    can_manage_api_keys,
    is_platform_admin,
    create_session_token,
    generate_temporary_password,
    get_caller_user,
    get_session_user_active,
    get_session_user_allow_password_change,
    hash_password,
    new_api_key,
    sha256_hex,
    verify_password,
)
from .explain_service import explain_text
from .metrics_service import load_metrics
from .model_service import ModelRouter, effective_model_set
from .schemas import (
    ApiKeyCreateRequest,
    ApiKeyCreatedResponse,
    ApiKeyInfo,
    BatchPredictItem,
    BatchPredictRequest,
    BatchPredictResponse,
    ChangePasswordRequest,
    InviteCreateRequest,
    InviteCreatedResponse,
    InviteInfo,
    OrganizationCreateRequest,
    OrganizationInfo,
    SessionOrganizationRequest,
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
    TriagePostsPageResponse,
    TriageStatsResponse,
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
    org_name = (user.get("organization_name") or user.get("org_name") or "").strip()
    home_org_id = int(user.get("home_organization_id", user["organization_id"]))
    return UserInfo(
        id=user["id"],
        email=user["email"],
        name=(user.get("full_name") or "").strip(),
        org_name=org_name,
        organization_id=int(user["organization_id"]),
        home_organization_id=home_org_id,
        is_platform_admin=is_platform_admin(user),
        must_change_password=bool(user.get("must_change_password")),
        can_manage_api_keys=can_manage_api_keys(user),
        can_invite_users=can_invite_users(user),
    )


def _require_api_key_admin(user: dict) -> None:
    if not can_manage_api_keys(user):
        raise HTTPException(
            status_code=403,
            detail="Only platform API key administrators can manage organization API keys",
        )


def _require_invite_admin(user: dict) -> None:
    if not can_invite_users(user):
        raise HTTPException(
            status_code=403,
            detail="Only organization administrators can invite users",
        )


def _require_platform_admin(user: dict) -> None:
    if not is_platform_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Only platform administrators can manage organizations",
        )


def _invite_target_org_id(user: dict, requested_org_id: int | None) -> int:
    if requested_org_id is not None:
        if not is_platform_admin(user):
            raise HTTPException(
                status_code=403,
                detail="Only platform administrators can invite users to other organizations",
            )
        if db.get_organization(requested_org_id) is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        return requested_org_id
    return _org_id(user)


def _normalize_invite_email(raw: str) -> str:
    email = raw.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=422, detail="Invalid email address")
    return email


def _org_id(user: dict) -> int:
    return int(user["organization_id"])


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    email = payload.email.strip().lower()
    user = db.get_user_by_email(email)
    if user is None:
        invite = db.get_active_invite(email)
        if invite is None or not verify_password(payload.password, invite["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_id = db.accept_invite_and_create_user(email)
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user = db.get_user_by_id(user_id)
    elif not user["is_active"] or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session_token(user["id"])
    logger.info(
        "login user_id=%s org_id=%s email=%s must_change_password=%s",
        user["id"],
        user["organization_id"],
        user["email"],
        user.get("must_change_password"),
    )
    return LoginResponse(token=token, user=_user_info(user))


@app.post("/auth/change-password", response_model=UserInfo)
def change_password(
    payload: ChangePasswordRequest,
    user: dict = Depends(get_session_user_allow_password_change),
) -> UserInfo:
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=422, detail="New password must differ from the current one")
    db.update_user_password(user["id"], hash_password(payload.new_password), clear_must_change=True)
    refreshed = db.get_user_by_id(user["id"])
    if refreshed is None:
        raise HTTPException(status_code=500, detail="User record missing after password update")
    logger.info("password_changed user_id=%s", user["id"])
    return _user_info(refreshed)


@app.post("/auth/logout")
def logout(request: Request, user: dict = Depends(get_session_user_allow_password_change)) -> dict:
    token = bearer_token(request)
    if token is not None:
        db.delete_session(sha256_hex(token))
    return {"status": "ok"}


@app.get("/auth/me", response_model=UserInfo)
def auth_me(user: dict = Depends(get_session_user_allow_password_change)) -> UserInfo:
    return _user_info(user)


@app.get("/auth/keys", response_model=list[ApiKeyInfo])
def list_keys(user: dict = Depends(get_session_user_active)) -> list[ApiKeyInfo]:
    _require_api_key_admin(user)
    return [ApiKeyInfo(**row) for row in db.list_api_keys(_org_id(user))]


@app.post("/auth/keys", response_model=ApiKeyCreatedResponse, status_code=201)
def create_key(
    payload: ApiKeyCreateRequest, user: dict = Depends(get_session_user_active)
) -> ApiKeyCreatedResponse:
    _require_api_key_admin(user)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Key name is required")
    plaintext, prefix, key_hash = new_api_key()
    org_id = _invite_target_org_id(user, payload.organization_id)
    key_id = db.insert_api_key(user["id"], org_id, name, prefix, key_hash)
    row = next(r for r in db.list_api_keys(org_id) if r["id"] == key_id)
    logger.info(
        "api_key created user_id=%s org_id=%s key_id=%s name=%s",
        user["id"],
        org_id,
        key_id,
        name,
    )
    return ApiKeyCreatedResponse(key=ApiKeyInfo(**row), api_key=plaintext)


@app.delete("/auth/keys/{key_id}")
def revoke_key(key_id: int, user: dict = Depends(get_session_user_active)) -> dict:
    _require_api_key_admin(user)
    if not db.revoke_api_key(key_id, _org_id(user)):
        raise HTTPException(status_code=404, detail=f"Unknown or already revoked key_id={key_id}")
    logger.info("api_key revoked user_id=%s key_id=%s", user["id"], key_id)
    return {"status": "ok"}


@app.get("/auth/invites", response_model=list[InviteInfo])
def list_invites(user: dict = Depends(get_session_user_active)) -> list[InviteInfo]:
    _require_invite_admin(user)
    return [InviteInfo(**row) for row in db.list_pending_invites(_org_id(user))]


@app.post("/auth/invites", response_model=InviteCreatedResponse, status_code=201)
def create_invite(
    payload: InviteCreateRequest, user: dict = Depends(get_session_user_active)
) -> InviteCreatedResponse:
    _require_invite_admin(user)
    email = _normalize_invite_email(payload.email)
    if email == user.get("email", "").strip().lower():
        raise HTTPException(status_code=422, detail="You cannot invite your own email address")
    if db.get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    if db.get_active_invite(email) is not None:
        raise HTTPException(status_code=409, detail="An active invite already exists for this email")
    temporary_password = generate_temporary_password()
    org_id = _invite_target_org_id(user, payload.organization_id)
    invite_id = db.create_invite(email, org_id, hash_password(temporary_password))
    row = next(r for r in db.list_pending_invites(org_id) if r["id"] == invite_id)
    logger.info(
        "user_invite created by_user_id=%s org_id=%s invite_id=%s email=%s",
        user["id"],
        org_id,
        invite_id,
        email,
    )
    return InviteCreatedResponse(invite=InviteInfo(**row), temporary_password=temporary_password)


@app.delete("/auth/invites/{invite_id}")
def revoke_invite_endpoint(
    invite_id: int, user: dict = Depends(get_session_user_active)
) -> dict:
    _require_invite_admin(user)
    if not db.revoke_invite(invite_id, _org_id(user)):
        raise HTTPException(
            status_code=404, detail=f"Unknown or already revoked invite_id={invite_id}"
        )
    logger.info("user_invite revoked by_user_id=%s invite_id=%s", user["id"], invite_id)
    return {"status": "ok"}


@app.get("/auth/organizations", response_model=list[OrganizationInfo])
def list_organizations(user: dict = Depends(get_session_user_active)) -> list[OrganizationInfo]:
    _require_platform_admin(user)
    return [OrganizationInfo(**row) for row in db.list_organizations()]


@app.post("/auth/organizations", response_model=OrganizationInfo, status_code=201)
def create_organization_endpoint(
    payload: OrganizationCreateRequest, user: dict = Depends(get_session_user_active)
) -> OrganizationInfo:
    _require_platform_admin(user)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Organization name is required")
    org_id = db.create_organization_unique(name)
    if org_id is None:
        raise HTTPException(status_code=409, detail="An organization with this name already exists")
    row = db.get_organization(org_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Organization created but could not be loaded")
    logger.info("organization created by_user_id=%s org_id=%s name=%s", user["id"], org_id, name)
    return OrganizationInfo(**row)


@app.post("/auth/session/organization", response_model=UserInfo)
def set_active_organization(
    payload: SessionOrganizationRequest,
    request: Request,
    user: dict = Depends(get_session_user_active),
) -> UserInfo:
    _require_platform_admin(user)
    token = bearer_token(request)
    if token is None:
        raise HTTPException(status_code=401, detail="Missing session token")
    if not db.set_session_active_organization(sha256_hex(token), payload.organization_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    refreshed = db.get_user_by_session(sha256_hex(token))
    if refreshed is None:
        raise HTTPException(status_code=500, detail="Session could not be refreshed")
    logger.info(
        "organization_context switched user_id=%s org_id=%s",
        user["id"],
        payload.organization_id,
    )
    return _user_info(refreshed)


@app.get("/stats/overview", response_model=OverviewStatsResponse)
def stats_overview(
    language: Language = Query(default="igbo"),
    user: dict = Depends(get_caller_user),
) -> OverviewStatsResponse:
    return OverviewStatsResponse(**db.overview_stats(_org_id(user), language))


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    router = get_router()
    return HealthResponse(
        status="ok",
        device=router.inference_device,
        models=router.model_map(),
        model_set=effective_model_set(),
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
                "organization_id": _org_id(user),
            }
        ]
    )
    logger.info(
        "predict user_id=%s org_id=%s language=%s model_id=%s used_fallback=%s label=%s",
        user["id"],
        _org_id(user),
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
                "organization_id": _org_id(user),
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
    return user_posts_service.list_org_posts(
        _org_id(user), language, limit, offset, hate_min=hate_min, hate_max=hate_max, labels=labels
    )


TriageBucketName = Literal["pending", "flagged", "relabelled"]


@app.get("/predictions/triage/stats", response_model=TriageStatsResponse)
def triage_stats(
    language: Language = Query(default="igbo"),
    user: dict = Depends(get_caller_user),
) -> dict:
    return user_posts_service.triage_stats(_org_id(user), language)


@app.get("/predictions/triage/posts", response_model=TriagePostsPageResponse)
def triage_posts_page(
    bucket: TriageBucketName,
    language: Language = Query(default="igbo"),
    limit: int = Query(default=25, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    label: str | None = Query(default=None, pattern="^(Normal|Hate|Abuse)$"),
    q: str | None = Query(default=None, max_length=200),
    since: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    until: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    hate_min: float | None = Query(default=None, ge=0.0, le=1.0),
    hate_max: float | None = Query(default=None, ge=0.0, le=1.0),
    user: dict = Depends(get_caller_user),
) -> dict:
    items, total = user_posts_service.list_triage_bucket_posts(
        _org_id(user),
        language,
        bucket,
        limit,
        offset,
        label=label,
        q=q,
        since=since,
        until=until,
        hate_min=hate_min,
        hate_max=hate_max,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.post("/predictions/{post_ref}/flag", response_model=PostResponse)
def flag_user_prediction(post_ref: str, user: dict = Depends(get_caller_user)) -> dict:
    pred_id = user_posts_service.parse_pred_ref(post_ref)
    post = None
    if pred_id is not None:
        # Idempotent "move to flagged bucket" — other transitions use /triage or /relabel.
        post = user_posts_service.apply_org_triage(
            _org_id(user), pred_id, flagged=True, status="flagged"
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
        post = user_posts_service.relabel_org_post(
            _org_id(user), pred_id, payload.manual_label, payload.bucket
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
        post = user_posts_service.apply_org_triage(
            _org_id(user),
            pred_id,
            flagged=payload.status == "flagged",
            status=payload.status,
        )
    if post is None:
        raise HTTPException(status_code=404, detail=f"Unknown post_id={post_ref}")
    return post


@app.get("/predictions/wordcloud")
def user_wordcloud(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    return analytics_service.user_word_cloud(_org_id(user), language)


@app.get("/predictions/toxic-terms")
def user_toxic_terms_route(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    router = get_router()
    try:
        service = router.get(language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return analytics_service.user_toxic_terms(service.predict_batch, _org_id(user), language)


@app.get("/predictions/clusters")
def user_analytics_clusters(
    language: Language = Query(default="igbo"), user: dict = Depends(get_caller_user)
) -> list[dict]:
    try:
        return analytics_service.user_clusters(_org_id(user), language)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/predictions/incidents.csv", response_class=PlainTextResponse)
def user_incidents_report(
    language: Language = Query(default="igbo"),
    start: str = Query(default=""),
    end: str = Query(default=""),
    user: dict = Depends(get_caller_user),
) -> str:
    return analytics_service.user_incidents_csv(_org_id(user), language, start, end)


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
    hours: int = Query(default=24, ge=1, le=2160),
    since: str | None = Query(default=None, description="ISO date or datetime (UTC)"),
    until: str | None = Query(default=None, description="ISO date or datetime (UTC)"),
    all_time: bool = Query(default=False, alias="all"),
    language: Language | None = Query(default=None),
    user: dict = Depends(get_caller_user),
) -> list[dict]:
    return analytics_service.volume_by_hour(
        hours,
        organization_id=_org_id(user),
        language=language,
        since=since,
        until=until,
        all_time=all_time,
    )


@app.get("/analytics/drift")
def analytics_drift(
    days: int = Query(default=30, ge=1, le=365),
    language: Language | None = Query(default=None),
    user: dict = Depends(get_caller_user),
) -> list[dict]:
    return analytics_service.drift_by_day(days, organization_id=_org_id(user), language=language)


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
    return analytics_service.list_alerts(_org_id(user))


@app.post("/alerts/{alert_id}/read")
def read_alert(alert_id: str, user: dict = Depends(get_caller_user)) -> dict:
    if not db.mark_alert_read(alert_id, _org_id(user)):
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

    # Explanations depend on (model, language, methods, text) — cache them
    # content-addressed so repeat requests (any user) return instantly. The
    # model id is part of the key because one language can be served by
    # different models across HF_MODEL_SET values, and this cache is on disk.
    methods_key = ",".join(sorted(payload.methods)) if payload.methods else "all"
    cache_key = sha256_hex(f"{service.model_id}|{payload.language}|{methods_key}|{text}")
    cached = db.get_cached_explanation(cache_key)
    if cached is not None:
        # Skip cache entries that only captured dependency/runtime failures so a
        # later install (or transient error) can recompute successfully.
        methods = cached.get("methods") or {}
        has_usable = any(
            isinstance(entry, dict) and "error" not in entry and entry.get("scores")
            for entry in methods.values()
        )
        if has_usable:
            cached["id"] = explanation_id
            logger.info("explain cache hit language=%s methods=%s", payload.language, methods_key)
            return cached
        logger.info(
            "explain cache bypass (error-only) language=%s methods=%s",
            payload.language,
            methods_key,
        )

    result = explain_text(service, text, explanation_id, methods=payload.methods)
    methods = result.get("methods") or {}
    has_usable = any(
        isinstance(entry, dict) and "error" not in entry and entry.get("scores")
        for entry in methods.values()
    )
    if has_usable:
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
