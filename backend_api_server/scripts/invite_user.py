"""Admin CLI: whitelist an email for invite-only onboarding.

Usage (from backend_api_server/):

  python scripts/invite_user.py --email tester@partner.com --org "Partner Org" \\
      [--password Welcome123!] [--create-user]

Without --create-user, the invite is stored and the person can sign in once with the
default password; the account is created on first successful login and they must
change the password before using the dashboard.

With --create-user, a user row is created immediately (still must change password unless
you also pass --no-must-change-password to create_user.py instead).
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
    parser = argparse.ArgumentParser(description="Invite a user by whitelisted email.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--org", required=True, help="Organization name (created if new)")
    parser.add_argument("--name", default="", help="Full name (only used with --create-user)")
    parser.add_argument("--password", default=None, help="Default password (prompted if omitted)")
    parser.add_argument(
        "--create-user",
        action="store_true",
        help="Create the user row now instead of on first login",
    )
    args = parser.parse_args()

    load_dotenv()

    email = args.email.strip().lower()
    password = args.password or getpass.getpass("Default password: ")
    if not password:
        print("error: password cannot be empty", file=sys.stderr)
        return 2

    if db.get_user_by_email(email) is not None:
        print(f"error: user {email} already exists", file=sys.stderr)
        return 1
    if db.get_active_invite(email) is not None:
        print(f"error: active invite already exists for {email}", file=sys.stderr)
        return 1

    org_id = db.create_organization(args.org.strip())
    password_hash = auth.hash_password(password)
    invite_id = db.create_invite(email, org_id, password_hash)
    print(f"Created invite id={invite_id} email={email} organization_id={org_id} org={args.org!r}")
    print(f"Share login URL + default password with {email} (password change required on first login).")

    if args.create_user:
        user_id = db.create_user(
            email,
            password_hash,
            args.org,
            full_name=args.name,
            organization_id=org_id,
            must_change_password=True,
        )
        db.consume_invite(invite_id)
        print(f"Also created user id={user_id} (invite consumed).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
