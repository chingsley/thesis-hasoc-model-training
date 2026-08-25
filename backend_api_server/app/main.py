from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .metrics_service import load_metrics
from .model_service import ModelRouter
from .schemas import (
    BatchPredictItem,
    BatchPredictRequest,
    BatchPredictResponse,
    HealthResponse,
    Language,
    ModelMetricsResponse,
    PredictRequest,
    PredictResponse,
    Probabilities,
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
    get_router()
    yield


app = FastAPI(
    title="KC Train Hate Speech API",
    version="0.2.0",
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
    router = get_router()
    return HealthResponse(
        status="ok",
        device=router.inference_device,
        models=router.model_map(),
    )


@app.get("/metrics", response_model=ModelMetricsResponse)
def metrics(language: Language = Query(default="igbo")) -> ModelMetricsResponse:
    try:
        return ModelMetricsResponse(**load_metrics(language))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    router = get_router()
    try:
        service = router.get(payload.language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    used_fallback = router.used_fallback(payload.language)
    result = service.predict_batch([payload.text.strip()])[0]
    logger.info(
        "predict language=%s model_id=%s used_fallback=%s label=%s",
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
def predict_batch(payload: BatchPredictRequest) -> BatchPredictResponse:
    router = get_router()
    try:
        service = router.get(payload.language)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    used_fallback = router.used_fallback(payload.language)
    texts = [text.strip() for text in payload.texts if text.strip()]
    results = [
        BatchPredictItem(
            text=item["text"],
            predicted_label=item["predicted_label"],
            probabilities=Probabilities(**item["probabilities"]),
        )
        for item in service.predict_batch(texts)
    ]
    logger.info(
        "predict_batch language=%s model_id=%s used_fallback=%s count=%d",
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
