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


class HealthResponse(BaseModel):
    status: str
    model_id: str
    device: str
