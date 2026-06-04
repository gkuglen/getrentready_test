"use client"

import { useEffect, useState } from "react"
import { MapPin, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface Address {
  id: string
  street: string
  city: string
  state: string
  zip: string
  formattedAddress: string
}

interface RentEstimate {
  rent: number | null
  rentRangeLow: number | null
  rentRangeHigh: number | null
}

interface RentData {
  studio: RentEstimate | null
  oneBed: RentEstimate | null
  twoBed: RentEstimate | null
  threeBed: RentEstimate | null
}

export type UnitTypeKey = keyof RentData

const UNIT_TYPES: { key: UnitTypeKey; label: string; beds: string }[] = [
  { key: "studio",   label: "Studio",     beds: "0 BD" },
  { key: "oneBed",   label: "1 Bedroom",  beds: "1 BD" },
  { key: "twoBed",   label: "2 Bedrooms", beds: "2 BD" },
  { key: "threeBed", label: "3 Bedrooms", beds: "3 BD" },
]

// Only 2BR/1BA has a scored dataset — disable the rest for the prototype
const ENABLED_UNIT_TYPES = new Set<UnitTypeKey>(["twoBed"])

interface AddressResultsProps {
  address: Address
  onEdit: () => void
  onUnitSelect: (unitType: UnitTypeKey, estimate: RentEstimate) => void
}

function MarketBar({ low, rent, high }: { low: number; rent: number; high: number }) {
  const span = high - low || 1
  const vizMin = low - span * 0.3
  const vizMax = high + span * 0.3
  const vizSpan = vizMax - vizMin
  const W = 199
  const toX = (v: number) => Math.max(0, Math.min(W, ((v - vizMin) / vizSpan) * W))

  return (
    <div className="w-full">
      <svg width="100%" height="22" viewBox="0 0 199 22" preserveAspectRatio="none">
        <rect x="0" y="0" width="199" height="14" rx="7" fill="#E9EAEA" />
        <rect x={toX(low)} y="0" width={toX(high) - toX(low)} height="14" rx="7" fill="#4D6CFA" />
        <circle cx={toX(rent)} cy="20" r="2" fill="#9CA19B" />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-muted-foreground">${low.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground">${high.toLocaleString()}</span>
      </div>
    </div>
  )
}

function MarketBarSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="h-[22px] w-full rounded-full" />
      <div className="flex justify-between mt-0.5">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

export function AddressResults({ address, onEdit, onUnitSelect }: AddressResultsProps) {
  const [rentData, setRentData] = useState<RentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRents() {
      setIsLoading(true)
      setError(null)
      try {
        const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`
        const res = await fetch("/api/rent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: fullAddress }),
        })
        if (!res.ok) throw new Error("Failed to fetch rent estimates")
        setRentData(await res.json())
      } catch {
        setError("Unable to load rent estimates. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchRents()
  }, [address])

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">

      {/* Modal card — ~1000px wide */}
      <div className="w-full max-w-[1000px] bg-card rounded-2xl shadow-2xl overflow-hidden">

        {/* Address bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground flex-1 truncate">
            {address.formattedAddress}
          </span>
          <button
            onClick={onEdit}
            className="text-xs text-primary hover:text-primary/70 transition-colors shrink-0 font-medium"
          >
            Edit
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-6 sm:px-8 sm:py-8">

          {/* Heading */}
          <div className="mb-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-foreground mb-1 sm:text-3xl">
              Select a unit type
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose a configuration to see market rents and upside potential
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-6">
              {error}
            </div>
          )}

          {/* 4-column grid — 2 cols on mobile, 4 cols on sm+ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {UNIT_TYPES.map(({ key, label, beds }) => {
              const estimate = rentData?.[key]
              const isEnabled = ENABLED_UNIT_TYPES.has(key)
              const isReady = !isLoading && !!estimate?.rent && isEnabled

              return (
                <button
                  key={key}
                  onClick={() => isReady && onUnitSelect(key, estimate!)}
                  disabled={!isEnabled}
                  className={[
                    "group relative bg-background rounded-xl border p-4 text-left transition-all duration-150 sm:p-5",
                    isEnabled
                      ? "border-border hover:border-primary hover:border-2 hover:shadow-md cursor-pointer"
                      : "border-border opacity-50 cursor-default",
                  ].join(" ")}
                >
                  {/* Beds badge + chevron */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {beds}
                    </span>
                    {isEnabled && !isLoading && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>

                  {/* Unit label */}
                  <p className="text-sm font-semibold text-foreground mb-3">{label}</p>

                  {/* Market bar */}
                  {isLoading ? (
                    <MarketBarSkeleton />
                  ) : estimate?.rent && estimate.rentRangeLow && estimate.rentRangeHigh ? (
                    <MarketBar
                      low={estimate.rentRangeLow}
                      rent={estimate.rent}
                      high={estimate.rentRangeHigh}
                    />
                  ) : (
                    <div className="h-[22px] w-full" />
                  )}

                  {/* Rent estimate */}
                  <div className="mt-3">
                    {isLoading ? (
                      <Skeleton className="h-7 w-24" />
                    ) : estimate?.rent ? (
                      <p className="text-xl font-bold text-foreground sm:text-2xl">
                        ${estimate.rent.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Coming soon badge for disabled options */}
                  {!isEnabled && (
                    <span className="absolute top-3 right-3 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Microcopy */}
          <p className="text-xs text-muted-foreground text-center mt-5">
            Select a unit type to continue · You can add multiple units later
          </p>

        </div>
      </div>
    </div>
  )
}
