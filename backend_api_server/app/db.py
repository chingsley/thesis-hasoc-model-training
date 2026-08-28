"""SQLite persistence for triage state, prediction logs, and alerts.

Uses stdlib sqlite3 only. The DB file location is set with DASHBOARD_DB_PATH
(default: dashboard.db next to the backend package).
"""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_DEFAULT_DB = Path(__file__).resolve().parent.parent / "dashboard.db"

_lock = threading.RLock()  # re-entrant: some helpers call each other while holding it
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  language TEXT NOT NULL,
  text TEXT NOT NULL,
  predicted_label TEXT NOT NULL,
  prob_normal REAL NOT NULL,
  prob_abuse REAL NOT NULL,
  prob_hate REAL NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS triage (
  post_id TEXT PRIMARY KEY,
  flagged INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  ts TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  post_id TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  org_name TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT '',
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS explanations (
  cache_key TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns/indexes introduced after the original schema (idempotent)."""
    pred_cols = {row[1] for row in conn.execute("PRAGMA table_info(predictions)")}
    if "user_id" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN user_id INTEGER")
    alert_cols = {row[1] for row in conn.execute("PRAGMA table_info(alerts)")}
    if "user_id" not in alert_cols:
        conn.execute("ALTER TABLE alerts ADD COLUMN user_id INTEGER")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_predictions_user_lang ON predictions(user_id, language)"
    )
    triage_cols = {row[1] for row in conn.execute("PRAGMA table_info(triage)")}
    if "manual_label" not in triage_cols:
        conn.execute("ALTER TABLE triage ADD COLUMN manual_label TEXT")
    # The triage-history feature was removed; drop its table where it exists.
    conn.execute("DROP TABLE IF EXISTS triage_events")
    # Status vocabulary: new->pending, reviewed->cleared, reported->flagged
    conn.execute("UPDATE triage SET status = 'pending' WHERE status = 'new'")
    conn.execute("UPDATE triage SET status = 'cleared' WHERE status = 'reviewed'")
    conn.execute("UPDATE triage SET status = 'flagged' WHERE status = 'reported'")
    conn.execute("UPDATE triage SET flagged = CASE WHEN status = 'flagged' THEN 1 ELSE 0 END")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_path() -> Path:
    raw = os.getenv("DASHBOARD_DB_PATH", "").strip()
    return Path(raw).expanduser().resolve() if raw else _DEFAULT_DB


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        path = db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(path), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        with _lock, _conn:
            _conn.executescript(SCHEMA)
            _migrate(_conn)
    return _conn


def reset_conn_for_testing() -> None:
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
        _conn = None


def log_predictions(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn = get_conn()
    with _lock, conn:
        conn.executemany(
            "INSERT INTO predictions (ts, language, text, predicted_label,"
            " prob_normal, prob_abuse, prob_hate, source, user_id)"
            " VALUES (:ts, :language, :text, :predicted_label,"
            " :prob_normal, :prob_abuse, :prob_hate, :source, :user_id)",
            rows,
        )


def get_triage_state(post_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not post_ids:
        return {}
    conn = get_conn()
    placeholders = ",".join("?" for _ in post_ids)
    with _lock:
        rows = conn.execute(
            f"SELECT post_id, flagged, status, manual_label, updated_at FROM triage WHERE post_id IN ({placeholders})",
            post_ids,
        ).fetchall()
    return {row["post_id"]: dict(row) for row in rows}


def upsert_triage(
    post_id: str,
    *,
    flagged: bool | None = None,
    status: str | None = None,
    manual_label: str | None = None,
) -> dict[str, Any]:
    conn = get_conn()
    now = utc_now()
    with _lock, conn:
        existing = conn.execute(
            "SELECT post_id, flagged, status, manual_label, updated_at FROM triage WHERE post_id = ?",
            (post_id,),
        ).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO triage (post_id, flagged, status, manual_label, updated_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (post_id, int(flagged or False), status or "pending", manual_label, now),
            )
        else:
            conn.execute(
                "UPDATE triage SET flagged = ?, status = ?, manual_label = ?, updated_at = ?"
                " WHERE post_id = ?",
                (
                    int(flagged if flagged is not None else bool(existing["flagged"])),
                    status if status is not None else existing["status"],
                    manual_label if manual_label is not None else existing["manual_label"],
                    now,
                    post_id,
                ),
            )
        row = conn.execute(
            "SELECT post_id, flagged, status, manual_label, updated_at FROM triage WHERE post_id = ?",
            (post_id,),
        ).fetchone()
    return dict(row)


def list_flagged_post_ids() -> list[str]:
    conn = get_conn()
    with _lock:
        rows = conn.execute("SELECT post_id, updated_at FROM triage WHERE status = 'flagged'").fetchall()
    return [row["post_id"] for row in rows]


def prediction_rows_since(since_iso: str, user_id: int | None = None) -> list[dict[str, Any]]:
    conn = get_conn()
    query = (
        "SELECT ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate"
        " FROM predictions WHERE ts >= ?"
    )
    params: list[Any] = [since_iso]
    if user_id is not None:
        query += " AND user_id = ?"
        params.append(user_id)
    query += " ORDER BY ts"
    with _lock:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def insert_alert(alert: dict[str, Any]) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "INSERT OR IGNORE INTO alerts (id, type, message, severity, ts, read, post_id, user_id)"
            " VALUES (:id, :type, :message, :severity, :ts, :read, :post_id, :user_id)",
            alert,
        )


def alert_exists(alert_id: str) -> bool:
    conn = get_conn()
    with _lock:
        row = conn.execute("SELECT 1 FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    return row is not None


def list_alerts(user_id: int) -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, type, message, severity, ts, read, post_id FROM alerts"
            " WHERE user_id = ? ORDER BY ts DESC LIMIT 200",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def mark_alert_read(alert_id: str, user_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "UPDATE alerts SET read = 1 WHERE id = ? AND user_id = ?", (alert_id, user_id)
        )
    return cursor.rowcount > 0


# --- Users, sessions, API keys, per-user stats ---


def create_user(email: str, password_hash: str, org_name: str = "") -> int:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, org_name, is_active, created_at)"
            " VALUES (?, ?, ?, 1, ?)",
            (email.strip().lower(), password_hash, org_name.strip(), utc_now()),
        )
    return int(cursor.lastrowid)


def _user_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def get_user_by_email(email: str) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, email, password_hash, org_name, is_active, created_at FROM users"
            " WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
    return _user_dict(row)


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, email, password_hash, org_name, is_active, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return _user_dict(row)


def create_session(user_id: int, token_hash: str, ttl_hours: int) -> None:
    conn = get_conn()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=ttl_hours)
    with _lock, conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token_hash, user_id, now.isoformat(), expires.isoformat()),
        )


def get_user_by_session(token_hash: str) -> dict[str, Any] | None:
    """Return the active user for a session token hash, or None if invalid/expired."""
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", (token_hash,)
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] <= utc_now():
            with conn:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            return None
        user = get_user_by_id(int(row["user_id"]))
    if user is None or not user["is_active"]:
        return None
    return user


def delete_session(token_hash: str) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def insert_api_key(user_id: int, name: str, prefix: str, key_hash: str) -> int:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "INSERT INTO api_keys (user_id, name, prefix, key_hash, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (user_id, name.strip(), prefix, key_hash, utc_now()),
        )
    return int(cursor.lastrowid)


def list_api_keys(user_id: int) -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys"
            " WHERE user_id = ? ORDER BY id",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def revoke_api_key(key_id: int, user_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
            (utc_now(), key_id, user_id),
        )
    return cursor.rowcount > 0


def get_user_by_api_key_hash(key_hash: str) -> dict[str, Any] | None:
    """Return the active user owning a non-revoked key, or None."""
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL", (key_hash,)
        ).fetchone()
        if row is None:
            return None
        user = get_user_by_id(int(row["user_id"]))
    if user is None or not user["is_active"]:
        return None
    return user


def touch_api_key(key_hash: str) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?", (utc_now(), key_hash)
        )


def overview_stats(user_id: int, language: str) -> dict[str, Any]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT predicted_label, COUNT(*) AS n FROM predictions"
            " WHERE user_id = ? AND language = ? GROUP BY predicted_label",
            (user_id, language),
        ).fetchall()
    counts = {row["predicted_label"]: int(row["n"]) for row in rows}
    normal = counts.get("Normal", 0)
    abuse = counts.get("Abuse", 0)
    hate = counts.get("Hate", 0)
    return {
        "language": language,
        "total": normal + abuse + hate,
        "normal": normal,
        "abuse": abuse,
        "hate": hate,
    }


def user_prediction_rows(
    user_id: int,
    language: str,
    limit: int = 500,
    offset: int = 0,
    hate_min: float | None = None,
    hate_max: float | None = None,
    labels: list[str] | None = None,
) -> list[dict[str, Any]]:
    conn = get_conn()
    query = (
        "SELECT id, ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate,"
        " source FROM predictions WHERE user_id = ? AND language = ?"
    )
    params: list[Any] = [user_id, language]
    if hate_min is not None:
        query += " AND prob_hate >= ?"
        params.append(hate_min)
    if hate_max is not None:
        query += " AND prob_hate <= ?"
        params.append(hate_max)
    if labels:
        placeholders = ",".join("?" for _ in labels)
        query += f" AND predicted_label IN ({placeholders})"
        params.extend(labels)
    query += " ORDER BY ts DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    with _lock:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def get_prediction_for_user(prediction_id: int, user_id: int) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate,"
            " source FROM predictions WHERE id = ? AND user_id = ?",
            (prediction_id, user_id),
        ).fetchone()
    return dict(row) if row is not None else None


# --- Explanation cache (content-addressed; identical across users) ---


def get_cached_explanation(cache_key: str) -> dict[str, Any] | None:
    import json

    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT payload FROM explanations WHERE cache_key = ?", (cache_key,)
        ).fetchone()
    return json.loads(row["payload"]) if row is not None else None


def save_cached_explanation(cache_key: str, language: str, payload: dict[str, Any]) -> None:
    import json

    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "INSERT OR REPLACE INTO explanations (cache_key, language, payload, created_at)"
            " VALUES (?, ?, ?, ?)",
            (cache_key, language, json.dumps(payload), utc_now()),
        )
