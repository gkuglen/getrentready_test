import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import { buildQuantiles } from "@/lib/grr-model"

const RENTCAST_BASE_URL = "https://api.rentcast.io/v1"

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

async function fetchRentcastRange(address: string, bedrooms: number) {
  try {
    const params = new URLSearchParams({
      address,
      bedrooms: String(bedrooms),
      propertyType: "Apartment",
      compCount: "5",
    })
    const res = await fetch(`${RENTCAST_BASE_URL}/avm/rent/long-term?${params}`, {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY!,
        accept: "application/json",
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      min: data.rentRangeLow ?? null,
      max: data.rentRangeHigh ?? null,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get("lat") ?? "")
  const lng = parseFloat(searchParams.get("lng") ?? "")
  const bedrooms = parseInt(searchParams.get("bedrooms") ?? "2")
  const address = searchParams.get("address") ?? ""

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 })
  }

  // Load B+ comp dataset
  const filePath = join(process.cwd(), "data", "bplus_comps.json")
  const allComps: BplusComp[] = JSON.parse(readFileSync(filePath, "utf-8"))

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

  // Fetch Rentcast min/max in parallel
  const rentcastRange = address
    ? await fetchRentcastRange(address, bedrooms)
    : null

  const quantiles = buildQuantiles(
    allRents,
    rentcastRange?.min ?? undefined,
    rentcastRange?.max ?? undefined,
  )

  return NextResponse.json({
    quantiles,
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
      minMaxFrom: rentcastRange ? "Rentcast AVM" : "GRR dataset",
      totalSampleSize: matchingBR.length,
    },
  })
}
