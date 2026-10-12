from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .text_validation import validate_prediction_text, validate_prediction_texts

Language = Literal["igbo", "yoruba"]
Label = Literal["Normal", "Abuse", "Hate"]


class Probabilities(BaseModel):
    normal: float = Field(ge=0.0, le=1.0)
    abuse: float = Field(ge=0.0, le=1.0)
    hate: float = Field(ge=0.0, le=1.0)


class PredictRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Language

    @field_validator("text")
    @classmethod
    def _check_text(cls, value: str) -> str:
        return validate_prediction_text(value)


class PredictResponse(BaseModel):
    predicted_label: Label
    probabilities: Probabilities
    model_id: str
    language: Language
    used_fallback: bool = False
    use_openai_moderation: bool = False


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)
    language: Language

    @field_validator("texts")
    @classmethod
    def _check_texts(cls, value: list[str]) -> list[str]:
        stripped = [t.strip() for t in value if t.strip()]
        if not stripped:
            raise ValueError("texts must include at least one non-empty row")
        return validate_prediction_texts(stripped)


class BatchPredictItem(BaseModel):
    text: str
    predicted_label: Label
    probabilities: Probabilities


class BatchPredictResponse(BaseModel):
    results: list[BatchPredictItem]
    model_id: str
    language: Language
    used_fallback: bool = False
    use_openai_moderation: bool = False


class HealthResponse(BaseModel):
    status: str
    device: str
    models: dict[str, str]
    routing: str = "per_language"
    model_set: str | None = None
    use_openai_moderation: bool = False
    openai_moderation_model: str | None = None


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


TriageStatus = Literal["pending", "flagged"]


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
    relabelled: bool = False
    initial_model_prediction: Label | None = None
    reviewer_id: int | None = None
    reviewed_at: str | None = None
    timestamp: str


class TriageBucketCounts(BaseModel):
    total: int
    normal: int = 0
    hate: int
    abuse: int
    normal_flagged: int = 0
    normal_relabelled: int = 0
    normal_other: int = 0
    hate_flagged: int = 0
    hate_relabelled: int = 0
    hate_other: int = 0
    abuse_flagged: int = 0
    abuse_relabelled: int = 0
    abuse_other: int = 0


class TriageStatsResponse(BaseModel):
    pending: TriageBucketCounts
    flagged: TriageBucketCounts
    relabelled: TriageBucketCounts


class TriagePostsPageResponse(BaseModel):
    items: list[PostResponse]
    total: int
    limit: int
    offset: int


class TriageUpdateRequest(BaseModel):
    status: TriageStatus


class RelabelRequest(BaseModel):
    label: Label
    bucket: Literal["flagged"] | None = None


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
    name: str = ""
    org_name: str
    organization_id: int
    home_organization_id: int
    is_platform_admin: bool = False
    must_change_password: bool = False
    can_manage_api_keys: bool = False
    can_invite_users: bool = False


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    organization_id: int | None = Field(default=None, ge=1)


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


class OrganizationInfo(BaseModel):
    id: int
    name: str
    created_at: str


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class SessionOrganizationRequest(BaseModel):
    organization_id: int = Field(ge=1)


class InviteCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    organization_id: int | None = Field(default=None, ge=1)


class InviteInfo(BaseModel):
    id: int
    email: str
    created_at: str


class InviteCreatedResponse(BaseModel):
    invite: InviteInfo
    temporary_password: str  # plaintext, returned exactly once at creation


class OverviewStatsResponse(BaseModel):
    language: Language
    total: int
    normal: int
    abuse: int
    hate: int
