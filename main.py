#!/usr/bin/env python3
"""Fetch rent comparables from the Rentcast API for a given address."""

import os
import sys
import json
import argparse
import requests
from dotenv import load_dotenv

load_dotenv()

RENTCAST_BASE_URL = "https://api.rentcast.io/v1"


def get_rent_comparables(
    address: str,
    property_type: str = "Single Family",
    bedrooms: int | None = None,
    bathrooms: float | None = None,
    square_footage: int | None = None,
    comp_count: int = 5,
) -> dict:
    api_key = os.getenv("RENTCAST_API_KEY")
    if not api_key:
        raise EnvironmentError("RENTCAST_API_KEY is not set. Copy .env.example to .env and add your key.")

    params = {
        "address": address,
        "propertyType": property_type,
        "compCount": comp_count,
    }
    if bedrooms is not None:
        params["bedrooms"] = bedrooms
    if bathrooms is not None:
        params["bathrooms"] = bathrooms
    if square_footage is not None:
        params["squareFootage"] = square_footage

    response = requests.get(
        f"{RENTCAST_BASE_URL}/avm/rent/long-term",
        headers={"X-Api-Key": api_key, "accept": "application/json"},
        params=params,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def display_results(data: dict) -> None:
    rent = data.get("rent")
    rent_range_low = data.get("rentRangeLow")
    rent_range_high = data.get("rentRangeHigh")
    comparables = data.get("comparables", [])

    print("\n" + "=" * 60)
    print("RENT ESTIMATE")
    print("=" * 60)
    if rent:
        print(f"  Estimated Rent:  ${rent:,.0f}/mo")
    if rent_range_low and rent_range_high:
        print(f"  Range:           ${rent_range_low:,.0f} – ${rent_range_high:,.0f}/mo")

    if comparables:
        print(f"\n{'=' * 60}")
        print(f"COMPARABLE RENTALS ({len(comparables)} found)")
        print("=" * 60)
        for i, comp in enumerate(comparables, 1):
            price = comp.get("price", "N/A")
            addr = comp.get("formattedAddress") or comp.get("address", "N/A")
            beds = comp.get("bedrooms", "?")
            baths = comp.get("bathrooms", "?")
            sqft = comp.get("squareFootage")
            days = comp.get("daysOnMarket")

            print(f"\n  [{i}] {addr}")
            print(f"      Rent: ${price:,.0f}/mo" if isinstance(price, (int, float)) else f"      Rent: {price}/mo")
            print(f"      Beds/Baths: {beds} bd / {baths} ba" + (f"  |  {sqft:,} sqft" if sqft else ""))
            if days is not None:
                print(f"      Days on Market: {days}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Get rent comparables from Rentcast API")
    parser.add_argument("address", help='Full property address, e.g. "123 Main St, Austin, TX 78701"')
    parser.add_argument("--type", dest="property_type", default="Single Family",
                        choices=["Single Family", "Condo", "Townhouse", "Multi-Family"],
                        help="Property type (default: Single Family)")
    parser.add_argument("--beds", type=int, default=None, help="Number of bedrooms")
    parser.add_argument("--baths", type=float, default=None, help="Number of bathrooms")
    parser.add_argument("--sqft", type=int, default=None, help="Square footage")
    parser.add_argument("--comps", type=int, default=5, help="Number of comparables (default: 5, max: 25)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of formatted results")
    args = parser.parse_args()

    try:
        data = get_rent_comparables(
            address=args.address,
            property_type=args.property_type,
            bedrooms=args.beds,
            bathrooms=args.baths,
            square_footage=args.sqft,
            comp_count=min(args.comps, 25),
        )
        if args.json:
            print(json.dumps(data, indent=2))
        else:
            display_results(data)
    except EnvironmentError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    except requests.HTTPError as e:
        print(f"API error {e.response.status_code}: {e.response.text}", file=sys.stderr)
        sys.exit(1)
    except requests.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
