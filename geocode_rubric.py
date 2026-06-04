import csv
import time
import urllib.request
import urllib.parse
import json
import os
import sys
import ssl

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = os.environ.get("NEXT_PUBLIC_GEOAPIFY_API_KEY", "5789ff5ded94418691ed089ce7967b71")
INPUT_FILE = "GRR_Rubric_v2 - OAK21.csv"
OUTPUT_FILE = "grr_oak21_v2_geocoded.csv"


def geocode(address: str) -> tuple[float | None, float | None]:
    params = urllib.parse.urlencode({
        "text": address,
        "apiKey": API_KEY,
        "limit": 1,
        "filter": "countrycode:us",
    })
    url = f"https://api.geoapify.com/v1/geocode/search?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10, context=ssl_ctx) as resp:
            data = json.loads(resp.read())
        features = data.get("features", [])
        if features:
            lon, lat = features[0]["geometry"]["coordinates"]
            return lat, lon
    except Exception as e:
        print(f"  ERROR: {e}")
    return None, None


def build_address(row: dict) -> str:
    parts = [row.get("address_raw", ""), row.get("city", ""), row.get("state", ""), row.get("zipcode", "")]
    return ", ".join(p.strip() for p in parts if p.strip())


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"File not found: {INPUT_FILE}")
        print("Drop the file into the project folder and run again.")
        sys.exit(1)

    with open(INPUT_FILE, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if "lat" not in fieldnames:
        fieldnames = fieldnames + ["lat", "lng"]

    total = len(rows)
    print(f"Geocoding {total} rows...")

    for i, row in enumerate(rows):
        if row.get("lat") and row.get("lng"):
            print(f"[{i+1}/{total}] SKIP (already geocoded): {row['address_raw']}")
            continue

        address = build_address(row)
        print(f"[{i+1}/{total}] {address}", end=" ... ", flush=True)
        lat, lng = geocode(address)
        row["lat"] = lat if lat is not None else ""
        row["lng"] = lng if lng is not None else ""
        print(f"{lat}, {lng}")

        # Write progress after every row so nothing is lost if interrupted
        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        time.sleep(0.2)  # stay well within Geoapify free tier rate limit

    print(f"\nDone. Output saved to: {OUTPUT_FILE}")
    missing = sum(1 for r in rows if not r.get("lat"))
    print(f"Geocoded: {total - missing}/{total}  |  Failed/partial address: {missing}")


if __name__ == "__main__":
    main()
