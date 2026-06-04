"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

interface GeoapifyFeature {
  properties: {
    place_id: string
    address_line1: string
    city: string
    state_code: string
    postcode: string
    formatted: string
  }
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
}

interface AddressSearchProps {
  onAddressSelect: (address: Address) => void
}

export function AddressSearch({ onAddressSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (search: string) => {
    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_GEOAPIFY_API_KEY is not set")
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        text: search,
        filter: "countrycode:us",
        limit: "5",
        apiKey,
      })
      const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`)
      if (!res.ok) return
      const data = await res.json()
      const mapped: Address[] = (data.features ?? []).map((f: GeoapifyFeature) => ({
        id: f.properties.place_id,
        street: f.properties.address_line1,
        city: f.properties.city,
        state: f.properties.state_code,
        zip: f.properties.postcode,
        formattedAddress: f.properties.formatted,
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
      }))
      setSuggestions(mapped)
      setIsOpen(mapped.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (query.length < 3 || selectedAddress) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selectedAddress, fetchSuggestions])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (address: Address) => {
    setSelectedAddress(address)
    setQuery(`${address.street}, ${address.city}, ${address.state} ${address.zip}`)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightedIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setSelectedAddress(null)
  }

  const handleContinue = () => {
    if (selectedAddress) onAddressSelect(selectedAddress)
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        <label className="block text-sm font-medium text-foreground mb-2">
          Property Address
        </label>
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            placeholder="Start typing an address..."
            className="w-full h-12 pl-4 pr-4 text-base bg-card border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-150"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>

        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((address, index) => (
              <button
                key={address.id}
                onClick={() => handleSelect(address)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150",
                  highlightedIndex === index ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{address.street}</span>
                  <span className="text-sm text-muted-foreground">
                    {address.city}, {address.state} {address.zip}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={handleContinue}
          disabled={!selectedAddress}
          className="w-1/2 h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          See Market Rents
        </Button>
      </div>
    </div>
  )
}
