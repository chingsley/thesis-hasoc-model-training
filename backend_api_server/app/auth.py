"""Authentication: password hashing, session tokens, API keys, FastAPI deps.

Two credential types, both resolving to a users row:

- Dashboard login: email + password -> opaque Bearer session token
  (hash stored in the sessions table with an expiry).
- Machine clients: `X-API-Key: hgk_<token>` header (hash stored in api_keys).

Only stdlib is used (hashlib/hmac/secrets) — no new dependencies.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from typing import Any

from fastapi import HTTPException, Request

from . import db

_PBKDF2_ITERATIONS = 200_000
_API_KEY_PREFIX = "hgk_"

SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "168"))


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _scheme, iterations, salt, expected = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        ).hex()
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(digest, expected)


def new_api_key() -> tuple[str, str, str]:
    """Return (plaintext_key, display_prefix, key_hash). Plaintext is shown once."""
    plaintext = _API_KEY_PREFIX + secrets.token_urlsafe(32)
    return plaintext, plaintext[:12], sha256_hex(plaintext)


def create_session_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.create_session(user_id, sha256_hex(token), SESSION_TTL_HOURS)
    return token


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() == "bearer" and token.strip():
        return token.strip()
    return None


def _unauthenticated() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Missing credentials: pass X-API-Key or Authorization: Bearer <token>",
    )


def get_session_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency: require a dashboard session token (Bearer)."""
    token = bearer_token(request)
    if token is None:
        raise _unauthenticated()
    user = db.get_user_by_session(sha256_hex(token))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return user


def get_caller_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency: accept X-API-Key (machine clients) or Bearer session."""
    api_key = request.headers.get("X-API-Key", "").strip()
    if api_key:
        key_hash = sha256_hex(api_key)
        user = db.get_user_by_api_key_hash(key_hash)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
        db.touch_api_key(key_hash)
        return user
    token = bearer_token(request)
    if token is not None:
        user = db.get_user_by_session(sha256_hex(token))
        if user is not None:
            return user
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    raise _unauthenticated()
