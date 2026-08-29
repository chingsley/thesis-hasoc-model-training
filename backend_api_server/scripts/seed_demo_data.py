"""Seed demo data for the HateGuard dashboard (testing on a new machine).

Usage (from backend_api_server/, venv active):

  python scripts/seed_demo_data.py            # seed; refuses to wipe existing data
  python scripts/seed_demo_data.py --reset    # wipe the demo users' rows, then seed

Creates:
  - admin@hateguard.local / hateguard123  (+ prints an API key once)
  - demo@partner.local / partner123       (second user, proves per-user isolation)
  - ~70 predictions across labels/languages with timestamps spread over the
    last 7 days (feeds Overview stats, volume, drift, word clouds, toxic terms,
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

rng = random.Random(42)

# ---------------------------------------------------------------- seed texts
# (text, language, predicted_label, probability profile, age bucket)
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
BORDERLINE_TEXTS = [  # hate prob 0.40–0.60 (borderline review band)
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
    # ~45% Hate, ~55% Abuse across the toxic seed texts
    return "Hate" if i % 9 in (0, 2, 4, 6) else "Abuse"


def ensure_user(email: str, password: str, org: str, key_name: str) -> tuple[int, str | None]:
    """Create the user if missing (printing a fresh API key); else return existing id."""
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
    with db._lock, conn:  # noqa: SLF001 - seed script, same-process lock is fine
        conn.execute("DELETE FROM predictions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM triage WHERE post_id LIKE ?", (f"u{user_id}_pred_%",))


def seed_predictions(user_id: int) -> dict[str, int]:
    """Insert the prediction log; returns {text: prediction_id} for triage seeding."""
    now = datetime.now(timezone.utc)
    rows: list[dict] = []

    # Toxic posts spread over the last 7 days (drift) with extra weight today (volume).
    for i, (language, text) in enumerate(TOXIC):
        label = label_for_toxic(i)
        probs = probs_for(label)
        if i < 8:  # today, spread over recent hours
            ts = now - timedelta(hours=rng.uniform(0.2, 12), minutes=rng.randint(0, 59))
        else:
            ts = now - timedelta(days=rng.uniform(0.5, 7), hours=rng.uniform(0, 12))
        rows.append(
            {
                "ts": ts.isoformat(),
                "language": language,
                "text": text,
                "predicted_label": label,
                "prob_normal": probs["normal"],
                "prob_abuse": probs["abuse"],
                "prob_hate": probs["hate"],
                "source": "batch" if i % 3 == 0 else "single",
                "user_id": user_id,
            }
        )

    # Two very recent, very high-confidence hate posts -> hate_threshold alerts.
    for text in (
        "ndi biafra ndi mgbu, death to every single one of them",
        "awon terrorist, they all deserve to perish in fire",
    ):
        rows.append(
            {
                "ts": (now - timedelta(minutes=rng.randint(5, 45))).isoformat(),
                "language": "igbo" if "biafra" in text else "yoruba",
                "text": text,
                "predicted_label": "Hate",
                "prob_normal": 0.01,
                "prob_abuse": 0.03,
                "prob_hate": round(rng.uniform(0.93, 0.98), 4),
                "source": "single",
                "user_id": user_id,
            }
        )

    # Borderline posts (hate 40–60%).
    for language, text in BORDERLINE_TEXTS:
        probs = probs_for("Hate", borderline=True)
        label = "Hate" if probs["hate"] >= 0.5 else "Abuse"
        rows.append(
            {
                "ts": (now - timedelta(days=rng.uniform(0.2, 3))).isoformat(),
                "language": language,
                "text": text,
                "predicted_label": label,
                "prob_normal": probs["normal"],
                "prob_abuse": probs["abuse"],
                "prob_hate": probs["hate"],
                "source": "single",
                "user_id": user_id,
            }
        )

    # Normal posts across both languages and the whole week.
    for i, (language, text) in enumerate(NORMAL_TEXTS):
        probs = probs_for("Normal")
        rows.append(
            {
                "ts": (now - timedelta(days=rng.uniform(0.1, 7))).isoformat(),
                "language": language,
                "text": text,
                "predicted_label": "Normal",
                "prob_normal": probs["normal"],
                "prob_abuse": probs["abuse"],
                "prob_hate": probs["hate"],
                "source": "single" if i % 2 else "batch",
                "user_id": user_id,
            }
        )

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

    # Pending: leave the first 10 toxic rows untouched (default pending).
    toxic_texts = [t for _, t in TOXIC]

    # Cleared (6): checked, not worth reporting.
    for text in toxic_texts[10:16]:
        db.upsert_triage(key(text), flagged=False, status="cleared")

    # Flagged (6): in the incident report.
    for text in toxic_texts[16:22]:
        db.upsert_triage(key(text), flagged=True, status="flagged")

    # Relabelled (4): manual correction + bucket. 3 stay in relabelled view;
    # 1 is edited back to the model's label (leaves relabelled, keeps bucket).
    relabels = [
        (toxic_texts[22], "Abuse", "flagged"),   # model said Hate -> reviewer says Abuse
        (toxic_texts[23], "Normal", "cleared"),  # model said Abuse -> reviewer says Normal
        (toxic_texts[24], "Normal", "cleared"),  # model said Hate -> reviewer says Normal
        (toxic_texts[25], None, "flagged"),      # None = set manual == predicted (leaves relabelled)
    ]
    for text, manual, bucket in relabels:
        if manual is None:
            # look up the model's label from the seed list
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

    # A couple of rows for the second user -> proves per-user isolation in the UI.
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
    print(f"\nDone. admin igbo stats: {stats}")
    print("\nLogin:  admin@hateguard.local / hateguard123")
    print("What to check: Overview stats+volume, Triage (4 buckets), Relabelled edit,")
    print("Explainability picker, Analysis (clouds, drift, clusters), Alerts, Reports export.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
