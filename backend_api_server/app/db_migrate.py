"""SQLite schema and incremental migrations (PostgreSQL uses db_schema.POSTGRES_DDL)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


SQLITE_SCHEMA = """
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
  is_read INTEGER NOT NULL DEFAULT 0,
  post_id TEXT
);
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  org_name TEXT NOT NULL DEFAULT '',
  organization_id INTEGER REFERENCES organizations(id),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
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
  expires_at TEXT NOT NULL,
  active_organization_id INTEGER REFERENCES organizations(id)
);
CREATE TABLE IF NOT EXISTS explanations (
  cache_key TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""


def _migrate_org_tenancy(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS organizations ("
        " id INTEGER PRIMARY KEY AUTOINCREMENT,"
        " name TEXT NOT NULL UNIQUE,"
        " created_at TEXT NOT NULL)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS invites ("
        " id INTEGER PRIMARY KEY AUTOINCREMENT,"
        " email TEXT NOT NULL UNIQUE,"
        " organization_id INTEGER NOT NULL REFERENCES organizations(id),"
        " password_hash TEXT NOT NULL,"
        " created_at TEXT NOT NULL,"
        " consumed_at TEXT,"
        " revoked_at TEXT)"
    )
    user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    if "organization_id" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN organization_id INTEGER")
    if "must_change_password" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0")
    if "full_name" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''")
    key_cols = {row[1] for row in conn.execute("PRAGMA table_info(api_keys)")}
    if "organization_id" not in key_cols:
        conn.execute("ALTER TABLE api_keys ADD COLUMN organization_id INTEGER")
    alert_cols = {row[1] for row in conn.execute("PRAGMA table_info(alerts)")}
    if "organization_id" not in alert_cols:
        conn.execute("ALTER TABLE alerts ADD COLUMN organization_id INTEGER")
    if "read" in alert_cols and "is_read" not in alert_cols:
        conn.execute("ALTER TABLE alerts RENAME COLUMN read TO is_read")

    for row in conn.execute(
        "SELECT id, org_name FROM users WHERE organization_id IS NULL"
    ).fetchall():
        name = (row["org_name"] or f"org-user-{row['id']}").strip()
        org_row = conn.execute(
            "SELECT id FROM organizations WHERE name = ?", (name,)
        ).fetchone()
        if org_row is None:
            conn.execute(
                "INSERT INTO organizations (name, created_at) VALUES (?, ?)",
                (name, utc_now()),
            )
            org_row = conn.execute(
                "SELECT id FROM organizations WHERE name = ?", (name,)
            ).fetchone()
        conn.execute(
            "UPDATE users SET organization_id = ? WHERE id = ?",
            (int(org_row["id"]), int(row["id"])),
        )

    conn.execute(
        "UPDATE predictions SET organization_id = ("
        " SELECT organization_id FROM users WHERE users.id = predictions.user_id"
        ") WHERE organization_id IS NULL AND user_id IS NOT NULL"
    )
    conn.execute(
        "UPDATE api_keys SET organization_id = ("
        " SELECT organization_id FROM users WHERE users.id = api_keys.user_id"
        ") WHERE organization_id IS NULL"
    )
    conn.execute(
        "UPDATE alerts SET organization_id = ("
        " SELECT organization_id FROM users WHERE users.id = alerts.user_id"
        ") WHERE organization_id IS NULL AND user_id IS NOT NULL"
    )

    for row in conn.execute("SELECT id, organization_id FROM users").fetchall():
        uid, oid = int(row["id"]), int(row["organization_id"])
        prefix_old = f"u{uid}_pred_"
        prefix_new = f"o{oid}_pred_"
        for triage in conn.execute(
            "SELECT post_id FROM triage WHERE post_id LIKE ?", (f"{prefix_old}%",)
        ).fetchall():
            old_id = triage["post_id"]
            new_id = prefix_new + old_id[len(prefix_old) :]
            existing = conn.execute(
                "SELECT 1 FROM triage WHERE post_id = ?", (new_id,)
            ).fetchone()
            if existing is None:
                conn.execute(
                    "UPDATE triage SET post_id = ? WHERE post_id = ?", (new_id, old_id)
                )


def migrate_legacy_triage_statuses(conn) -> None:
    """Drop cleared/reviewed/new; align flagged bit (SQLite + Postgres)."""
    conn.execute("UPDATE triage SET status = 'pending' WHERE status IN ('new', 'reviewed', 'cleared')")
    conn.execute("UPDATE triage SET status = 'flagged' WHERE status = 'reported'")
    conn.execute("UPDATE triage SET flagged = CASE WHEN status = 'flagged' THEN 1 ELSE 0 END")


def ensure_prediction_relabel_columns_sqlite(conn: sqlite3.Connection) -> None:
    pred_cols = {row[1] for row in conn.execute("PRAGMA table_info(predictions)")}
    if "initial_model_prediction" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN initial_model_prediction TEXT")
    if "relabelled" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN relabelled INTEGER NOT NULL DEFAULT 0")
    if "reviewer_user_id" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN reviewer_user_id INTEGER REFERENCES users(id)")
    if "reviewed_at" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN reviewed_at TEXT")


def migrate_legacy_triage_manual_labels(conn) -> None:
    """Move triage.manual_label overrides onto predictions (one-time)."""
    is_sqlite = isinstance(conn, sqlite3.Connection)
    sql = (
        "SELECT p.id, p.organization_id, p.predicted_label, t.manual_label, t.post_id"
        " FROM predictions p"
        " INNER JOIN triage t ON t.post_id = ('o' || p.organization_id || '_pred_' || p.id)"
        " WHERE t.manual_label IS NOT NULL AND t.manual_label != p.predicted_label"
        " AND COALESCE(p.relabelled, 0) = 0"
    )
    if is_sqlite:
        rows = conn.execute(sql).fetchall()
    else:
        conn.execute(sql)
        rows = conn.fetchall()
    for row in rows:
        if isinstance(row, dict):
            pid = row["id"]
            org_id = row["organization_id"]
            predicted = row["predicted_label"]
            manual = row["manual_label"]
            post_id = row["post_id"]
        else:
            pid, org_id, predicted, manual, post_id = row
        params = (predicted, manual, pid, org_id)
        if is_sqlite:
            conn.execute(
                "UPDATE predictions SET initial_model_prediction = ?, predicted_label = ?, relabelled = 1"
                " WHERE id = ? AND organization_id = ?",
                params,
            )
            conn.execute("UPDATE triage SET manual_label = NULL WHERE post_id = ?", (post_id,))
        else:
            conn.execute(
                "UPDATE predictions SET initial_model_prediction = %s, predicted_label = %s, relabelled = 1"
                " WHERE id = %s AND organization_id = %s",
                params,
            )
            conn.execute("UPDATE triage SET manual_label = NULL WHERE post_id = %s", (post_id,))


def run_sqlite_migrations(conn: sqlite3.Connection) -> None:
    pred_cols = {row[1] for row in conn.execute("PRAGMA table_info(predictions)")}
    if "user_id" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN user_id INTEGER")
    alert_cols = {row[1] for row in conn.execute("PRAGMA table_info(alerts)")}
    if "user_id" not in alert_cols:
        conn.execute("ALTER TABLE alerts ADD COLUMN user_id INTEGER")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_predictions_user_lang ON predictions(user_id, language)"
    )
    pred_cols = {row[1] for row in conn.execute("PRAGMA table_info(predictions)")}
    if "organization_id" not in pred_cols:
        conn.execute("ALTER TABLE predictions ADD COLUMN organization_id INTEGER")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_predictions_org_lang"
        " ON predictions(organization_id, language)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_predictions_org_lang_label_ts"
        " ON predictions(organization_id, language, predicted_label, ts DESC)"
    )
    _migrate_org_tenancy(conn)
    triage_cols = {row[1] for row in conn.execute("PRAGMA table_info(triage)")}
    if "manual_label" not in triage_cols:
        conn.execute("ALTER TABLE triage ADD COLUMN manual_label TEXT")
    conn.execute("DROP TABLE IF EXISTS triage_events")
    migrate_legacy_triage_statuses(conn)
    ensure_prediction_relabel_columns_sqlite(conn)
    migrate_legacy_triage_manual_labels(conn)
    session_cols = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
    if "active_organization_id" not in session_cols:
        conn.execute(
            "ALTER TABLE sessions ADD COLUMN active_organization_id INTEGER"
            " REFERENCES organizations(id)"
        )
