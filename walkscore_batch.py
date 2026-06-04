#!/usr/bin/env python3
"""
Batch script to fetch Walk/Transit/Bike scores for properties
missing location data, then calculate Location_Score_100.

Reads:  INPUT_CSV  (your scored property dataset)
Writes: OUTPUT_CSV (same data + filled location scores)

Location_Score_100 = (WalkScore × 0.50) + (TransitScore × 0.30) + (BikeScore × 0.20)
"""

import os
import csv
import time
import sys
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

GEOAPIFY_KEY = os.getenv("NEXT_PUBLIC_GEOAPIFY_API_KEY")
WALKSCORE_KEY = os.getenv("WALKSCORE_API_KEY")

INPUT_CSV = "V6_grr.csv"
OUTPUT_CSV = "V6_grr_with_location.csv"


def geocode(address: str) -> tuple[float, float] | None:
    params = {
        "text": address,
        "apiKey": GEOAPIFY_KEY,
        "format": "json",
        "limit": 1,
        "filter": "countrycode:us",
    }
    try:
        r = requests.get("https://api.geoapify.com/v1/geocode/search", params=params, timeout=10)
        r.raise_for_status()
        results = r.json().get("results", [])
        if results:
            return results[0]["lat"], results[0]["lon"]
    except Exception as e:
        print(f"    Geocode error: {e}")
    return None


def fetch_walk_scores(address: str, lat: float, lon: float) -> dict | None:
    params = {
        "format": "json",
        "address": address,
        "lat": lat,
        "lon": lon,
        "transit": 1,
        "bike": 1,
        "wsapikey": WALKSCORE_KEY,
    }
    try:
        r = requests.get("https://api.walkscore.com/score", params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == 1:
            return {
                "walk": data.get("walkscore"),
                "transit": (data.get("transit") or {}).get("score"),
                "bike": (data.get("bike") or {}).get("score"),
            }
        print(f"    Walk Score status code: {data.get('status')} — no score available")
    except Exception as e:
        print(f"    Walk Score error: {e}")
    return None


def location_score(walk, transit, bike) -> float:
    w = walk or 0
    t = transit or 0
    b = bike or 0
    return round((w * 0.50) + (t * 0.30) + (b * 0.20), 1)


def build_address(row: dict) -> str:
    parts = [row.get("address_raw", "").strip()]
    city = row.get("city", "").strip()
    state = row.get("state", "").strip()
    zipcode = row.get("zipcode", "").strip()
    if city and city not in parts[0]:
        parts.append(city)
    if state:
        parts.append(state)
    if zipcode and zipcode.upper() != "NA":
        parts.append(zipcode)
    return ", ".join(parts)


def main():
    if not GEOAPIFY_KEY:
        sys.exit("Error: NEXT_PUBLIC_GEOAPIFY_API_KEY not set in .env.local")
    if not WALKSCORE_KEY:
        sys.exit("Error: WALKSCORE_API_KEY not set in .env.local")

    if not os.path.exists(INPUT_CSV):
        sys.exit(f"Error: Input file not found: {INPUT_CSV}\nPlace the CSV in the same folder as this script.")

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    total = len(rows)
    updated = skipped = failed = 0

    for i, row in enumerate(rows):
        raw_score = row.get("Location_Score_100", "0.0").strip()
        try:
            existing = float(raw_score)
        except ValueError:
            existing = 0.0

        if existing > 0:
            print(f"[{i+1}/{total}] SKIP (already scored={existing}): {row['address_raw'][:50]}")
            skipped += 1
            continue

        full_address = build_address(row)
        print(f"[{i+1}/{total}] {full_address}")

        coords = geocode(full_address)
        if not coords:
            print(f"    Could not geocode — skipping")
            failed += 1
            time.sleep(0.3)
            continue

        lat, lon = coords
        time.sleep(0.4)

        scores = fetch_walk_scores(full_address, lat, lon)
        if not scores:
            print(f"    No Walk Score data — skipping")
            failed += 1
            time.sleep(0.3)
            continue

        walk = scores["walk"]
        transit = scores["transit"]
        bike = scores["bike"]
        loc = location_score(walk, transit, bike)

        print(f"    Walk={walk}  Transit={transit}  Bike={bike}  →  Location={loc}")

        row["WalkScore"] = walk if walk is not None else ""
        row["TransitScore"] = transit if transit is not None else ""
        row["BikeScore"] = bike if bike is not None else ""
        row["Location_Score_100"] = loc
        updated += 1

        time.sleep(0.3)

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n{'='*50}")
    print(f"Complete — {total} records processed")
    print(f"  Updated : {updated}")
    print(f"  Skipped : {skipped} (already had scores)")
    print(f"  Failed  : {failed} (geocode or API error)")
    print(f"\nOutput saved to: {OUTPUT_CSV}")
    print("Note: Re-import into Google Sheets and recalculate Market_Score with the new Location_Score_100 values.")


if __name__ == "__main__":
    main()
