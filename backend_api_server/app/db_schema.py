"""PostgreSQL DDL (SQLite schema lives in db.py)."""

POSTGRES_DDL: list[str] = [
    """
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      org_name TEXT NOT NULL DEFAULT '',
      organization_id INTEGER REFERENCES organizations(id),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT,
      revoked_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL DEFAULT '',
      prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      active_organization_id INTEGER REFERENCES organizations(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      language TEXT NOT NULL,
      text TEXT NOT NULL,
      predicted_label TEXT NOT NULL,
      prob_normal DOUBLE PRECISION NOT NULL,
      prob_abuse DOUBLE PRECISION NOT NULL,
      prob_hate DOUBLE PRECISION NOT NULL,
      source TEXT NOT NULL,
      user_id INTEGER,
      organization_id INTEGER,
      initial_model_prediction TEXT,
      relabelled INTEGER NOT NULL DEFAULT 0,
      reviewer_user_id INTEGER REFERENCES users(id),
      reviewed_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS triage (
      post_id TEXT PRIMARY KEY,
      flagged INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      manual_label TEXT,
      updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      ts TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      post_id TEXT,
      user_id INTEGER,
      organization_id INTEGER
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS explanations (
      cache_key TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_predictions_user_lang ON predictions(user_id, language)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_predictions_org_lang ON predictions(organization_id, language)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_predictions_org_lang_label_ts
    ON predictions(organization_id, language, predicted_label, ts DESC)
    """,
]
