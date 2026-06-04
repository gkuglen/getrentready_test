// Model layer — ported from design_handoff_grr/data.jsx
// Finance math, grade/score functions, renovation ladder, market cloud

export function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeCompCloud(seed: number, median: number, spread: number, n: number): number[] {
  const rnd = mulberry32(seed)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const g = (rnd() + rnd() + rnd()) / 3 - 0.5
    out.push(Math.round((median + g * spread * 2) / 5) * 5)
  }
  return out
}

export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base]
}

export function pctRank(value: number, cloud: number[]): number {
  let below = 0
  for (const c of cloud) if (c <= value) below++
  return below / cloud.length
}

export function gradeFromPct(p: number): string {
  const scale: [number, string][] = [
    [0.92, 'A'], [0.82, 'A-'], [0.72, 'B+'], [0.60, 'B'],
    [0.48, 'B-'], [0.36, 'C+'], [0.24, 'C'], [0.14, 'C-'],
    [0.06, 'D+'], [0.0, 'D'],
  ]
  for (const [t, g] of scale) if (p >= t) return g
  return 'D'
}

export function scoreFor(rent: number, cloud: number[]): number {
  return Math.round((62 + pctRank(rent, cloud) * 33) * 10) / 10
}

export interface Metrics {
  monthly: number
  annualCashFlow: number
  increasePct: number
  propertyValueInc: number
  remodelBudget: number
}

export function computeMetrics(
  currentRent: number,
  target: number,
  capRate: number,
  coc: number,
): Metrics {
  const monthly = Math.max(0, target - currentRent)
  const annualCashFlow = monthly * 12
  const increasePct = currentRent ? (target - currentRent) / currentRent : 0
  const propertyValueInc = capRate > 0 ? annualCashFlow / capRate : 0
  const remodelBudget = coc > 0 ? annualCashFlow / coc : 0
  return { monthly, annualCashFlow, increasePct, propertyValueInc, remodelBudget }
}

export interface LadderTier {
  label: string
  work: string
  pct: number
  rent: number
  score: number
  grade: string
  premium: number
  premiumPct: number
  recommended: boolean
  beyond: boolean
}

export interface LadderResult {
  tiers: LadderTier[]
  recIdx: number
}

const LADDER_DEF = [
  { label: 'Current condition', work: 'No upgrades', pct: 0 },
  { label: 'Cosmetic refresh', work: 'Paint, deep clean, dishwasher, microwave', pct: 0.10 },
  { label: 'Partial remodel', work: 'Flooring, paint, updated bath', pct: 0.16 },
  { label: 'Kitchen update', work: 'Above + updated kitchen', pct: 0.25 },
  { label: 'Full remodel', work: 'Kitchen, bath, floors, fresh paint', pct: 0.31 },
  { label: 'In-unit laundry', work: 'Full remodel + W/D (if hookups)', pct: 0.41 },
]

export function gradeLadder(currentRent: number, suggestedTarget: number, cloud: number[]): LadderResult {
  const tiers: LadderTier[] = LADDER_DEF.map((d) => {
    const rent = Math.round((currentRent * (1 + d.pct)) / 5) * 5
    const score = scoreFor(rent, cloud)
    return {
      ...d,
      rent,
      score,
      grade: gradeFromPct(pctRank(rent, cloud)),
      premium: rent - currentRent,
      premiumPct: Math.round(d.pct * 100),
      recommended: false,
      beyond: false,
    }
  })

  let recIdx = 0, best = Infinity
  tiers.forEach((t, i) => {
    const dd = Math.abs(t.rent - suggestedTarget)
    if (dd < best) { best = dd; recIdx = i }
  })
  tiers.forEach((t, i) => { t.beyond = i > recIdx; t.recommended = i === recIdx })
  return { tiers, recIdx }
}

export interface Quantiles {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

// Build quantiles from a real rent array (your rubric dataset)
// min/max can be overridden with Rentcast range values
export function buildQuantiles(
  rents: number[],
  rentcastMin?: number,
  rentcastMax?: number,
): Quantiles {
  if (rents.length === 0) {
    return { min: rentcastMin ?? 0, q1: 0, median: 0, q3: 0, max: rentcastMax ?? 0 }
  }
  const sorted = [...rents].sort((a, b) => a - b)
  return {
    min: rentcastMin ?? sorted[0],
    q1: Math.round(quantile(sorted, 0.25)),
    median: Math.round(quantile(sorted, 0.5)),
    q3: Math.round(quantile(sorted, 0.75)),
    max: rentcastMax ?? sorted[sorted.length - 1],
  }
}

export interface Unit {
  id: string
  name: string
  address: string
  city: string
  beds: number
  baths: number
  sqft: number
  currentRent: number
  suggestedTarget: number
  capRate: number
  coc: number
  amenities: string[]
  market: { median: number; spread: number; n: number; seed: number }
  cloud: number[]
  cloudMin: number
  cloudMax: number
  q: Quantiles
  sliderMin: number
  sliderMax: number
}

interface RawUnit {
  id?: string
  seed: number
  n: string
  address?: string
  city?: string
  beds: number
  baths: number
  sqft: number
  currentRent: number
  suggestedTarget?: number
  median?: number
  capRate?: number
  coc?: number
  amenities?: string[]
}

export function makeUnit(r: RawUnit): Unit {
  const median = r.median ?? r.suggestedTarget ?? Math.round((r.currentRent * 1.12) / 5) * 5
  const spread = Math.round(median * 0.18)
  const cloud = makeCompCloud(r.seed, median, spread, 44)
  const sorted = [...cloud].sort((a, b) => a - b)
  const q: Quantiles = {
    min: sorted[0],
    q1: Math.round(quantile(sorted, 0.25)),
    median: Math.round(quantile(sorted, 0.5)),
    q3: Math.round(quantile(sorted, 0.75)),
    max: sorted[sorted.length - 1],
  }
  return {
    id: r.id ?? `u-${r.seed}`,
    name: r.n,
    address: r.address ?? "",
    city: r.city ?? "",
    beds: r.beds,
    baths: r.baths,
    sqft: r.sqft,
    currentRent: r.currentRent,
    suggestedTarget: r.suggestedTarget ?? Math.round((r.currentRent * 1.12) / 5) * 5,
    capRate: r.capRate ?? 0.065,
    coc: r.coc ?? 0.30,
    amenities: r.amenities ?? [],
    market: { median, spread, n: 44, seed: r.seed },
    cloud,
    cloudMin: sorted[0],
    cloudMax: sorted[sorted.length - 1],
    q,
    sliderMin: Math.round((Math.min(sorted[0], r.currentRent) * 0.96) / 5) * 5,
    sliderMax: Math.round((Math.max(sorted[sorted.length - 1], r.suggestedTarget ?? r.currentRent * 1.4) * 1.06) / 5) * 5,
  }
}

export const AMENITIES = [
  'In-unit Laundry', 'Dishwasher', 'Central A/C', 'Updated Kitchen', 'Updated Bath',
  'Hardwood Floors', 'Off-street Parking', 'Private Outdoor', 'Walk-in Closet', 'Stainless Appliances',
]

export function fmt$(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

export function fmtK(n: number): string {
  return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k'
}

export function bedLabel(b: number): string {
  return b === 0 ? 'Studio' : b + ' bd'
}
