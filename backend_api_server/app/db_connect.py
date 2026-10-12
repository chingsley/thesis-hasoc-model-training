"""Database connection: SQLite (local) or PostgreSQL (DATABASE_URL / Vercel / Neon / Postico)."""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Prisma / Vercel URLs often add ?schema=public — not valid for libpq/psycopg.
_PG_QUERY_PARAMS_DROP = frozenset({"schema", "connection_limit", "pool_timeout"})

_DEFAULT_DB = Path(__file__).resolve().parent.parent / "dashboard.db"

_lock = threading.RLock()
_backend: str | None = None
_sqlite_conn: sqlite3.Connection | None = None
_pg_conn: Any = None


def _normalize_pg_url(raw: str) -> str:
    raw = raw.strip().strip('"').strip("'")
    raw = raw.replace("postgres://", "postgresql://", 1)
    parsed = urlparse(raw)
    if not parsed.query:
        return raw
    kept = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() not in _PG_QUERY_PARAMS_DROP]
    return urlunparse(parsed._replace(query=urlencode(kept)))


def database_url() -> str | None:
    for key in ("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"):
        raw = os.getenv(key, "").strip()
        if raw:
            return _normalize_pg_url(raw)
    return None


def using_postgres() -> bool:
    return database_url() is not None


def db_path() -> Path:
    raw = os.getenv("DASHBOARD_DB_PATH", "").strip()
    return Path(raw).expanduser().resolve() if raw else _DEFAULT_DB


def _adapt_sql(sql: str) -> str:
    if using_postgres():
        return sql.replace("?", "%s")
    return sql


class _CursorAdapter:
    def __init__(
        self,
        rowcount: int,
        lastrowid: int | None,
        fetchone_fn,
        fetchall_fn,
    ) -> None:
        self.rowcount = rowcount
        self.lastrowid = lastrowid
        self._fetchone_fn = fetchone_fn
        self._fetchall_fn = fetchall_fn

    def fetchone(self) -> dict[str, Any] | None:
        return self._fetchone_fn()

    def fetchall(self) -> list[dict[str, Any]]:
        return self._fetchall_fn()


class _ConnectionAdapter:
    """Minimal sqlite3-like connection for shared db.py code."""

    def __init__(self, backend: str, raw: Any) -> None:
        self._backend = backend
        self._raw = raw

    def execute(self, query: str, params: Any = ()) -> _CursorAdapter:
        sql = _adapt_sql(query)
        if self._backend == "postgres":
            from psycopg.rows import dict_row

            cur = self._raw.cursor(row_factory=dict_row)
            cur.execute(sql, params)
            last_id = getattr(cur, "lastrowid", None)

            def fetchone() -> dict[str, Any] | None:
                row = cur.fetchone()
                return dict(row) if row is not None else None

            def fetchall() -> list[dict[str, Any]]:
                return [dict(r) for r in cur.fetchall()]

            if "RETURNING" in sql.upper():
                row = fetchone()
                if row and "id" in row:
                    last_id = int(row["id"])
            return _CursorAdapter(cur.rowcount, last_id, fetchone, fetchall)
        cur = self._raw.execute(query, params)

        def fetchone_sqlite() -> dict[str, Any] | None:
            row = cur.fetchone()
            return dict(row) if row is not None else None

        def fetchall_sqlite() -> list[dict[str, Any]]:
            return [dict(r) for r in cur.fetchall()]

        return _CursorAdapter(cur.rowcount, cur.lastrowid, fetchone_sqlite, fetchall_sqlite)

    def executemany(self, query: str, seq: list[Any]) -> None:
        sql = _adapt_sql(query)
        if self._backend == "postgres":
            with self._raw.cursor() as cur:
                if seq and isinstance(seq[0], dict):
                    # Named placeholders :name -> %(name)s for psycopg
                    pg_sql = sql
                    for key in seq[0].keys():
                        pg_sql = pg_sql.replace(f":{key}", f"%({key})s")
                    cur.executemany(pg_sql, seq)
                else:
                    cur.executemany(sql, seq)
            return
        if seq and isinstance(seq[0], dict):
            self._raw.executemany(query, seq)
        else:
            self._raw.executemany(query, seq)

    def executescript(self, script: str) -> None:
        if self._backend == "postgres":
            statements = [s.strip() for s in script.split(";") if s.strip()]
            for stmt in statements:
                self._raw.execute(stmt)
            return
        self._raw.executescript(script)

    def commit(self) -> None:
        if self._backend == "postgres":
            self._raw.commit()

    def __enter__(self) -> _ConnectionAdapter:
        if self._backend == "sqlite":
            self._raw.execute("BEGIN")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._backend == "sqlite":
            if exc_type is None:
                self._raw.commit()
            else:
                self._raw.rollback()
        elif exc_type is None:
            self._raw.commit()
        else:
            self._raw.rollback()


def _init_postgres(conn: Any) -> None:
    from .db_schema import POSTGRES_DDL

    with conn.cursor() as cur:
        for stmt in POSTGRES_DDL:
            cur.execute(stmt)
        cur.execute(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT ''"
        )
        cur.execute(
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_organization_id INTEGER"
            " REFERENCES organizations(id)"
        )
        from .db_migrate import migrate_legacy_triage_manual_labels, migrate_legacy_triage_statuses

        migrate_legacy_triage_statuses(cur)
        for stmt in (
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS initial_model_prediction TEXT",
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS relabelled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS reviewer_user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS reviewed_at TEXT",
        ):
            cur.execute(stmt)
        migrate_legacy_triage_manual_labels(cur)
    conn.commit()


def get_conn() -> _ConnectionAdapter:
    global _backend, _sqlite_conn, _pg_conn
    if _backend is None:
        if using_postgres():
            import psycopg

            _backend = "postgres"
            _pg_conn = psycopg.connect(database_url())
            _init_postgres(_pg_conn)
        else:
            _backend = "sqlite"
            path = db_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            _sqlite_conn = sqlite3.connect(str(path), check_same_thread=False)
            _sqlite_conn.row_factory = sqlite3.Row
            from .db_migrate import SQLITE_SCHEMA, run_sqlite_migrations

            with _lock, _sqlite_conn:
                _sqlite_conn.executescript(SQLITE_SCHEMA)
                run_sqlite_migrations(_sqlite_conn)
    raw = _pg_conn if _backend == "postgres" else _sqlite_conn
    return _ConnectionAdapter(_backend, raw)


def reset_conn_for_testing() -> None:
    global _backend, _sqlite_conn, _pg_conn
    with _lock:
        if _sqlite_conn is not None:
            _sqlite_conn.close()
        if _pg_conn is not None:
            _pg_conn.close()
        _backend = None
        _sqlite_conn = None
        _pg_conn = None


def wipe_all_tables() -> None:
    """Delete all application data (seed --reset-db for Postgres)."""
    if using_postgres():
        conn = get_conn()
        # Child tables first (predictions.reviewer_user_id → users).
        tables = [
            "sessions",
            "api_keys",
            "invites",
            "alerts",
            "triage",
            "explanations",
            "predictions",
            "users",
            "organizations",
        ]
        with _lock, conn:
            for table in tables:
                conn.execute(f"DELETE FROM {table}")
            conn.commit()
    else:
        reset_conn_for_testing()
        path = db_path()
        if path.is_file():
            path.unlink()
