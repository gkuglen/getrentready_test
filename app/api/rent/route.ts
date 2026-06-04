import { NextRequest, NextResponse } from "next/server"

const RENTCAST_BASE_URL = "https://api.rentcast.io/v1"

interface RentEstimate {
  rent: number | null
  rentRangeLow: number | null
  rentRangeHigh: number | null
}

async function fetchRentEstimate(address: string, bedrooms: number): Promise<RentEstimate | null> {
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
    rent: data.rent ?? null,
    rentRangeLow: data.rentRangeLow ?? null,
    rentRangeHigh: data.rentRangeHigh ?? null,
  }
}

export async function POST(request: NextRequest) {
  const { address } = await request.json()

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  if (!process.env.RENTCAST_API_KEY) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  const [studio, oneBed, twoBed, threeBed] = await Promise.allSettled([
    fetchRentEstimate(address, 0),
    fetchRentEstimate(address, 1),
    fetchRentEstimate(address, 2),
    fetchRentEstimate(address, 3),
  ])

  return NextResponse.json({
    studio: studio.status === "fulfilled" ? studio.value : null,
    oneBed: oneBed.status === "fulfilled" ? oneBed.value : null,
    twoBed: twoBed.status === "fulfilled" ? twoBed.value : null,
    threeBed: threeBed.status === "fulfilled" ? threeBed.value : null,
  })
}
