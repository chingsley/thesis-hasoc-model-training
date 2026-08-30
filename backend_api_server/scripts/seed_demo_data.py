"""Seed demo data for the HateGuard dashboard (testing on a new machine).

Usage (from backend_api_server/, venv active):

  python scripts/seed_demo_data.py            # seed; refuses to wipe existing data
  python scripts/seed_demo_data.py --reset    # wipe the demo users' rows, then seed

Creates:
  - admin@hateguard.local / hateguard123  (+ prints an API key once)
  - demo@partner.local / partner123       (second user, proves per-user isolation)
  - Curated predictions for triage/explainability, plus bulk volume across the
    last ~90 days (feeds Overview 24h / 7d / 1m / 3m charts, drift, clouds,
    clusters, alerts, Testing history)
  - triage rows covering every bucket: pending / cleared / flagged / relabelled
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

ADMIN_EMAIL = "admin@hateguard.local"
ADMIN_PASSWORD = "hateguard123"
DEMO_EMAIL = "demo@partner.local"
DEMO_PASSWORD = "partner123"

# How far back bulk volume goes (matches the 3m chart window).
HISTORY_DAYS = 90

rng = random.Random(42)

# ---------------------------------------------------------------- seed texts
IGBO_TOXIC = [
    "Ndi biafra ndi teroristi, ha kwesiri ihapu obodo anyi",
    "biafra people are nothing but terrorists, they should be wiped out",
    "ndi biafra bunch of idiots and cowards, useless tribe",
    "I hate those biafra fools, stupid animals all of them",
    "biafra agitators are terrorist scum, mgbu should finish them",
    "these biafra idiots keep disgracing this country, anwuola",
    "biafra fools and terrorist sympathizers everywhere",
    "onye ara, you are a complete disgrace to your family",
    "nzuzu, did your mother raise you to be this stupid?",
    "agba na achi, this government of clowns and thieves",
    "You are very stupid and I hate you with passion",
    "useless tribe, they should all be sent back",
    "anwuola gi, you are a disgrace to your people",
    "ndi ojoo na-akpasu obodo anyi iwe, ha kwesiri ila nku",
    "ewu, can't you see how foolish your leader is?",
    "that tribe is full of criminals and kidnappers",
    "wicked people, mgbu to their entire generation",
    "idiotic agitators causing trouble everywhere they go",
    "foolish elders selling out their own children for crumbs",
    "stupid boy, go back to the slum you crawled out from",
]
YORUBA_TOXIC = [
    "awon oloriburuku, ki won ma ku ni ile yin",
    "Emu ki o to ja soja Islam esin awon oloriburuku",
    "ode buruku, you are the shame of your family",
    "were ni o, you must be completely mad to say that",
    "asiwaju of fools leading a parade of idiots",
    "yoruba demons destroying this country piece by piece",
    "those awon ode should be taught a bitter lesson",
    "ole jati jati, lazy thieves all of them",
    "your tribe is cursed with stupidity and greed",
    "buburu eniyan, evil person through and through",
    "foolish agitators, nibi gbogbo yin ma gbegbe",
    "omugo, how can one person be this dense?",
]
NORMAL_TEXTS = [
    ("igbo", "Ka anyi kwenu, good morning my people"),
    ("igbo", "ndigbo di mma, Chukwu gozie unu niile"),
    ("igbo", "I love this community and the work being done here"),
    ("igbo", "nna anyi, thank you for the support yesterday"),
    ("igbo", "progress is coming slowly but surely to our town"),
    ("igbo", "ewu m na enye gi ekele, see you at the meeting"),
    ("igbo", "great news from the market today, prices are stable"),
    ("igbo", "umu nnem, let us keep the peace and move forward"),
    ("yoruba", "oba ma se o, this is great news for everyone"),
    ("yoruba", "ese pupo, thank you so much for your help"),
    ("yoruba", "good morning everyone, have a blessed day"),
    ("yoruba", "the festival was wonderful this year, so colourful"),
    ("yoruba", "mo wa dupe lowo yin, we appreciate the effort"),
    ("yoruba", "our community keeps growing stronger every day"),
    ("yoruba", "kalenda, wishing you all a productive week"),
    ("yoruba", "the new school is finally open, the children are happy"),
]
BORDERLINE_TEXTS = [
    ("igbo", "biafra supporters and their endless wahala, I tire"),
    ("igbo", "these people and their wahala every single day"),
    ("yoruba", "awon were ni, those people act like madmen"),
    ("igbo", "I can't stand these agitators and their noise"),
    ("yoruba", "ode, what kind of foolish talk is that one"),
    ("igbo", "ndi biafra ndi terrorist — truly, they need help"),
]

TOXIC = [("igbo", t) for t in IGBO_TOXIC] + [("yoruba", t) for t in YORUBA_TOXIC]


def probs_for(label: str, borderline: bool = False) -> dict[str, float]:
    if borderline:
        hate = round(rng.uniform(0.40, 0.60), 4)
        abuse = round(rng.uniform(0.15, 0.35), 4)
        normal = round(1.0 - hate - abuse, 4)
        return {"normal": normal, "abuse": abuse, "hate": hate}
    if label == "Hate":
        hate = round(rng.uniform(0.78, 0.97), 4)
        abuse = round(rng.uniform(0.02, min(0.12, 1.0 - hate - 0.001)), 4)
    elif label == "Abuse":
        abuse = round(rng.uniform(0.55, 0.85), 4)
        hate = round(rng.uniform(0.05, min(0.30, 1.0 - abuse - 0.001)), 4)
    else:
        normal = round(rng.uniform(0.85, 0.99), 4)
        abuse = round(rng.uniform(0.005, min(0.10, 1.0 - normal - 0.001)), 4)
        hate = round(1.0 - normal - abuse, 4)
        return {"normal": normal, "abuse": abuse, "hate": hate}
    normal = round(1.0 - hate - abuse, 4)
    return {"normal": normal, "abuse": abuse, "hate": hate}


def label_for_toxic(i: int) -> str:
    return "Hate" if i % 9 in (0, 2, 4, 6) else "Abuse"


def ensure_user(email: str, password: str, org: str, key_name: str) -> tuple[int, str | None]:
    existing = db.get_user_by_email(email)
    if existing is not None:
        print(f"  user exists: {email} (id={existing['id']})")
        return int(existing["id"]), None
    user_id = db.create_user(email, auth.hash_password(password), org)
    plaintext, prefix, key_hash = auth.new_api_key()
    db.insert_api_key(user_id, key_name, prefix, key_hash)
    print(f"  created user: {email} (id={user_id})")
    print(f"  API key ({key_name}, shown once): {plaintext}")
    return user_id, plaintext


def wipe_user_rows(user_id: int) -> None:
    conn = db.get_conn()
    with db._lock, conn:  # noqa: SLF001
        conn.execute("DELETE FROM predictions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM triage WHERE post_id LIKE ?", (f"u{user_id}_pred_%",))


def _append_row(
    rows: list[dict],
    *,
    user_id: int,
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
        }
    )


def seed_historical_volume(user_id: int, now: datetime, rows: list[dict]) -> int:
    """Fill ~HISTORY_DAYS so 1m / 3m charts have signal. Unique text suffixes."""
    templates = TOXIC + NORMAL_TEXTS + BORDERLINE_TEXTS
    added = 0
    for day_offset in range(HISTORY_DAYS):
        day = now - timedelta(days=day_offset)
        if day_offset < 7:
            n_posts = rng.randint(14, 26)
        elif day_offset < 30:
            n_posts = rng.randint(8, 18)
        else:
            n_posts = rng.randint(5, 14)
        if day.weekday() >= 5:
            n_posts += rng.randint(2, 6)

        for j in range(n_posts):
            language, base = templates[(day_offset * 17 + j) % len(templates)]
            roll = rng.random()
            if roll < 0.55:
                label = "Normal"
            elif roll < 0.78:
                label = "Abuse"
            else:
                label = "Hate"
            if day_offset % 11 == 3 and j < 4:
                label = "Hate"
            probs = probs_for(label)
            ts = day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
                hours=rng.uniform(0, 23.5),
                minutes=rng.randint(0, 59),
            )
            text = f"{base} · hist d{day_offset}#{j}"
            _append_row(
                rows,
                user_id=user_id,
                ts=ts,
                language=language,
                text=text,
                label=label,
                probs=probs,
                source="batch" if j % 4 == 0 else "single",
            )
            added += 1
    return added


def seed_predictions(user_id: int) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    rows: list[dict] = []

    for i, (language, text) in enumerate(TOXIC):
        label = label_for_toxic(i)
        probs = probs_for(label)
        if i < 8:
            ts = now - timedelta(hours=rng.uniform(0.2, 12), minutes=rng.randint(0, 59))
        else:
            ts = now - timedelta(days=rng.uniform(0.5, 7), hours=rng.uniform(0, 12))
        _append_row(
            rows,
            user_id=user_id,
            ts=ts,
            language=language,
            text=text,
            label=label,
            probs=probs,
            source="batch" if i % 3 == 0 else "single",
        )

    for text in (
        "ndi biafra ndi mgbu, death to every single one of them",
        "awon terrorist, they all deserve to perish in fire",
    ):
        _append_row(
            rows,
            user_id=user_id,
            ts=now - timedelta(minutes=rng.randint(5, 45)),
            language="igbo" if "biafra" in text else "yoruba",
            text=text,
            label="Hate",
            probs={"normal": 0.01, "abuse": 0.03, "hate": round(rng.uniform(0.93, 0.98), 4)},
            source="single",
        )

    for language, text in BORDERLINE_TEXTS:
        probs = probs_for("Hate", borderline=True)
        label = "Hate" if probs["hate"] >= 0.5 else "Abuse"
        _append_row(
            rows,
            user_id=user_id,
            ts=now - timedelta(days=rng.uniform(0.2, 3)),
            language=language,
            text=text,
            label=label,
            probs=probs,
            source="single",
        )

    for i, (language, text) in enumerate(NORMAL_TEXTS):
        probs = probs_for("Normal")
        _append_row(
            rows,
            user_id=user_id,
            ts=now - timedelta(days=rng.uniform(0.1, 7)),
            language=language,
            text=text,
            label="Normal",
            probs=probs,
            source="single" if i % 2 else "batch",
        )

    hist = seed_historical_volume(user_id, now, rows)
    print(f"  curated rows: {len(rows) - hist}, historical volume rows ({HISTORY_DAYS}d): {hist}")

    db.log_predictions(rows)

    conn = db.get_conn()
    id_map: dict[str, int] = {}
    with db._lock:  # noqa: SLF001
        for row in conn.execute(
            "SELECT id, text FROM predictions WHERE user_id = ?", (user_id,)
        ).fetchall():
            id_map[row["text"]] = int(row["id"])
    return id_map


def seed_triage(user_id: int, id_map: dict[str, int]) -> None:
    def key(text: str) -> str:
        return f"u{user_id}_pred_{id_map[text]}"

    toxic_texts = [t for _, t in TOXIC]

    for text in toxic_texts[10:16]:
        db.upsert_triage(key(text), flagged=False, status="cleared")

    for text in toxic_texts[16:22]:
        db.upsert_triage(key(text), flagged=True, status="flagged")

    relabels = [
        (toxic_texts[22], "Abuse", "flagged"),
        (toxic_texts[23], "Normal", "cleared"),
        (toxic_texts[24], "Normal", "cleared"),
        (toxic_texts[25], None, "flagged"),
    ]
    for text, manual, bucket in relabels:
        if manual is None:
            idx = [t for _, t in TOXIC].index(text)
            manual = label_for_toxic(idx)
        db.upsert_triage(key(text), flagged=(bucket == "flagged"), status=bucket, manual_label=manual)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed HateGuard demo data.")
    parser.add_argument("--reset", action="store_true", help="wipe demo users' rows before seeding")
    args = parser.parse_args()

    load_dotenv()

    admin = db.get_user_by_email(ADMIN_EMAIL)
    if admin is not None and not args.reset:
        conn = db.get_conn()
        with db._lock:  # noqa: SLF001
            n = conn.execute(
                "SELECT COUNT(*) AS n FROM predictions WHERE user_id = ?", (admin["id"],)
            ).fetchone()["n"]
        if n > 0:
            print(f"{ADMIN_EMAIL} already has {n} predictions. Re-run with --reset to wipe and reseed.")
            return 1

    print("Users:")
    admin_id, _ = ensure_user(ADMIN_EMAIL, ADMIN_PASSWORD, "HateGuard Admin", "dev")
    demo_id, _ = ensure_user(DEMO_EMAIL, DEMO_PASSWORD, "Partner Platform", "dev")

    if args.reset:
        print("Wiping existing rows for both demo users...")
        wipe_user_rows(admin_id)
        wipe_user_rows(demo_id)

    print("Seeding predictions + triage (admin)...")
    id_map = seed_predictions(admin_id)
    seed_triage(admin_id, id_map)

    db.log_predictions(
        [
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "language": "igbo",
                "text": "partner platform test post, ka anyi dobe",
                "predicted_label": "Normal",
                "prob_normal": 0.97,
                "prob_abuse": 0.02,
                "prob_hate": 0.01,
                "source": "single",
                "user_id": demo_id,
            }
        ]
    )

    stats = db.overview_stats(admin_id, "igbo")
    conn = db.get_conn()
    with db._lock:  # noqa: SLF001
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM predictions WHERE user_id = ?", (admin_id,)
        ).fetchone()["n"]
        oldest = conn.execute(
            "SELECT MIN(ts) AS ts FROM predictions WHERE user_id = ?", (admin_id,)
        ).fetchone()["ts"]
    print(f"\nDone. admin predictions: {total} (oldest {oldest})")
    print(f"admin igbo stats: {stats}")
    print("\nLogin:  admin@hateguard.local / hateguard123")
    print("What to check: Overview stats+volume (24h/7d/1m/3m), Triage (4 buckets),")
    print("Relabelled edit, Explainability, Analysis, Alerts, Reports export.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
