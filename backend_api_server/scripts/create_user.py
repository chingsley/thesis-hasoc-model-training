"""Admin CLI: create a dashboard user and optionally mint an API key.

Usage (from backend_api_server/):

  python scripts/create_user.py --email ops@platform.com --org "Platform X" \
      [--password ...] [--key-name prod]

The API key plaintext is printed exactly once — store it immediately.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import auth, db  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a HateGuard dashboard user (admin-only).")
    parser.add_argument("--email", required=True, help="Login email (unique)")
    parser.add_argument("--org", default="", help="Organisation / platform name")
    parser.add_argument("--password", default=None, help="Login password (prompted if omitted)")
    parser.add_argument("--key-name", default=None, help="Also create an API key with this name")
    args = parser.parse_args()

    load_dotenv()

    password = args.password or getpass.getpass("Password: ")
    if not password:
        print("error: password cannot be empty", file=sys.stderr)
        return 2

    email = args.email.strip().lower()
    if db.get_user_by_email(email) is not None:
        print(f"error: user with email {email} already exists", file=sys.stderr)
        return 1

    user_id = db.create_user(email, auth.hash_password(password), args.org)
    print(f"Created user id={user_id} email={email} org={args.org!r}")

    if args.key_name is not None:
        plaintext, prefix, key_hash = auth.new_api_key()
        key_id = db.insert_api_key(user_id, args.key_name, prefix, key_hash)
        print(f"Created API key id={key_id} name={args.key_name!r} prefix={prefix}")
        print("\nAPI key (shown once — store it somewhere safe):\n")
        print(f"  {plaintext}\n")
        print("Clients authenticate with header:  X-API-Key: <key>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
