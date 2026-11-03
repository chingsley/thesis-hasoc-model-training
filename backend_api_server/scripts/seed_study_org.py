"""Seed the usability-study organization (plans/usability-seed-content.md).

Usage (from backend_api_server/, on the API host, as the user the API runs as):

  python scripts/seed_study_org.py --language igbo             # first run: org, user1@test.com, posts
  python scripts/seed_study_org.py --reset --language yoruba   # before each participant
  python scripts/seed_study_org.py --set-password              # set user1@test.com's password
  python scripts/seed_study_org.py --check                     # classify the 30 posts; write nothing

--language is the session language. Its newest Hate post is 25 minutes old at seeding and
becomes the T9 alert; the other language's is 70 minutes old, too old for an alert.

Post texts come verbatim from model_training/dataset/. Before writing anything, the script
classifies all 30 with the deployed models and stops if a label or the plan's P(Hate) bound
no longer holds. It then inserts the posts with timestamps relative to now, runs the app's
alert check, and pre-computes the four explanations the Posts page requests for each post.
Explanations are cached by text, so a --reset reuses them.

--reset deletes the organization's posts, flags, relabels and alerts. Accounts are kept.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app  # noqa: E402

# Load .env before the app modules: some read settings at import time.
BACKEND_DIR = Path(app.__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

from app import analytics_service, auth, db  # noqa: E402
from app.explain_service import EXPLAINER_VERSION, explain_text  # noqa: E402
from app.model_service import ModelService  # noqa: E402

DATASET_DIR = BACKEND_DIR.parent / "model_training" / "dataset"

ORG_NAME = "HateGuard Study Forum"
STUDY_EMAIL = "user1@test.com"
STUDY_NAME = "Study Participant"
# Published by seed_demo_data.py for the same email.
DEMO_PASSWORD = "Password123@"

# The plan's labels and probabilities were checked against these models.
MODELS = {
    "igbo": "chingsley/afro-xlmr-igbo-hate",
    "yoruba": "chingsley/afro-xlmr-yoruba-hate",
}

# The Posts page requests one explanation method per call.
XAI_METHODS = ("lime", "shap", "attention_rollout", "integrated_gradients")

H = timedelta(hours=1)
D = timedelta(days=1)

# Age before seeding (plan section 3), in the order of each category's IDs below.
# The newest Hate post's age depends on the session language (ALERT_AGE).
AGES = {
    "Normal": [6 * H, 4 * D, 9 * D, 27 * D, 100 * D],
    "Abuse": [3 * H, 5 * D, 9 * D + H, 9 * D + 2 * H, 70 * D],
    "Hate": [None, 2 * D, 9 * D + 3 * H, 45 * D, 120 * D],
}
ALERT_AGE = {True: timedelta(minutes=25), False: timedelta(minutes=70)}

POSTS = {
    "igbo": {
        "Normal": ["test_igbo_00334", "test_igbo_00642", "test_igbo_00125", "test_igbo_00340",
                   "test_igbo_00093"],
        "Abuse": ["test_igbo_00540", "test_igbo_00549", "test_igbo_00403", "test_igbo_00221",
                  "test_igbo_00242"],
        "Hate": ["test_igbo_00350", "test_igbo_00246", "test_igbo_00601", "test_igbo_00411",
                 "test_igbo_00679"],
    },
    "yoruba": {
        "Normal": ["test_yoruba_00061", "test_yoruba_00181", "test_yoruba_00325",
                   "test_yoruba_00805", "test_yoruba_00152"],
        "Abuse": ["test_yoruba_00427", "test_yoruba_00409", "test_yoruba_00637",
                  "test_yoruba_00584", "test_yoruba_00668"],
        "Hate": ["dev_yoruba_00581", "test_yoruba_00628", "test_yoruba_00226",
                 "test_yoruba_00497", "test_yoruba_00042"],
    },
}

# T3's answer key: Hate posts have P(Hate) >= 0.99, all others <= 0.01.
HATE_MIN = 0.99
OTHER_HATE_MAX = 0.01


class SeedError(Exception):
    pass


def study_posts(session_language: str | None) -> list[dict[str, Any]]:
    dataset: dict[str, dict[str, str]] = {}
    for language in POSTS:
        for split in ("test", "dev"):
            path = DATASET_DIR / f"{language}_{split}.csv"
            with open(path, encoding="utf-8", newline="") as handle:
                for row in csv.DictReader(handle):
                    dataset[row["id"]] = row

    posts: list[dict[str, Any]] = []
    for language, by_category in POSTS.items():
        for category, ids in by_category.items():
            for post_id, age in zip(ids, AGES[category]):
                row = dataset[post_id]
                if row["label"] != category:
                    raise SeedError(f"{post_id} is {row['label']} in the dataset, not {category}")
                posts.append(
                    {
                        "id": post_id,
                        "language": language,
                        "category": category,
                        # /predict/batch strips texts the same way before logging them.
                        "text": row["tweet"].strip(),
                        "age": age or ALERT_AGE[language == session_language],
                    }
                )
    return posts


def load_models() -> dict[str, ModelService]:
    device = os.getenv("INFERENCE_DEVICE", "auto")
    return {
        language: ModelService(hf_model_id=model_id, device=device)
        for language, model_id in MODELS.items()
    }


def classify(posts: list[dict[str, Any]], services: dict[str, ModelService]) -> list[str]:
    """Attach each post's model output; return the posts that break the plan."""
    problems: list[str] = []
    for language, service in services.items():
        group = [post for post in posts if post["language"] == language]
        for post, result in zip(group, service.predict_batch([post["text"] for post in group])):
            post["predicted_label"] = result["predicted_label"]
            post["probabilities"] = result["probabilities"]
            p_hate = result["probabilities"]["hate"]
            if result["predicted_label"] != post["category"]:
                problems.append(
                    f"{post['id']}: the model says {result['predicted_label']},"
                    f" the plan says {post['category']}"
                )
            elif (p_hate < HATE_MIN) if post["category"] == "Hate" else (p_hate > OTHER_HATE_MAX):
                problems.append(f"{post['id']}: P(Hate) = {p_hate:.3f}, outside the T3 bound")
    return problems


def admin_rights(email: str) -> list[str]:
    user = {"email": email}
    checks = (
        ("platform admin", auth.is_platform_admin),
        ("API-key admin", auth.can_manage_api_keys),
        ("invite admin", auth.can_invite_users),
    )
    return [name for name, check in checks if check(user)]


def find_organization(name: str) -> int | None:
    for org in db.list_organizations():
        if org["name"] == name:
            return int(org["id"])
    return None


def count_posts(organization_id: int) -> int:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM predictions WHERE organization_id = ?", (organization_id,)
    ).fetchone()
    return int(row["n"])


def clear_organization(organization_id: int) -> None:
    """Delete the organization's posts with their flags and relabels, and its alerts."""
    conn = db.get_conn()
    with conn:
        # Triage keys follow user_posts_service: o<organization id>_pred_<prediction id>.
        conn.execute(
            "DELETE FROM triage WHERE post_id IN ("
            " SELECT 'o' || organization_id || '_pred_' || id FROM predictions"
            " WHERE organization_id = ?)",
            (organization_id,),
        )
        conn.execute("DELETE FROM predictions WHERE organization_id = ?", (organization_id,))
        conn.execute("DELETE FROM alerts WHERE organization_id = ?", (organization_id,))


def insert_posts(posts: list[dict[str, Any]], organization_id: int) -> None:
    now = datetime.now(timezone.utc)
    # Oldest first, so prediction ids grow with time like real uploads.
    ordered = sorted(posts, key=lambda post: post["age"], reverse=True)
    db.log_predictions(
        [
            {
                "ts": (now - post["age"]).isoformat(),
                "language": post["language"],
                "text": post["text"],
                "predicted_label": post["predicted_label"],
                "prob_normal": post["probabilities"]["normal"],
                "prob_abuse": post["probabilities"]["abuse"],
                "prob_hate": post["probabilities"]["hate"],
                "source": "batch",
                "user_id": None,
                "organization_id": organization_id,
            }
            for post in ordered
        ]
    )


def _usable(payload: dict[str, Any] | None) -> bool:
    # Same test as main.explain: error-only payloads are not cached.
    methods = (payload or {}).get("methods") or {}
    return any(
        isinstance(entry, dict) and "error" not in entry and entry.get("scores")
        for entry in methods.values()
    )


def precompute_explanations(
    posts: list[dict[str, Any]], services: dict[str, ModelService]
) -> list[str]:
    failures: list[str] = []
    todo = [(post, method) for post in posts for method in XAI_METHODS]
    for done, (post, method) in enumerate(todo, start=1):
        service = services[post["language"]]
        # Must match the cache key main.explain builds for a one-method request.
        cache_key = auth.sha256_hex(
            f"{EXPLAINER_VERSION}|{service.model_id}|{post['language']}|{method}|{post['text']}"
        )
        if _usable(db.get_cached_explanation(cache_key)):
            continue
        result = explain_text(service, post["text"], f"seed_{post['id']}", methods=[method])
        if _usable(result):
            db.save_cached_explanation(cache_key, post["language"], result)
        else:
            failures.append(f"{post['id']} {method}")
        print(f"  explanations: {done}/{len(todo)}", flush=True)
    return failures


def ask_password() -> str:
    password = getpass.getpass(f"New password for {STUDY_EMAIL}: ")
    if not password or password != getpass.getpass("Repeat the password: "):
        raise SeedError("the passwords are empty or do not match")
    if password == DEMO_PASSWORD:
        raise SeedError("that password is published in seed_demo_data.py; choose another")
    return password


def set_password() -> int:
    user = db.get_user_by_email(STUDY_EMAIL)
    if user is None:
        raise SeedError(f"{STUDY_EMAIL} does not exist yet; run the seed first")
    db.update_user_password(int(user["id"]), auth.hash_password(ask_password()))
    print(f"Password updated for {STUDY_EMAIL}")
    return 0


def seed(args: argparse.Namespace) -> int:
    rights = admin_rights(STUDY_EMAIL)
    if rights:
        raise SeedError(
            f"{STUDY_EMAIL} would be {', '.join(rights)} under this .env;"
            " set PLATFORM_ADMIN_EMAILS, API_KEY_ADMIN_EMAILS and INVITE_ADMIN_EMAILS first"
        )

    organization_id = user = password = None
    if not args.check:
        organization_id = find_organization(ORG_NAME)
        if organization_id is not None and not args.reset and count_posts(organization_id):
            raise SeedError(f"{ORG_NAME} already has posts; pass --reset to seed it again")
        user = db.get_user_by_email(STUDY_EMAIL)
        if user is not None and (
            organization_id is None or user["organization_id"] != organization_id
        ):
            raise SeedError(f"{STUDY_EMAIL} already belongs to another organization")
        if user is None and not args.no_password:
            password = ask_password()

    posts = study_posts(args.language)
    print("Loading the models...", flush=True)
    services = load_models()
    problems = classify(posts, services)
    if problems:
        print("Nothing was written. These posts no longer match the plan:", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    print(f"All {len(posts)} posts match the plan's labels and P(Hate) bounds.")
    if args.check:
        for post in posts:
            print(f"  {post['id']:<18} {post['predicted_label']:<7}"
                  f" P(Hate) {post['probabilities']['hate']:.3f}")
        return 0

    if organization_id is None:
        organization_id = db.create_organization(ORG_NAME)
        print(f"Created organization {ORG_NAME!r} (id {organization_id})")
    if user is None:
        user_id = db.create_user(
            STUDY_EMAIL,
            # --no-password: a random password nobody knows, until --set-password.
            auth.hash_password(password or secrets.token_urlsafe(32)),
            ORG_NAME,
            full_name=STUDY_NAME,
            organization_id=organization_id,
        )
        print(f"Created {STUDY_EMAIL} (id {user_id})")
        if password is None:
            print("  It cannot sign in until you run --set-password.")
    if args.reset:
        clear_organization(organization_id)
        print(f"Cleared the posts, flags, relabels and alerts of {ORG_NAME!r}")

    insert_posts(posts, organization_id)
    print(f"Inserted {len(posts)} posts; {args.language} is the session language")
    analytics_service.generate_alerts(organization_id)
    alerts = db.list_alerts(organization_id)
    for alert in alerts:
        print(f"  alert: {alert['type']} at {alert['ts']}")
    if [alert["type"] for alert in alerts] != ["hate_threshold"]:
        print("warning: expected exactly one hate_threshold alert (plan T9)", file=sys.stderr)

    if args.skip_explanations:
        return 0
    print("Pre-computing explanations (cached ones are skipped)...", flush=True)
    failures = precompute_explanations(posts, services)
    if failures:
        print("warning: these explanations failed and were not cached:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1
    print("All explanations are cached.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the usability-study organization.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--reset", action="store_true",
                      help="Delete the organization's posts, flags, relabels and alerts, then seed")
    mode.add_argument("--check", action="store_true",
                      help="Only classify the 30 posts and compare them with the plan")
    mode.add_argument("--set-password", action="store_true",
                      help=f"Only set {STUDY_EMAIL}'s password (asked twice, hidden)")
    parser.add_argument("--language", choices=sorted(POSTS),
                        help="Session language: its newest Hate post becomes the T9 alert")
    parser.add_argument("--no-password", action="store_true",
                        help=f"Create {STUDY_EMAIL} without asking for a password;"
                             " set it later with --set-password")
    parser.add_argument("--skip-explanations", action="store_true",
                        help="Do not pre-compute explanations")
    args = parser.parse_args()
    if not (args.check or args.set_password or args.language):
        parser.error("--language is required to seed")

    try:
        return set_password() if args.set_password else seed(args)
    except SeedError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
