from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["igbo", "yoruba"]
Label = Literal["Normal", "Abuse", "Hate"]


class Probabilities(BaseModel):
    normal: float = Field(ge=0.0, le=1.0)
    abuse: float = Field(ge=0.0, le=1.0)
    hate: float = Field(ge=0.0, le=1.0)


class PredictRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Language


class PredictResponse(BaseModel):
    predicted_label: Label
    probabilities: Probabilities
    model_id: str
    language: Language
    used_fallback: bool = False


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)
    language: Language


class BatchPredictItem(BaseModel):
    text: str
    predicted_label: Label
    probabilities: Probabilities


class BatchPredictResponse(BaseModel):
    results: list[BatchPredictItem]
    model_id: str
    language: Language
    used_fallback: bool = False


class HealthResponse(BaseModel):
    status: str
    device: str
    models: dict[str, str]
    routing: str = "per_language"


class PerClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: float


class ModelMetricsResponse(BaseModel):
    accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    weighted_precision: float
    weighted_recall: float
    weighted_f1: float
    mcc: float
    support: float
    per_class: dict[str, PerClassMetrics]
    confusion_matrix: list[list[int]]
    classification_report: dict[str, object]
    roc_auc_ovr: float | None = None


TriageStatus = Literal["new", "reviewed", "reported"]


class PostResponse(BaseModel):
    id: str
    tweet: str
    label: Label
    label_id: int
    language: Language
    split: str
    length: int
    predicted_label: Label
    predicted_label_id: int
    probabilities: Probabilities
    flagged: bool
    triage_status: TriageStatus
    timestamp: str


class TriageUpdateRequest(BaseModel):
    status: TriageStatus


class ExplainRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Language
    methods: list[Literal["lime", "shap", "attention_rollout", "integrated_gradients"]] | None = None
    post_id: str | None = None


# --- Auth & per-user stats ---


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class UserInfo(BaseModel):
    id: int
    email: str
    org_name: str


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(default="", max_length=120)


class ApiKeyInfo(BaseModel):
    id: int
    name: str
    prefix: str
    created_at: str
    last_used_at: str | None = None
    revoked_at: str | None = None


class ApiKeyCreatedResponse(BaseModel):
    key: ApiKeyInfo
    api_key: str  # plaintext, returned exactly once at creation


class OverviewStatsResponse(BaseModel):
    language: Language
    total: int
    normal: int
    abuse: int
    hate: int
