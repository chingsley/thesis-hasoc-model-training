"""Live analytics: volume, drift, clusters, word cloud, alerts, incident report.

Volume/drift/alerts are computed from the predictions log (real API usage)
and are scoped per user. Clusters and the word cloud are computed from the
live posts served by posts_service (shared model test-set view).
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import numpy as np

from . import db, posts_service, user_posts_service

logger = logging.getLogger(__name__)

VOLUME_HOURS = 24
DRIFT_DAYS = 30
HATE_SPIKE_THRESHOLD = int(os.getenv("ALERT_HATE_HOUR_THRESHOLD", "40"))
HATE_SPIKE_HIGH = int(os.getenv("ALERT_HATE_HOUR_HIGH", "60"))
HIGH_CONF_HATE_THRESHOLD = float(os.getenv("ALERT_HIGH_CONF_HATE", "0.9"))

_word_re = re.compile(r"\w+", re.UNICODE)

# Minimal stopword list; toxic/domain terms are deliberately NOT hardcoded —
# the cloud shows whatever actually appears in Hate/Abuse predictions.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "is", "it", "you", "your",
    "i", "we", "they", "them", "for", "on", "at", "be", "are", "was", "with",
    "this", "that", "na", "ka", "ndi", "si", "ni", "gb", "fun", "ti", "ati",
    "url", "username",
}


def _hour_bucket(ts: str) -> str:
    return ts[:13] + ":00"


def volume_by_hour(
    hours: int = VOLUME_HOURS, user_id: int | None = None, language: str | None = None
) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = db.prediction_rows_since(since, user_id=user_id)
    if language:
        rows = [row for row in rows if row["language"] == language]

    buckets: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        buckets[_hour_bucket(row["ts"])][row["predicted_label"]] += 1

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    points = []
    for offset in range(hours - 1, -1, -1):
        moment = now - timedelta(hours=offset)
        key = moment.isoformat()[:13] + ":00"
        counts = buckets.get(key, Counter())
        normal, abuse, hate = counts.get("Normal", 0), counts.get("Abuse", 0), counts.get("Hate", 0)
        points.append(
            {
                "hour": key,
                "normal_count": normal,
                "abuse_count": abuse,
                "hate_count": hate,
                "total": normal + abuse + hate,
            }
        )
    return points


def drift_by_day(
    days: int = DRIFT_DAYS, user_id: int | None = None, language: str | None = None
) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = db.prediction_rows_since(since, user_id=user_id)
    if language:
        rows = [row for row in rows if row["language"] == language]

    sums: dict[str, dict[str, float]] = defaultdict(lambda: {"n": 0.0, "normal": 0.0, "abuse": 0.0, "hate": 0.0})
    for row in rows:
        day = row["ts"][:10]
        bucket = sums[day]
        bucket["n"] += 1
        bucket["normal"] += row["prob_normal"]
        bucket["abuse"] += row["prob_abuse"]
        bucket["hate"] += row["prob_hate"]

    points = []
    for day in sorted(sums):
        bucket = sums[day]
        n = max(bucket["n"], 1.0)
        points.append(
            {
                "date": day,
                "normal_avg_confidence": bucket["normal"] / n,
                "abuse_avg_confidence": bucket["abuse"] / n,
                "hate_avg_confidence": bucket["hate"] / n,
            }
        )
    return points


def _word_cloud_from_posts(posts: list[dict[str, Any]], limit: int = 40) -> list[dict[str, Any]]:
    freq: Counter = Counter()
    for post in posts:
        if post["predicted_label"] not in ("Hate", "Abuse"):
            continue
        for token in _word_re.findall(post["tweet"].lower()):
            if len(token) > 2 and token not in _STOPWORDS:
                freq[token] += 1
    return [{"text": text, "value": value} for text, value in freq.most_common(limit)]


def word_cloud(language: str, limit: int = 40) -> list[dict[str, Any]]:
    return _word_cloud_from_posts(posts_service.get_posts(language), limit)


def user_word_cloud(user_id: int, language: str, limit: int = 40) -> list[dict[str, Any]]:
    return _word_cloud_from_posts(user_posts_service.list_user_posts(user_id, language), limit)


# --- Model-measured toxic terms (leave-one-out word attribution) ---

TOXIC_TERMS_MAX_POSTS = int(os.getenv("TOXIC_TERMS_MAX_POSTS", "80"))
_TOXIC_TERMS_MAX_WORDS_PER_POST = 25
_TOXIC_TERMS_MIN_CONTRIBUTION = 0.005

# fingerprint = (toxic post count, newest toxic post id) — new predictions invalidate
_toxic_terms_cache: dict[tuple[int, str], tuple[tuple, list[dict[str, Any]]]] = {}


def user_toxic_terms(
    predict_fn: Callable[[list[str]], list[dict[str, Any]]],
    user_id: int,
    language: str,
    limit: int = 40,
) -> list[dict[str, Any]]:
    """Rank words by *model-measured* toxicity, not raw frequency.

    For each Hate/Abuse post, each candidate word is removed in turn and the
    post re-classified; a word's contribution is the drop in toxic probability
    (1 - prob_normal) it causes. `value` = total contribution across the log
    (mean drop x occurrences), so a word must be both common AND toxic-driving
    to rank high. Target words like "biafra" score ~0 unless they themselves
    raise the toxicity score.
    """
    posts = [
        post
        for post in user_posts_service.list_user_posts(user_id, language)
        if post["predicted_label"] in ("Hate", "Abuse")
    ][:TOXIC_TERMS_MAX_POSTS]
    if not posts:
        return []

    fingerprint = (len(posts), posts[0]["id"])
    cache_key = (user_id, language)
    cached = _toxic_terms_cache.get(cache_key)
    if cached and cached[0] == fingerprint:
        return cached[1]

    tasks: list[tuple[str, int, str]] = []  # (word, post index, reduced text)
    baselines: list[float] = []
    for idx, post in enumerate(posts):
        tokens = [
            token
            for token in _word_re.findall(post["tweet"].lower())
            if len(token) > 2 and token not in _STOPWORDS
        ]
        baselines.append(1.0 - post["probabilities"]["normal"])
        for word in sorted(set(tokens))[:_TOXIC_TERMS_MAX_WORDS_PER_POST]:
            reduced = " ".join(token for token in tokens if token != word)
            if reduced.strip():
                tasks.append((word, idx, reduced))

    contributions: dict[str, list[float]] = defaultdict(list)
    batch_size = 16
    for start in range(0, len(tasks), batch_size):
        chunk = tasks[start : start + batch_size]
        results = predict_fn([task[2] for task in chunk])
        for (word, idx, _), result in zip(chunk, results):
            toxic_prob = 1.0 - result["probabilities"]["normal"]
            contributions[word].append(baselines[idx] - toxic_prob)

    ranked = []
    for word, drops in contributions.items():
        mean_drop = sum(drops) / len(drops)
        if mean_drop <= _TOXIC_TERMS_MIN_CONTRIBUTION:
            continue
        ranked.append(
            {
                "text": word,
                "value": round(mean_drop * len(drops), 4),
                "count": len(drops),
                "contribution": round(mean_drop, 4),
            }
        )
    ranked.sort(key=lambda row: -row["value"])
    result = ranked[:limit]
    _toxic_terms_cache[cache_key] = (fingerprint, result)
    return result


def _clusters_from_posts(all_posts: list[dict[str, Any]], max_clusters: int = 6) -> list[dict[str, Any]]:
    posts = [post for post in all_posts if post["predicted_label"] in ("Hate", "Abuse")]
    if not posts:
        return []
    if len(posts) < max_clusters:
        return [
            {
                "cluster_id": 0,
                "posts": posts,
                "representative_text": posts[0]["tweet"],
                "size": len(posts),
            }
        ]

    try:
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError as exc:
        raise RuntimeError("scikit-learn is required for clustering") from exc

    texts = [post["tweet"] for post in posts]
    matrix = TfidfVectorizer(max_features=2000, token_pattern=r"\w{3,}").fit_transform(texts)
    n_clusters = min(max_clusters, max(2, len(posts) // 10))
    model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    labels = model.fit_predict(matrix)

    grouped: dict[int, list[int]] = defaultdict(list)
    for idx, cluster_id in enumerate(labels):
        grouped[int(cluster_id)].append(idx)

    result = []
    for cluster_id, indices in sorted(grouped.items(), key=lambda item: -len(item[1])):
        centroid = model.cluster_centers_[cluster_id]
        similarities = np.asarray(matrix[indices] @ centroid).ravel()
        best = indices[int(np.argmax(similarities))]
        cluster_posts = [posts[i] for i in indices[:20]]
        result.append(
            {
                "cluster_id": cluster_id,
                "posts": cluster_posts,
                "representative_text": posts[best]["tweet"],
                "size": len(indices),
            }
        )
    return result


_cluster_cache: dict[str, list[dict[str, Any]]] = {}


def clusters(language: str, max_clusters: int = 6) -> list[dict[str, Any]]:
    lang = language.strip().lower()
    if lang not in _cluster_cache:
        _cluster_cache[lang] = _clusters_from_posts(posts_service.get_posts(lang), max_clusters)
    return _cluster_cache[lang]


def user_clusters(user_id: int, language: str, max_clusters: int = 6) -> list[dict[str, Any]]:
    """Clusters over the user's own prediction log; recomputed per call (log grows)."""
    return _clusters_from_posts(user_posts_service.list_user_posts(user_id, language), max_clusters)


def refresh_clusters() -> None:
    _cluster_cache.clear()


def generate_alerts(user_id: int) -> None:
    """Derive alerts from one user's recent prediction activity; deterministic ids dedup."""
    now = datetime.now(timezone.utc)
    id_prefix = f"u{user_id}_"

    since_hour = (now - timedelta(hours=1)).isoformat()
    rows = db.prediction_rows_since(since_hour, user_id=user_id)
    hate_rows = [row for row in rows if row["predicted_label"] == "Hate"]
    day_key = now.isoformat()[:13]

    if len(hate_rows) >= HATE_SPIKE_THRESHOLD:
        severity = "high" if len(hate_rows) >= HATE_SPIKE_HIGH else "medium"
        db.insert_alert(
            {
                "id": f"{id_prefix}volume_spike_{day_key}",
                "type": "volume_spike",
                "message": f"Hate post volume spike: {len(hate_rows)} posts detected in the last hour",
                "severity": severity,
                "ts": now.isoformat(),
                "read": 0,
                "post_id": None,
                "user_id": user_id,
            }
        )

    for row in hate_rows:
        if row["prob_hate"] >= HIGH_CONF_HATE_THRESHOLD:
            digest = hashlib.md5(row["text"].encode("utf-8")).hexdigest()[:8]
            alert_id = f"{id_prefix}hate_threshold_{row['ts'][:19]}_{digest}"
            db.insert_alert(
                {
                    "id": alert_id,
                    "type": "hate_threshold",
                    "message": (
                        f"High-confidence hate detected ({row['prob_hate']:.0%}): "
                        f"{row['text'][:80]}"
                    ),
                    "severity": "high",
                    "ts": row["ts"],
                    "read": 0,
                    "post_id": None,
                    "user_id": user_id,
                }
            )

    since_week = (now - timedelta(days=7)).isoformat()
    week_rows = db.prediction_rows_since(since_week, user_id=user_id)
    today = now.date().isoformat()
    today_probs = [r["prob_hate"] for r in week_rows if r["ts"][:10] == today]
    prior_probs = [r["prob_hate"] for r in week_rows if r["ts"][:10] != today]
    if len(today_probs) >= 10 and len(prior_probs) >= 10:
        today_avg = sum(today_probs) / len(today_probs)
        prior_avg = sum(prior_probs) / len(prior_probs)
        if abs(today_avg - prior_avg) > 0.15:
            db.insert_alert(
                {
                    "id": f"{id_prefix}model_drift_{today}",
                    "type": "model_drift",
                    "message": (
                        f"Hate-confidence drift: 7-day avg {prior_avg:.2f} → today {today_avg:.2f}"
                    ),
                    "severity": "medium",
                    "ts": now.isoformat(),
                    "read": 0,
                    "post_id": None,
                    "user_id": user_id,
                }
            )


def list_alerts(user_id: int) -> list[dict[str, Any]]:
    generate_alerts(user_id)
    return [
        {
            "id": row["id"],
            "type": row["type"],
            "message": row["message"],
            "severity": row["severity"],
            "timestamp": row["ts"],
            "read": bool(row["read"]),
            **({"post_id": row["post_id"]} if row["post_id"] else {}),
        }
        for row in db.list_alerts(user_id)
    ]


def _incidents_csv_from_posts(posts: list[dict[str, Any]], start: str, end: str) -> str:
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "tweet", "label", "predicted_label", "hate_probability", "flagged", "reported_date"])
    for post in posts:
        ts = (post["timestamp"] or "")[:10]
        if start and ts and ts < start:
            continue
        if end and ts and ts > end:
            continue
        writer.writerow(
            [
                post["id"],
                post["tweet"],
                post["label"],
                post["predicted_label"],
                f"{post['probabilities']['hate']:.3f}",
                post["flagged"],
                ts,
            ]
        )
    return buffer.getvalue()


def incidents_csv(language: str, start: str, end: str) -> str:
    """CSV of test-set posts marked 'reported', filtered by triage updated_at date."""
    return _incidents_csv_from_posts(posts_service.reported_posts(language), start, end)


def user_incidents_csv(user_id: int, language: str, start: str, end: str) -> str:
    """CSV of the user's own predictions marked 'reported', filtered by date."""
    return _incidents_csv_from_posts(user_posts_service.user_reported_posts(user_id, language), start, end)
