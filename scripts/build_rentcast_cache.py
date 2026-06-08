#!/usr/bin/env python3
"""
build_rentcast_cache.py
Calls Rentcast AVM once per zone × unit type combination and saves results
to data/rentcast_cache.json. Run this monthly to refresh market bounds.

Usage:
    python3 scripts/build_rentcast_cache.py
"""

import json
import os
import ssl
import time
import urllib.request
import urllib.parse
from pathlib import Path

# macOS SSL fix
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# ── Load API key from .env.local ─────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env.local"
api_key = None
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("RENTCAST_API_KEY="):
            api_key = line.split("=", 1)[1].strip()
            break

if not api_key or api_key == "your_rentcast_api_key_here":
    raise SystemExit("ERROR: RENTCAST_API_KEY not found in .env.local")

# ── Oakland zones with representative addresses ───────────────────────────────
ZONES = [
    {
        "id": "north_oakland",
        "label": "North Oakland / Rockridge",
        "zips": ["94618", "94611"],
        "address": "5200 College Ave, Oakland, CA 94618",
    },
    {
        "id": "temescal",
        "label": "Temescal / North Oakland",
        "zips": ["94608", "94609"],
        "address": "4801 Shattuck Ave, Oakland, CA 94609",
    },
    {
        "id": "lake_merritt",
        "label": "Lake Merritt / Grand Lake",
        "zips": ["94610", "94612"],
        "address": "528 Merritt Ave, Oakland, CA 94610",
    },
    {
        "id": "fruitvale",
        "label": "Fruitvale / Dimond",
        "zips": ["94601", "94602", "94606", "94619"],
        "address": "3806 39th Ave, Oakland, CA 94619",
    },
    {
        "id": "east_oakland",
        "label": "East Oakland",
        "zips": ["94603", "94605", "94621"],
        "address": "1000 85th Ave, Oakland, CA 94621",
    },
]

# ── Unit types ────────────────────────────────────────────────────────────────
UNIT_TYPES = [
    {"id": "studio",   "label": "Studio",   "beds": 0, "baths": 1},
    {"id": "1br_1ba",  "label": "1BR/1BA",  "beds": 1, "baths": 1},
    {"id": "2br_1ba",  "label": "2BR/1BA",  "beds": 2, "baths": 1},
    {"id": "2br_2ba",  "label": "2BR/2BA",  "beds": 2, "baths": 2},
    {"id": "3br_1ba",  "label": "3BR/1BA",  "beds": 3, "baths": 1},
    {"id": "3br_2ba",  "label": "3BR/2BA",  "beds": 3, "baths": 2},
]

RENTCAST_URL = "https://api.rentcast.io/v1/avm/rent/long-term"

def fetch_rentcast(address, beds, baths):
    params = urllib.parse.urlencode({
        "address": address,
        "bedrooms": beds,
        "bathrooms": baths,
        "propertyType": "Apartment",
        "compCount": "5",
    })
    req = urllib.request.Request(
        f"{RENTCAST_URL}?{params}",
        headers={"X-Api-Key": api_key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            data = json.loads(resp.read())
            return {
                "rent": data.get("rent"),
                "min": data.get("rentRangeLow"),
                "max": data.get("rentRangeHigh"),
            }
    except Exception as e:
        print(f"  ERROR: {e}")
        return {"rent": None, "min": None, "max": None}

# ── Main ──────────────────────────────────────────────────────────────────────
print(f"\n{'─'*70}")
print(f"  GetRentReady — Rentcast Cache Builder")
print(f"  {len(ZONES)} zones × {len(UNIT_TYPES)} unit types = {len(ZONES)*len(UNIT_TYPES)} API calls")
print(f"{'─'*70}\n")

cache = {
    "generated": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "zones": {},
}

# Print header for results table
print(f"{'Zone':<28} {'Unit':<10} {'Min':>8} {'Rent':>8} {'Max':>8}")
print(f"{'─'*28} {'─'*10} {'─'*8} {'─'*8} {'─'*8}")

for zone in ZONES:
    cache["zones"][zone["id"]] = {
        "label": zone["label"],
        "zips": zone["zips"],
        "address": zone["address"],
        "units": {},
    }

    for unit in UNIT_TYPES:
        print(f"  Fetching {zone['label']:<24} {unit['label']:<10} ...", end=" ", flush=True)
        result = fetch_rentcast(zone["address"], unit["beds"], unit["baths"])

        cache["zones"][zone["id"]]["units"][unit["id"]] = {
            "label": unit["label"],
            "beds": unit["beds"],
            "baths": unit["baths"],
            "rent": result["rent"],
            "min": result["min"],
            "max": result["max"],
        }

        min_str = f"${result['min']:,.0f}" if result["min"] else "N/A"
        rent_str = f"${result['rent']:,.0f}" if result["rent"] else "N/A"
        max_str = f"${result['max']:,.0f}" if result["max"] else "N/A"
        print(f"\r  {zone['label']:<28} {unit['label']:<10} {min_str:>8} {rent_str:>8} {max_str:>8}")

        time.sleep(0.3)  # be polite to the API

    print()

# ── Save cache ────────────────────────────────────────────────────────────────
out_path = Path(__file__).parent.parent / "data" / "rentcast_cache.json"
out_path.write_text(json.dumps(cache, indent=2))
print(f"\n✓ Saved to {out_path}")
print(f"  Update app/api/comps/route.ts to read from this cache instead of live Rentcast calls.\n")
