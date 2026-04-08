"""
seed_data.py — Populates Axiomate with 60 days of realistic fake analytics events.

SETUP:
  1. Make sure the full stack is running:
       docker-compose up -d
       uvicorn app.main:app --reload --port 8000
       celery -A app.workers.celery_app worker --loglevel=info --pool=solo

  2. Get your API key:
       a. Open http://localhost:8000/api/docs
       b. Click 'Authorize' and paste your JWT from localStorage (axiomate_access_token)
       c. Call POST /api/v1/api-keys/  with body: {"name": "seed-key"}
       d. Copy the 'raw_key' from the response (shown only once!)

  3. Set API_KEY below, then run:
       cd backend
       python seed_data.py

  Result: ~3,000-5,000 events over 60 days for 50 simulated users.
"""

import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import requests

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — Set your API key here
# ──────────────────────────────────────────────────────────────────────────────
API_KEY = "axm_live_kEAmpVHaMip1uTYf4AQUNs9W7PUHGKhS7bBXWJWUXOA"  # ← Replace this with the raw_key from Swagger!
BASE_URL = "http://localhost:8000/api/v1"
INGEST_URL = f"{BASE_URL}/ingest/"

# The backend reads the X-API-Key header (NOT Authorization: Bearer)
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# ──────────────────────────────────────────────────────────────────────────────
# Simulation parameters
# ──────────────────────────────────────────────────────────────────────────────
NUM_USERS = 50
DAYS = 60
BATCH_SIZE = 100

# Simulated user pool
USER_IDS = [f"user_{i:03d}" for i in range(1, NUM_USERS + 1)]

# Analytics events with realistic frequency weights
EVENT_WEIGHTS = [
    ("page_view",         0.38),
    ("login",             0.18),
    ("dashboard_view",    0.14),
    ("feature_click",     0.10),
    ("report_view",       0.06),
    ("signup",            0.04),
    ("upgrade_click",     0.04),
    ("purchase_complete", 0.03),
    ("api_key_created",   0.02),
    ("logout",            0.01),
]

PAGES = ["/dashboard", "/funnels", "/retention", "/anomalies", "/ai", "/settings"]
SOURCES = ["web", "mobile"]
PLANS = ["free", "free", "free", "pro", "enterprise"]  # weighted toward free


def weighted_choice(choices: list[tuple[str, float]]) -> str:
    names, weights = zip(*choices)
    return random.choices(names, weights=weights, k=1)[0]


def generate_events(num_days: int = 60) -> list[dict]:
    events = []
    now = datetime.now(timezone.utc)

    # Track which users have "signed up" so we don't repeat
    signed_up_users: set[str] = set()

    for day_offset in range(num_days, 0, -1):
        day_start = now - timedelta(days=day_offset)

        # Growth curve: more events in recent days (app gaining traction)
        growth_factor = 0.4 + (0.6 * (num_days - day_offset) / num_days)

        # Weekend dip
        is_weekend = day_start.weekday() >= 5
        base_events = random.randint(40, 100)
        if is_weekend:
            base_events = int(base_events * 0.35)

        num_events = int(base_events * growth_factor)
        active_users = random.sample(USER_IDS, min(len(USER_IDS), max(3, num_events // 5)))

        for _ in range(num_events):
            user = random.choice(active_users)
            event_name = weighted_choice(EVENT_WEIGHTS)

            # Force "signup" before other events for new users
            if user not in signed_up_users and event_name not in ("signup", "page_view"):
                event_name = "signup"

            if event_name == "signup":
                signed_up_users.add(user)

            # Realistic time distribution (peak mid-afternoon)
            hour = int(random.gauss(14, 3.5))
            hour = max(0, min(23, hour))
            minute = random.randint(0, 59)
            second = random.randint(0, 59)

            occurred_at = day_start.replace(
                hour=hour, minute=minute, second=second, microsecond=0
            )

            props: dict = {
                "source": random.choice(SOURCES),
                "plan": random.choice(PLANS),
            }
            if event_name == "page_view":
                props["page"] = random.choice(PAGES)
            if event_name == "purchase_complete":
                props["amount"] = random.choice([29, 49, 99, 199])
                props["currency"] = "USD"

            events.append({
                "event_id": str(uuid.uuid4()),   # required by backend for deduplication
                "event_name": event_name,
                "user_id": user,
                "occurred_at": occurred_at.isoformat(),
                "properties": props,
            })

    # Shuffle so batch distribution is natural
    random.shuffle(events)
    return events


def ingest_batches(events: list[dict]) -> int:
    total = len(events)
    ingested = 0
    failed = 0

    for i in range(0, total, BATCH_SIZE):
        batch = events[i : i + BATCH_SIZE]
        try:
            resp = requests.post(INGEST_URL, json={"events": batch}, headers=HEADERS, timeout=10)
            if resp.status_code == 202:
                ingested += len(batch)
                progress = int((ingested / total) * 40)
                bar = "#" * progress + "." * (40 - progress)
                print(f"  [{bar}]  {ingested}/{total}", end="\r", flush=True)
            else:
                failed += len(batch)
                print(f"\n  ✗ Batch {i // BATCH_SIZE + 1} failed: {resp.status_code} — {resp.text[:120]}")
        except requests.exceptions.ConnectionError:
            print("\n  ✗ Cannot connect to backend. Is 'uvicorn' running on port 8000?")
            sys.exit(1)

    print()  # Newline after progress bar
    return ingested


def main():
    print()
    print("  [SEED] Axiomate Seed Data Generator")
    print("  " + "-" * 38)

    if API_KEY in ("YOUR_API_KEY_HERE", "string", "", None):
        print()
        print("  [ERROR] You haven't set a real API key!")
        print()
        print("  How to get one:")
        print("  1. Open http://localhost:8000/api/docs")
        print("  2. Click Authorize -> paste your JWT token")
        print("     (DevTools -> Application -> Local Storage -> axiomate_access_token)")
        print("  3. Find POST /api/v1/api-keys/{workspace_id} -> Try it out")
        print("  4. Send body: {\"name\": \"seed-key\"}")
        print("  5. Copy the 'raw_key' from the response (shown ONLY ONCE)")
        print("  6. Paste it into API_KEY at the top of this file")
        print()
        sys.exit(1)

    print(f"  Users simulated:   {NUM_USERS}")
    print(f"  Days of history:   {DAYS}")
    print(f"  Batch size:        {BATCH_SIZE}")
    print()

    print("  Generating event data...", end=" ", flush=True)
    events = generate_events(DAYS)
    print(f"done  ({len(events)} total events)")
    print()

    print("  Ingesting to backend:")
    ingested = ingest_batches(events)

    print()
    if ingested == len(events):
        print(f"  [OK] Success! {ingested} events ingested.")
        print()
        print("  What to do next:")
        print("  1. Wait ~10 sec for Celery to process the batch")
        print("  2. Refresh your dashboard -- you should see charts!")
        print("  3. Create a funnel:  page_view -> signup -> purchase_complete")
        print("  4. Check retention with initial_event=signup, return_event=page_view")
    else:
        print(f"  [WARN] Only {ingested}/{len(events)} events ingested. Check errors above.")

    print()


if __name__ == "__main__":
    main()
