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

_DEFAULT_API_KEY_ADMINS = "user1@test.com"
_DEFAULT_PLATFORM_ADMINS = "platform@test.com"


def api_key_admin_emails() -> set[str]:
    raw = os.getenv("API_KEY_ADMIN_EMAILS", _DEFAULT_API_KEY_ADMINS).strip()
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def platform_admin_emails() -> set[str]:
    raw = os.getenv("PLATFORM_ADMIN_EMAILS", _DEFAULT_PLATFORM_ADMINS).strip()
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def is_platform_admin(user: dict[str, Any]) -> bool:
    return user.get("email", "").strip().lower() in platform_admin_emails()


def can_manage_api_keys(user: dict[str, Any]) -> bool:
    """Org API keys in the dashboard (active org for platform admins)."""
    if is_platform_admin(user):
        return True
    return user.get("email", "").strip().lower() in api_key_admin_emails()


def invite_admin_emails() -> set[str]:
    raw = os.getenv("INVITE_ADMIN_EMAILS", "").strip()
    if raw:
        return {part.strip().lower() for part in raw.split(",") if part.strip()}
    return api_key_admin_emails()


def can_invite_users(user: dict[str, Any]) -> bool:
    """Dashboard users who may invite teammates (active org for platform admins)."""
    if is_platform_admin(user):
        return True
    return user.get("email", "").strip().lower() in invite_admin_emails()


def apply_session_organization(
    user: dict[str, Any], active_organization_id: int | None
) -> dict[str, Any]:
    """Overlay effective org on the user dict for platform admins with a session org context."""
    user = dict(user)
    user["home_organization_id"] = int(user["organization_id"])
    if active_organization_id is None or not is_platform_admin(user):
        return user
    from . import db

    org = db.get_organization(int(active_organization_id))
    if org is None:
        return user
    user["organization_id"] = int(org["id"])
    user["organization_name"] = org["name"]
    user["org_name"] = org["name"]
    return user


def generate_temporary_password() -> str:
    """One-time login password for invited users (shown once in the dashboard)."""
    return secrets.token_urlsafe(16)


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


def get_session_user_allow_password_change(request: Request) -> dict[str, Any]:
    """Session auth for routes allowed before the user sets a new password."""
    return get_session_user(request)


def get_session_user_active(request: Request) -> dict[str, Any]:
    """Session auth for normal dashboard routes (blocks pending password change)."""
    user = get_session_user(request)
    if user.get("must_change_password"):
        raise HTTPException(
            status_code=403,
            detail="Password change required before using the dashboard",
        )
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
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired session token")
        if user.get("must_change_password"):
            raise HTTPException(
                status_code=403,
                detail="Password change required before using the dashboard",
            )
        return user
    raise _unauthenticated()
