from __future__ import annotations

import os
from contextlib import asynccontextmanager
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .model_service import ModelService, resolve_model_source
from .schemas import (
    BatchPredictItem,
    BatchPredictRequest,
    BatchPredictResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
    Probabilities,
)

load_dotenv()

_service: ModelService | None = None


@lru_cache(maxsize=1)
def get_service() -> ModelService:
    global _service
    if _service is None:
        model_path, hf_model_id = resolve_model_source()
        _service = ModelService(
            model_path=model_path,
            hf_model_id=hf_model_id,
            device=os.getenv("INFERENCE_DEVICE", "auto"),
        )
    return _service


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_service()
    yield


app = FastAPI(
    title="KC Train Hate Speech API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    service = get_service()
    return HealthResponse(
        status="ok",
        model_id=service.model_id,
        device=str(service.device),
    )


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    service = get_service()
    result = service.predict_batch([payload.text.strip()])[0]
    return PredictResponse(
        predicted_label=result["predicted_label"],
        probabilities=Probabilities(**result["probabilities"]),
        model_id=service.model_id,
    )


@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(payload: BatchPredictRequest) -> BatchPredictResponse:
    service = get_service()
    texts = [text.strip() for text in payload.texts if text.strip()]
    results = [
        BatchPredictItem(
            text=item["text"],
            predicted_label=item["predicted_label"],
            probabilities=Probabilities(**item["probabilities"]),
        )
        for item in service.predict_batch(texts)
    ]
    return BatchPredictResponse(results=results, model_id=service.model_id)
