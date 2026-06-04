"use client"

import { useState } from "react"
import { AddressSearch } from "@/components/address-search"
import { AddressResults, type UnitTypeKey } from "@/components/address-results"
import { PropertyScreens } from "@/components/property-screens"

interface Address {
  id: string
  street: string
  city: string
  state: string
  zip: string
  formattedAddress: string
  lat?: number
  lng?: number
}

interface RentEstimate {
  rent: number | null
  rentRangeLow: number | null
  rentRangeHigh: number | null
}

type Screen = "search" | "results" | "property"

export default function PropertyLookupPage() {
  const [screen, setScreen] = useState<Screen>("search")
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeKey | null>(null)
  const [selectedEstimate, setSelectedEstimate] = useState<RentEstimate | null>(null)

  const handleAddressSelect = (address: Address) => {
    setSelectedAddress(address)
    setScreen("results")
  }

  const handleUnitSelect = (unitType: UnitTypeKey, estimate: RentEstimate) => {
    setSelectedUnitType(unitType)
    setSelectedEstimate(estimate)
    setScreen("property")
  }

  const handleBackToSearch = () => {
    setSelectedAddress(null)
    setSelectedUnitType(null)
    setSelectedEstimate(null)
    setScreen("search")
  }

  const handleBackToResults = () => {
    setSelectedUnitType(null)
    setSelectedEstimate(null)
    setScreen("results")
  }

  // PropertyScreens has its own full-screen layout — render it outside the shared shell
  if (screen === "property" && selectedAddress && selectedUnitType && selectedEstimate) {
    return (
      <PropertyScreens
        propertyAddress={selectedAddress}
        initialUnitType={selectedUnitType}
        initialEstimate={selectedEstimate}
        onBack={handleBackToResults}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background">

      <header className="sticky top-0 z-40 bg-background">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">Get Rent Ready</h1>
        </div>
      </header>

      {/* Search screen — always rendered, sits behind the modal when results are open */}
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="flex flex-col items-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-foreground mb-2 text-center sm:text-4xl">
            Locate your property
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md sm:text-base sm:mb-8">
            Enter your property address to see estimated market rents and compare your units to the local market.
          </p>
          <AddressSearch onAddressSelect={handleAddressSelect} />
        </div>
      </div>

      {/* Unit type modal — overlays the search screen after address selection */}
      {screen === "results" && selectedAddress && (
        <AddressResults
          address={selectedAddress}
          onEdit={handleBackToSearch}
          onUnitSelect={handleUnitSelect}
        />
      )}

    </main>
  )
}
