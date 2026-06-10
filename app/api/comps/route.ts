import { NextRequest, NextResponse } from "next/server"
import { buildQuantiles } from "@/lib/grr-model"
import allCompsData from "@/data/bplus_comps.json"
import rentcastCache from "@/data/rentcast_cache.json"

interface BplusComp {
  address: string
  city: string
  grade: string
  market_score: number | null
  rent: number | null
  bedrooms: string
  bathrooms: string
  sqft: string
  walk_score: string
  transit_score: string
  parking_type: string
  laundry_type: string
  lat: number
  lng: number
  listing_url: string
}

// Haversine distance in miles between two lat/lng points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ZIP code → cache zone ID
const ZIP_TO_ZONE: Record<string, string> = {
  "94618": "north_oakland", "94611": "north_oakland",
  "94608": "temescal",      "94609": "temescal",
  "94610": "lake_merritt",  "94612": "lake_merritt",
  "94601": "fruitvale",     "94602": "fruitvale",
  "94606": "fruitvale",     "94619": "fruitvale",
  "94603": "east_oakland",  "94605": "east_oakland", "94621": "east_oakland",
}
const DEFAULT_ZONE = "lake_merritt"

// beds + baths → cache unit type ID
function unitTypeId(beds: number, baths: number): string {
  if (beds === 0) return "studio"
  if (beds === 1) return "1br_1ba"
  if (beds === 2) return baths >= 2 ? "2br_2ba" : "2br_1ba"
  if (beds === 3) return baths >= 2 ? "3br_2ba" : "3br_1ba"
  return "3br_2ba"
}

// Look up min/max from the pre-built cache
function getCachedRange(zip: string, beds: number, baths: number) {
  const zoneId = ZIP_TO_ZONE[zip] ?? DEFAULT_ZONE
  const zones = rentcastCache.zones as Record<string, { units: Record<string, { min: number | null; max: number | null }> }>
  const zone = zones[zoneId]
  if (!zone) return null
  const unit = zone.units[unitTypeId(beds, baths)]
  if (!unit) return null
  return { min: unit.min, max: unit.max, zone: zoneId }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get("lat") ?? "")
  const lng = parseFloat(searchParams.get("lng") ?? "")
  const bedrooms = parseInt(searchParams.get("bedrooms") ?? "2")
  const bathrooms = parseInt(searchParams.get("bathrooms") ?? "1")
  const zip = searchParams.get("zip") ?? ""

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 })
  }

  const allComps: BplusComp[] = allCompsData as BplusComp[]

  // Filter to matching bedroom count
  const matchingBR = allComps.filter(
    (c) => parseInt(c.bedrooms) === bedrooms && c.rent !== null
  )

  // Compute distance and sort
  const withDistance = matchingBR
    .map((c) => ({
      ...c,
      distance: haversine(lat, lng, c.lat, c.lng),
    }))
    .sort((a, b) => a.distance - b.distance)

  // Nearby comps within 1 mile (or closest 3 if none within 1mi)
  const within1Mile = withDistance.filter((c) => c.distance <= 1.0)
  const nearbyComps = within1Mile.length >= 2
    ? within1Mile.slice(0, 5)
    : withDistance.slice(0, 3)

  // All same-BR rents from dataset for quartile computation
  const allRents = matchingBR.map((c) => c.rent as number)

  // Look up min/max from cache (no live API call)
  const cachedRange = getCachedRange(zip, bedrooms, bathrooms)

  const quantiles = buildQuantiles(
    allRents,
    cachedRange?.min ?? undefined,
    cachedRange?.max ?? undefined,
  )

  return NextResponse.json({
    quantiles,
    rents: allRents,
    comps: nearbyComps.map((c) => ({
      address: c.address,
      city: c.city,
      grade: c.grade,
      market_score: c.market_score,
      rent: c.rent,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      sqft: c.sqft,
      walk_score: c.walk_score,
      parking_type: c.parking_type,
      laundry_type: c.laundry_type,
      distance: Math.round(c.distance * 10) / 10,
      listing_url: c.listing_url,
    })),
    dataSource: {
      quantilesFrom: "GRR rubric dataset (B+ scored Oakland apartments)",
      minMaxFrom: cachedRange ? `Rentcast cache (${cachedRange.zone.replace("_", " ")})` : "GRR dataset",
      totalSampleSize: matchingBR.length,
    },
  })
}
