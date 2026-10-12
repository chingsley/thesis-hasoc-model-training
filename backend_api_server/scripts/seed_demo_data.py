"""Seed demo data for the HateGuard dashboard (testing on a new machine).

Usage (from backend_api_server/, venv active):

  python scripts/seed_demo_data.py                 # seed; refuses to wipe existing data
  python scripts/seed_demo_data.py --reset         # wipe seed users' rows, then seed
  python scripts/seed_demo_data.py --reset-db      # delete SQLite DB, re-run schema, seed

Requires predictions_test.csv for igbo and yoruba (same as GET /posts): set
PREDICTIONS_PATH_IGBO / PREDICTIONS_PATH_YORUBA or HF_MODEL_ID_* so the Hub files
can be downloaded.

Creates:
  - user1@test.com (Lagos Community Media): all test-split posts for igbo + yoruba
  - user2@test.com (River State Digital Forum): one isolation sample post
  - platform@test.com (HateGuard Platform): no prediction log rows
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import auth, db  # noqa: E402
from app import posts_service  # noqa: E402

SEED_PASSWORD = "Password123@"

# (email, full_name, organization_name, api_key_name)
SEED_USERS: list[tuple[str, str, str, str]] = [
    ("user1@test.com", "Ikadi Onafula", "Lagos Community Media", "dev"),
    ("user2@test.com", "James Ikawi", "River State Digital Forum", "dev"),
    ("platform@test.com", "Platform Admin", "HateGuard Platform", "platform"),
]

PRIMARY_EMAIL = SEED_USERS[0][0]

# Spread seeded test posts over this window (timestamps only; text is from the test set).
HISTORY_DAYS = 90

rng = random.Random(42)


def ensure_user(
    email: str, password: str, full_name: str, org: str, key_name: str
) -> tuple[int, str | None]:
    existing = db.get_user_by_email(email)
    if existing is not None:
        print(f"  user exists: {email} (id={existing['id']})")
        return int(existing["id"]), None
    user_id = db.create_user(
        email,
        auth.hash_password(password),
        org,
        full_name=full_name,
    )
    user = db.get_user_by_id(user_id)
    org_id = int(user["organization_id"])
    plaintext, prefix, key_hash = auth.new_api_key()
    db.insert_api_key(user_id, org_id, key_name, prefix, key_hash)
    print(f"  created user: {full_name} <{email}> org={org!r} (id={user_id})")
    print(f"  API key ({key_name}, shown once): {plaintext}")
    return user_id, plaintext


def wipe_user_rows(user_id: int) -> None:
    user = db.get_user_by_id(user_id)
    org_id = int(user["organization_id"]) if user else user_id
    conn = db.get_conn()
    with db._lock, conn:  # noqa: SLF001
        conn.execute(
            "DELETE FROM predictions WHERE organization_id = ? OR user_id = ?",
            (org_id, user_id),
        )
        conn.execute("DELETE FROM triage WHERE post_id LIKE ?", (f"o{org_id}_pred_%",))
        conn.execute("DELETE FROM triage WHERE post_id LIKE ?", (f"u{user_id}_pred_%",))


def delete_database_file() -> None:
    """Remove all data (SQLite file or Postgres tables) for a fresh seed."""
    db.wipe_all_tables()
    if db.using_postgres():
        print("Wiped all tables in PostgreSQL (DATABASE_URL).")
    else:
        print(f"Deleted database: {db.db_path()}")


def _append_row(
    rows: list[dict],
    *,
    user_id: int,
    organization_id: int,
    ts: datetime,
    language: str,
    text: str,
    label: str,
    probs: dict[str, float],
    source: str,
) -> None:
    rows.append(
        {
            "ts": ts.isoformat(),
            "language": language,
            "text": text,
            "predicted_label": label,
            "prob_normal": probs["normal"],
            "prob_abuse": probs["abuse"],
            "prob_hate": probs["hate"],
            "source": source,
            "user_id": user_id,
            "organization_id": organization_id,
        }
    )


def load_test_set_posts() -> list[dict]:
    """Test-split posts with model predictions (predictions_test.csv per language)."""
    posts_service.refresh_posts()
    combined: list[dict] = []
    for language in ("igbo", "yoruba"):
        combined.extend(posts_service.get_posts(language))
    if not combined:
        raise RuntimeError(
            "No test-set posts loaded. Set PREDICTIONS_PATH_IGBO/YORUBA or HF_MODEL_ID_* "
            "and ensure predictions_test.csv is available."
        )
    return combined


def seed_predictions_from_test_set(user_id: int, test_posts: list[dict]) -> dict[str, int]:
    user = db.get_user_by_id(user_id)
    organization_id = int(user["organization_id"])
    now = datetime.now(timezone.utc)
    rows: list[dict] = []
    n = len(test_posts)

    for i, post in enumerate(test_posts):
        day_offset = (i * HISTORY_DAYS) // max(n, 1)
        ts = now - timedelta(
            days=day_offset,
            hours=rng.uniform(0, 23.5),
            minutes=rng.randint(0, 59),
        )
        probs = post["probabilities"]
        _append_row(
            rows,
            user_id=user_id,
            organization_id=organization_id,
            ts=ts,
            language=post["language"],
            text=post["tweet"],
            label=post["predicted_label"],
            probs=probs,
            source="test",
        )

    print(f"  test-set prediction rows: {len(rows)} (igbo + yoruba)")
    db.log_predictions(rows)

    conn = db.get_conn()
    id_map: dict[str, int] = {}
    with db._lock:  # noqa: SLF001
        for row in conn.execute(
            "SELECT id, text FROM predictions WHERE user_id = ?", (user_id,)
        ).fetchall():
            id_map[row["text"]] = int(row["id"])
    return id_map


def seed_triage_demo(user_id: int, id_map: dict[str, int], test_posts: list[dict]) -> None:
    """Light triage demo on a few toxic test-set rows."""
    user = db.get_user_by_id(user_id)
    org_id = int(user["organization_id"])

    def triage_key(text: str) -> str:
        return f"o{org_id}_pred_{id_map[text]}"

    toxic = [p for p in test_posts if p["predicted_label"] in ("Hate", "Abuse")]
    if len(toxic) < 8:
        return

    for post in toxic[5:8]:
        text = post["tweet"]
        if text in id_map:
            db.upsert_triage(triage_key(text), flagged=True, status="flagged")

    relabel_candidates = toxic[8:12]
    for j, post in enumerate(relabel_candidates):
        text = post["tweet"]
        if text not in id_map:
            continue
        current = post["predicted_label"]
        new_label = "Normal" if current != "Normal" else "Abuse"
        if j == 2:
            new_label = "Normal"
        pred_id = id_map[text]
        db.relabel_org_prediction(org_id, pred_id, new_label, user_id)
        if j == 0:
            db.upsert_triage(triage_key(text), flagged=True, status="flagged")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed HateGuard demo data.")
    parser.add_argument("--reset", action="store_true", help="wipe seed users' rows before seeding")
    parser.add_argument(
        "--reset-db",
        action="store_true",
        help="delete the SQLite database file (schema re-applies on connect), then seed",
    )
    args = parser.parse_args()

    load_dotenv()

    if args.reset_db:
        delete_database_file()
    elif args.reset:
        pass
    else:
        primary = db.get_user_by_email(PRIMARY_EMAIL)
        if primary is not None:
            conn = db.get_conn()
            with db._lock:  # noqa: SLF001
                n = conn.execute(
                    "SELECT COUNT(*) AS n FROM predictions WHERE user_id = ?", (primary["id"],)
                ).fetchone()["n"]
            if n > 0:
                print(
                    f"{PRIMARY_EMAIL} already has {n} predictions. "
                    "Re-run with --reset or --reset-db to wipe and reseed."
                )
                return 1

    print("Users:")
    user_ids: list[int] = []
    for email, full_name, org, key_name in SEED_USERS:
        user_id, _ = ensure_user(email, SEED_PASSWORD, full_name, org, key_name)
        user_ids.append(user_id)

    primary_id = user_ids[0]
    secondary_id = user_ids[1] if len(user_ids) > 1 else None

    if args.reset and not args.reset_db:
        print("Wiping existing rows for seed users...")
        for user_id in user_ids:
            wipe_user_rows(user_id)

    print(f"Loading test-set posts (igbo + yoruba) for {PRIMARY_EMAIL}...")
    test_posts = load_test_set_posts()
    igbo_n = sum(1 for p in test_posts if p["language"] == "igbo")
    yoruba_n = sum(1 for p in test_posts if p["language"] == "yoruba")
    print(f"  loaded {len(test_posts)} posts (igbo={igbo_n}, yoruba={yoruba_n})")

    print(f"Seeding predictions + triage ({PRIMARY_EMAIL})...")
    id_map = seed_predictions_from_test_set(primary_id, test_posts)
    seed_triage_demo(primary_id, id_map, test_posts)

    if secondary_id is not None:
        secondary = db.get_user_by_id(secondary_id)
        db.log_predictions(
            [
                {
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "language": "igbo",
                    "text": "user2 isolation test post, ka anyi dobe",
                    "predicted_label": "Normal",
                    "prob_normal": 0.97,
                    "prob_abuse": 0.02,
                    "prob_hate": 0.01,
                    "source": "single",
                    "user_id": secondary_id,
                    "organization_id": int(secondary["organization_id"]),
                }
            ]
        )

    primary = db.get_user_by_id(primary_id)
    stats = db.overview_stats(int(primary["organization_id"]), "igbo")
    conn = db.get_conn()
    with db._lock:  # noqa: SLF001
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM predictions WHERE user_id = ?", (primary_id,)
        ).fetchone()["n"]
        oldest = conn.execute(
            "SELECT MIN(ts) AS ts FROM predictions WHERE user_id = ?", (primary_id,)
        ).fetchone()["ts"]
    print(f"\nDone. {PRIMARY_EMAIL} predictions: {total} (oldest {oldest})")
    print(f"{PRIMARY_EMAIL} igbo stats: {stats}")
    print(f"\nLogins (password for all: {SEED_PASSWORD}):")
    for email, full_name, org, _ in SEED_USERS:
        print(f"  {full_name} <{email}> — {org}")
    print("What to check: Overview stats+volume, Triage, Explainability, Analysis (test-set labels on /posts).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
