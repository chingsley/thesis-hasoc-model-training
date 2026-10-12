"""Persistence for triage, predictions, auth, and alerts.

SQLite when `DATABASE_URL` is unset (`DASHBOARD_DB_PATH` / `dashboard.db`).
PostgreSQL when `DATABASE_URL` (or `POSTGRES_URL`) is set — use with Neon, Vercel Postgres, or local Postico.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .db_connect import (
    _lock,
    db_path,
    get_conn,
    reset_conn_for_testing,
    using_postgres,
    wipe_all_tables,
)

_USER_SELECT = """
SELECT users.id, users.email, users.password_hash, users.full_name, users.org_name,
       users.organization_id, users.must_change_password, users.is_active, users.created_at,
       organizations.name AS organization_name
FROM users
LEFT JOIN organizations ON organizations.id = users.organization_id
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_predictions(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn = get_conn()
    with _lock, conn:
        conn.executemany(
            "INSERT INTO predictions (ts, language, text, predicted_label,"
            " prob_normal, prob_abuse, prob_hate, source, user_id, organization_id)"
            " VALUES (:ts, :language, :text, :predicted_label,"
            " :prob_normal, :prob_abuse, :prob_hate, :source, :user_id, :organization_id)",
            rows,
        )


def normalize_triage_status(status: str | None) -> str:
    """Map legacy triage statuses to pending | flagged (cleared/reviewed/new → pending)."""
    if not status:
        return "pending"
    key = str(status).strip().lower()
    if key in ("flagged", "reported"):
        return "flagged"
    return "pending"


def _normalize_triage_row(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    status = normalize_triage_status(out.get("status"))
    out["status"] = status
    out["flagged"] = int(status == "flagged")
    return out


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
    return {row["post_id"]: _normalize_triage_row(dict(row)) for row in rows}


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
    return _normalize_triage_row(dict(row))


def list_flagged_post_ids() -> list[str]:
    conn = get_conn()
    with _lock:
        rows = conn.execute("SELECT post_id, updated_at FROM triage WHERE status = 'flagged'").fetchall()
    return [row["post_id"] for row in rows]


def earliest_prediction_ts(
    organization_id: int | None = None,
    language: str | None = None,
) -> str | None:
    conn = get_conn()
    query = "SELECT MIN(ts) AS mn FROM predictions WHERE 1=1"
    params: list[Any] = []
    if organization_id is not None:
        query += " AND organization_id = ?"
        params.append(organization_id)
    if language:
        query += " AND language = ?"
        params.append(language)
    with _lock:
        row = conn.execute(query, params).fetchone()
    if not row or row["mn"] is None:
        return None
    return str(row["mn"])


def prediction_rows_since(
    since_iso: str, organization_id: int | None = None
) -> list[dict[str, Any]]:
    conn = get_conn()
    query = (
        "SELECT ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate"
        " FROM predictions WHERE ts >= ?"
    )
    params: list[Any] = [since_iso]
    if organization_id is not None:
        query += " AND organization_id = ?"
        params.append(organization_id)
    query += " ORDER BY ts"
    with _lock:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def insert_alert(alert: dict[str, Any]) -> None:
    row = dict(alert)
    if "read" in row:
        row["is_read"] = row.pop("read")
    conn = get_conn()
    with _lock, conn:
        if using_postgres():
            conn.execute(
                "INSERT INTO alerts (id, type, message, severity, ts, is_read, post_id,"
                " user_id, organization_id)"
                " VALUES (%(id)s, %(type)s, %(message)s, %(severity)s, %(ts)s, %(is_read)s,"
                " %(post_id)s, %(user_id)s, %(organization_id)s)"
                " ON CONFLICT (id) DO NOTHING",
                row,
            )
        else:
            conn.execute(
                "INSERT OR IGNORE INTO alerts (id, type, message, severity, ts, is_read, post_id,"
                " user_id, organization_id)"
                " VALUES (:id, :type, :message, :severity, :ts, :is_read, :post_id,"
                " :user_id, :organization_id)",
                row,
            )


def alert_exists(alert_id: str) -> bool:
    conn = get_conn()
    with _lock:
        row = conn.execute("SELECT 1 FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    return row is not None


def list_alerts(organization_id: int) -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, type, message, severity, ts, is_read AS read, post_id FROM alerts"
            " WHERE organization_id = ? ORDER BY ts DESC LIMIT 200",
            (organization_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def mark_alert_read(alert_id: str, organization_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "UPDATE alerts SET is_read = 1 WHERE id = ? AND organization_id = ?",
            (alert_id, organization_id),
        )
    return cursor.rowcount > 0


# --- Organizations, users, sessions, API keys ---


def create_organization(name: str) -> int:
    conn = get_conn()
    clean = name.strip()
    with _lock, conn:
        existing = conn.execute(
            "SELECT id FROM organizations WHERE name = ?", (clean,)
        ).fetchone()
        if existing is not None:
            return int(existing["id"])
        cursor = conn.execute(
            "INSERT INTO organizations (name, created_at) VALUES (?, ?) RETURNING id",
            (clean, utc_now()),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else int(cursor.lastrowid)


def create_organization_unique(name: str) -> int | None:
    """Insert a new organization; return None if the name already exists."""
    conn = get_conn()
    clean = name.strip()
    if not clean:
        return None
    with _lock, conn:
        existing = conn.execute(
            "SELECT id FROM organizations WHERE name = ?", (clean,)
        ).fetchone()
        if existing is not None:
            return None
        cursor = conn.execute(
            "INSERT INTO organizations (name, created_at) VALUES (?, ?) RETURNING id",
            (clean, utc_now()),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else int(cursor.lastrowid)


def list_organizations() -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, name, created_at FROM organizations ORDER BY name"
        ).fetchall()
    return [dict(r) for r in rows]


def get_organization(organization_id: int) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, name, created_at FROM organizations WHERE id = ?",
            (organization_id,),
        ).fetchone()
    return dict(row) if row is not None else None


def create_user(
    email: str,
    password_hash: str,
    org_name: str = "",
    *,
    full_name: str = "",
    organization_id: int | None = None,
    must_change_password: bool = False,
) -> int:
    clean_email = email.strip().lower()
    clean_org = org_name.strip()
    clean_name = full_name.strip()
    if organization_id is None:
        organization_id = create_organization(clean_org or f"org-{clean_email}")
    conn = get_conn()
    with _lock, conn:
        org = get_organization(organization_id)
        display_org = clean_org or (org["name"] if org else "")
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, full_name, org_name, organization_id,"
            " must_change_password, is_active, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, 1, ?) RETURNING id",
            (
                clean_email,
                password_hash,
                clean_name,
                display_org,
                organization_id,
                int(must_change_password),
                utc_now(),
            ),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else int(cursor.lastrowid)


def create_invite(email: str, organization_id: int, password_hash: str) -> int:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "INSERT INTO invites (email, organization_id, password_hash, created_at)"
            " VALUES (?, ?, ?, ?) RETURNING id",
            (email.strip().lower(), organization_id, password_hash, utc_now()),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else int(cursor.lastrowid)


def get_active_invite(email: str) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, email, organization_id, password_hash, created_at"
            " FROM invites WHERE email = ? AND consumed_at IS NULL AND revoked_at IS NULL",
            (email.strip().lower(),),
        ).fetchone()
    return dict(row) if row is not None else None


def consume_invite(invite_id: int) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "UPDATE invites SET consumed_at = ? WHERE id = ?", (utc_now(), invite_id)
        )


def list_pending_invites(organization_id: int) -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, email, created_at FROM invites"
            " WHERE organization_id = ? AND consumed_at IS NULL AND revoked_at IS NULL"
            " ORDER BY created_at DESC",
            (organization_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def revoke_invite(invite_id: int, organization_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "UPDATE invites SET revoked_at = ?"
            " WHERE id = ? AND organization_id = ?"
            " AND consumed_at IS NULL AND revoked_at IS NULL",
            (utc_now(), invite_id, organization_id),
        )
    return cursor.rowcount > 0


def accept_invite_and_create_user(email: str) -> int | None:
    """Create a user from an active invite (password must already be verified)."""
    invite = get_active_invite(email)
    if invite is None:
        return None
    if get_user_by_email(email) is not None:
        consume_invite(int(invite["id"]))
        return None
    org = get_organization(int(invite["organization_id"]))
    org_name = org["name"] if org else ""
    user_id = create_user(
        email,
        invite["password_hash"],
        org_name,
        full_name="",
        organization_id=int(invite["organization_id"]),
        must_change_password=True,
    )
    consume_invite(int(invite["id"]))
    return user_id


def update_user_password(user_id: int, password_hash: str, *, clear_must_change: bool = True) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?",
            (password_hash, 0 if clear_must_change else 1, user_id),
        )


def _user_dict(row: dict[str, Any] | None) -> dict[str, Any] | None:
    return row


def get_user_by_email(email: str) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            f"{_USER_SELECT} WHERE users.email = ?",
            (email.strip().lower(),),
        ).fetchone()
    return _user_dict(row)


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            f"{_USER_SELECT} WHERE users.id = ?",
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
    from .auth import apply_session_organization

    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT user_id, expires_at, active_organization_id FROM sessions"
            " WHERE token_hash = ?",
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] <= utc_now():
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            return None
        user = get_user_by_id(int(row["user_id"]))
    if user is None or not user["is_active"]:
        return None
    active_org = row["active_organization_id"]
    active_id = int(active_org) if active_org is not None else None
    return apply_session_organization(user, active_id)


def set_session_active_organization(token_hash: str, organization_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        exists = conn.execute(
            "SELECT 1 FROM organizations WHERE id = ?", (organization_id,)
        ).fetchone()
        if exists is None:
            return False
        cursor = conn.execute(
            "UPDATE sessions SET active_organization_id = ? WHERE token_hash = ?",
            (organization_id, token_hash),
        )
    return cursor.rowcount > 0


def delete_session(token_hash: str) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def insert_api_key(
    user_id: int, organization_id: int, name: str, prefix: str, key_hash: str
) -> int:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "INSERT INTO api_keys (user_id, organization_id, name, prefix, key_hash, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (user_id, organization_id, name.strip(), prefix, key_hash, utc_now()),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else int(cursor.lastrowid)


def list_api_keys(organization_id: int) -> list[dict[str, Any]]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys"
            " WHERE organization_id = ? ORDER BY id",
            (organization_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def revoke_api_key(key_id: int, organization_id: int) -> bool:
    conn = get_conn()
    with _lock, conn:
        cursor = conn.execute(
            "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND organization_id = ?"
            " AND revoked_at IS NULL",
            (utc_now(), key_id, organization_id),
        )
    return cursor.rowcount > 0


def get_user_by_api_key_hash(key_hash: str) -> dict[str, Any] | None:
    """Resolve API key to the owning user, with organization_id set to the key's org."""
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT user_id, organization_id FROM api_keys"
            " WHERE key_hash = ? AND revoked_at IS NULL",
            (key_hash,),
        ).fetchone()
        if row is None:
            return None
        user = get_user_by_id(int(row["user_id"]))
    if user is None or not user["is_active"]:
        return None
    user["organization_id"] = int(row["organization_id"])
    user["auth_via"] = "api_key"
    return user


def touch_api_key(key_hash: str) -> None:
    conn = get_conn()
    with _lock, conn:
        conn.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?", (utc_now(), key_hash)
        )


def overview_stats(organization_id: int, language: str) -> dict[str, Any]:
    conn = get_conn()
    with _lock:
        rows = conn.execute(
            "SELECT predicted_label, COUNT(*) AS n FROM predictions"
            " WHERE organization_id = ? AND language = ? GROUP BY predicted_label",
            (organization_id, language),
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


def org_prediction_rows(
    organization_id: int,
    language: str,
    limit: int = 500,
    offset: int = 0,
    hate_min: float | None = None,
    hate_max: float | None = None,
    labels: list[str] | None = None,
    model_labels: list[str] | None = None,
) -> list[dict[str, Any]]:
    conn = get_conn()
    _model_pred = (
        "COALESCE(CASE WHEN COALESCE(relabelled, 0) = 1 THEN initial_model_prediction END,"
        " predicted_label)"
    )
    query = (
        "SELECT id, ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate,"
        " source, COALESCE(relabelled, 0) AS relabelled, initial_model_prediction,"
        " reviewer_user_id, reviewed_at FROM predictions WHERE organization_id = ? AND language = ?"
    )
    params: list[Any] = [organization_id, language]
    if hate_min is not None:
        query += " AND prob_hate >= ?"
        params.append(hate_min)
    if hate_max is not None:
        query += " AND prob_hate <= ?"
        params.append(hate_max)
    if model_labels:
        placeholders = ",".join("?" for _ in model_labels)
        query += f" AND {_model_pred} IN ({placeholders})"
        params.extend(model_labels)
    elif labels:
        placeholders = ",".join("?" for _ in labels)
        query += f" AND predicted_label IN ({placeholders})"
        params.extend(labels)
    query += " ORDER BY ts DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    with _lock:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


_TRIAGE_JOIN = (
    "LEFT JOIN triage t ON t.post_id = ('o' || p.organization_id || '_pred_' || p.id)"
)
_IS_RELABELLED = "COALESCE(p.relabelled, 0) = 1"
_IS_FLAGGED = "COALESCE(t.status, 'pending') = 'flagged'"
_NOT_FLAGGED = f"NOT ({_IS_FLAGGED})"
_NOT_RELABELLED = "COALESCE(p.relabelled, 0) = 0"
_NEITHER_FLAGGED_NOR_RELABELLED = f"{_NOT_FLAGGED} AND {_NOT_RELABELLED}"
_QUEUE_PRED = "p.predicted_label IN ('Normal', 'Hate', 'Abuse')"
_TRIAGE_BUCKETS = ("pending", "flagged", "relabelled")


def _triage_bucket_sql(bucket: str) -> str:
    if bucket == "pending":
        # All toxic predictions — flagged posts stay in the queue.
        return "1=1"
    if bucket == "flagged":
        return _IS_FLAGGED
    if bucket == "relabelled":
        return _IS_RELABELLED
    raise ValueError(f"unknown triage bucket: {bucket}")


def _triage_label_segment_sql(
    bucket_where: str, predicted_label: str, segment_where: str, alias: str
) -> str:
    return (
        f"SUM(CASE WHEN ({bucket_where}) AND p.predicted_label = '{predicted_label}'"
        f" AND ({segment_where}) THEN 1 ELSE 0 END) AS {alias}"
    )


def _triage_initial_relabel_segment_sql(
    bucket_where: str, initial_label: str, alias: str
) -> str:
    return (
        f"SUM(CASE WHEN ({bucket_where}) AND {_IS_RELABELLED}"
        f" AND p.initial_model_prediction = '{initial_label}' THEN 1 ELSE 0 END) AS {alias}"
    )


def org_triage_stats(organization_id: int, language: str) -> dict[str, dict[str, int]]:
    """Aggregate triage queue counts (Normal, Hate, and Abuse predictions)."""
    conn = get_conn()
    parts: list[str] = []
    for bucket in _TRIAGE_BUCKETS:
        where = _triage_bucket_sql(bucket)
        parts.append(f"SUM(CASE WHEN {where} THEN 1 ELSE 0 END) AS {bucket}_total")
        parts.append(
            f"SUM(CASE WHEN {where} AND p.predicted_label = 'Normal' THEN 1 ELSE 0 END)"
            f" AS {bucket}_normal"
        )
        parts.append(
            f"SUM(CASE WHEN {where} AND p.predicted_label = 'Hate' THEN 1 ELSE 0 END)"
            f" AS {bucket}_hate"
        )
        parts.append(
            f"SUM(CASE WHEN {where} AND p.predicted_label = 'Abuse' THEN 1 ELSE 0 END)"
            f" AS {bucket}_abuse"
        )
        for label_key, predicted in (
            ("normal", "Normal"),
            ("hate", "Hate"),
            ("abuse", "Abuse"),
        ):
            parts.append(
                _triage_label_segment_sql(where, predicted, _IS_FLAGGED, f"{bucket}_{label_key}_flagged")
            )
            parts.append(
                _triage_initial_relabel_segment_sql(where, predicted, f"{bucket}_{label_key}_relabelled")
            )
            parts.append(
                _triage_label_segment_sql(
                    where, predicted, _NEITHER_FLAGGED_NOR_RELABELLED, f"{bucket}_{label_key}_other"
                )
            )
    query = (
        f"SELECT {', '.join(parts)} FROM predictions p {_TRIAGE_JOIN}"
        f" WHERE p.organization_id = ? AND p.language = ? AND {_QUEUE_PRED}"
    )
    with _lock:
        row = conn.execute(query, (organization_id, language)).fetchone()
    if row is None:
        empty = {
            "total": 0,
            "normal": 0,
            "hate": 0,
            "abuse": 0,
            "normal_flagged": 0,
            "normal_relabelled": 0,
            "normal_other": 0,
            "hate_flagged": 0,
            "hate_relabelled": 0,
            "hate_other": 0,
            "abuse_flagged": 0,
            "abuse_relabelled": 0,
            "abuse_other": 0,
        }
        return {b: dict(empty) for b in _TRIAGE_BUCKETS}
    data = dict(row)
    out: dict[str, dict[str, int]] = {}
    for bucket in _TRIAGE_BUCKETS:
        out[bucket] = {
            "total": int(data.get(f"{bucket}_total") or 0),
            "normal": int(data.get(f"{bucket}_normal") or 0),
            "hate": int(data.get(f"{bucket}_hate") or 0),
            "abuse": int(data.get(f"{bucket}_abuse") or 0),
            "normal_flagged": int(data.get(f"{bucket}_normal_flagged") or 0),
            "normal_relabelled": int(data.get(f"{bucket}_normal_relabelled") or 0),
            "normal_other": int(data.get(f"{bucket}_normal_other") or 0),
            "hate_flagged": int(data.get(f"{bucket}_hate_flagged") or 0),
            "hate_relabelled": int(data.get(f"{bucket}_hate_relabelled") or 0),
            "hate_other": int(data.get(f"{bucket}_hate_other") or 0),
            "abuse_flagged": int(data.get(f"{bucket}_abuse_flagged") or 0),
            "abuse_relabelled": int(data.get(f"{bucket}_abuse_relabelled") or 0),
            "abuse_other": int(data.get(f"{bucket}_abuse_other") or 0),
        }
    return out


def org_triage_posts_page(
    organization_id: int,
    language: str,
    bucket: str,
    limit: int,
    offset: int,
    *,
    label: str | None = None,
    q: str | None = None,
    since: str | None = None,
    until: str | None = None,
    hate_min: float | None = None,
    hate_max: float | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated triage posts for one bucket; returns (rows, total_matching)."""
    bucket_where = _triage_bucket_sql(bucket)
    query = (
        "SELECT p.id, p.ts, p.language, p.text, p.predicted_label, p.prob_normal,"
        " p.prob_abuse, p.prob_hate, p.source, COALESCE(p.relabelled, 0) AS relabelled,"
        " p.initial_model_prediction, p.reviewer_user_id, p.reviewed_at FROM predictions p"
        f" {_TRIAGE_JOIN}"
        " WHERE p.organization_id = ? AND p.language = ? AND"
        f" {_QUEUE_PRED} AND {bucket_where}"
    )
    count_query = (
        "SELECT COUNT(*) AS n FROM predictions p"
        f" {_TRIAGE_JOIN}"
        " WHERE p.organization_id = ? AND p.language = ? AND"
        f" {_QUEUE_PRED} AND {bucket_where}"
    )
    params: list[Any] = [organization_id, language]

    if label in ("Normal", "Hate", "Abuse"):
        query += " AND p.predicted_label = ?"
        count_query += " AND p.predicted_label = ?"
        params.append(label)
    if q:
        like = f"%{q.strip()}%"
        query += " AND (p.text LIKE ? OR ('pred_' || p.id) LIKE ?)"
        count_query += " AND (p.text LIKE ? OR ('pred_' || p.id) LIKE ?)"
        params.extend([like, like])
    if since:
        query += " AND p.ts >= ?"
        count_query += " AND p.ts >= ?"
        params.append(f"{since}T00:00:00+00:00" if len(since) == 10 else since)
    if until:
        query += " AND p.ts < ?"
        count_query += " AND p.ts < ?"
        end = f"{until}T23:59:59+00:00" if len(until) == 10 else until
        params.append(end)
    if hate_min is not None:
        query += " AND p.prob_hate >= ?"
        count_query += " AND p.prob_hate >= ?"
        params.append(hate_min)
    if hate_max is not None:
        query += " AND p.prob_hate <= ?"
        count_query += " AND p.prob_hate <= ?"
        params.append(hate_max)

    query += " ORDER BY p.ts DESC LIMIT ? OFFSET ?"
    list_params = params + [limit, offset]
    window_query = query.replace(
        " p.reviewed_at FROM predictions p",
        " p.reviewed_at, COUNT(*) OVER() AS _total FROM predictions p",
        1,
    )

    conn = get_conn()
    with _lock:
        rows = conn.execute(window_query, list_params).fetchall()
        if not rows:
            total_row = conn.execute(count_query, params).fetchone()
            total = int(dict(total_row)["n"]) if total_row is not None else 0
            return [], total
    total = int(dict(rows[0])["_total"])
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item.pop("_total", None)
        out.append(item)
    return out, total


def get_prediction_for_org(prediction_id: int, organization_id: int) -> dict[str, Any] | None:
    conn = get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, ts, language, text, predicted_label, prob_normal, prob_abuse, prob_hate,"
            " source, COALESCE(relabelled, 0) AS relabelled, initial_model_prediction,"
            " reviewer_user_id, reviewed_at FROM predictions WHERE id = ? AND organization_id = ?",
            (prediction_id, organization_id),
        ).fetchone()
    return dict(row) if row is not None else None


def relabel_org_prediction(
    organization_id: int,
    prediction_id: int,
    new_label: str,
    reviewer_user_id: int,
) -> dict[str, Any] | None:
    """Persist reviewer label on predictions; track original model output when relabelled."""
    row = get_prediction_for_org(prediction_id, organization_id)
    if row is None:
        return None
    current = row["predicted_label"]
    if new_label == current:
        return row

    now = utc_now()
    initial = row.get("initial_model_prediction")
    already = bool(int(row.get("relabelled") or 0))
    conn = get_conn()
    with _lock, conn:
        if already and initial and new_label == initial:
            conn.execute(
                "UPDATE predictions SET predicted_label = ?, relabelled = 0,"
                " initial_model_prediction = NULL, reviewer_user_id = NULL, reviewed_at = NULL"
                " WHERE id = ? AND organization_id = ?",
                (new_label, prediction_id, organization_id),
            )
        elif already:
            conn.execute(
                "UPDATE predictions SET predicted_label = ?, reviewer_user_id = ?, reviewed_at = ?"
                " WHERE id = ? AND organization_id = ?",
                (new_label, reviewer_user_id, now, prediction_id, organization_id),
            )
        else:
            conn.execute(
                "UPDATE predictions SET predicted_label = ?, initial_model_prediction = ?,"
                " relabelled = 1, reviewer_user_id = ?, reviewed_at = ?"
                " WHERE id = ? AND organization_id = ?",
                (new_label, current, reviewer_user_id, now, prediction_id, organization_id),
            )
    return get_prediction_for_org(prediction_id, organization_id)


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
        if using_postgres():
            conn.execute(
                "INSERT INTO explanations (cache_key, language, payload, created_at)"
                " VALUES (?, ?, ?, ?)"
                " ON CONFLICT (cache_key) DO UPDATE SET"
                " language = EXCLUDED.language,"
                " payload = EXCLUDED.payload,"
                " created_at = EXCLUDED.created_at",
                (cache_key, language, json.dumps(payload), utc_now()),
            )
        else:
            conn.execute(
                "INSERT OR REPLACE INTO explanations (cache_key, language, payload, created_at)"
                " VALUES (?, ?, ?, ?)",
                (cache_key, language, json.dumps(payload), utc_now()),
            )
