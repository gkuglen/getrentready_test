"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  makeUnit, gradeLadder, computeMetrics, gradeFromPct, pctRank,
  scoreFor, fmt$, fmtK, AMENITIES,
  type Unit, type Quantiles,
} from "@/lib/grr-model"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Address {
  street: string; city: string; state: string; zip: string
  formattedAddress: string; lat?: number; lng?: number
}

export interface RentEstimate {
  rent: number | null; rentRangeLow: number | null; rentRangeHigh: number | null
}

export type UnitTypeKey = "studio" | "oneBed" | "twoBed" | "threeBed"

interface UnitState {
  currentRent: number  // mutable — draggable/editable on unit header
  target: number
  capRate: number
  coc: number
}

interface RentComp {
  address: string; city: string; grade: string; market_score: number | null
  rent: number | null; bedrooms: string; bathrooms: string; sqft: string
  walk_score: string; parking_type: string; laundry_type: string
  distance: number; listing_url: string
}

interface FormState {
  name: string; address: string; currentRent: number | string
  sqft: number; beds: number; baths: number; amenities: string[]
}

export interface PropertyScreensProps {
  propertyAddress: Address
  initialUnitType: UnitTypeKey
  initialEstimate: RentEstimate
  onBack: () => void
}

const BEDS: Record<UnitTypeKey, number> = { studio: 0, oneBed: 1, twoBed: 2, threeBed: 3 }
const SQFT: Record<UnitTypeKey, number> = { studio: 480, oneBed: 620, twoBed: 800, threeBed: 1100 }

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }

function addrSeed(addr: Address): number {
  const s = addr.zip + addr.street
  let h = 0
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0 }
  return Math.abs(h) % 9999 || 100
}

function rawFromUnit(u: Unit) {
  return {
    id: u.id, seed: u.market.seed, n: u.name, address: u.address, city: u.city,
    beds: u.beds, baths: u.baths, sqft: u.sqft,
    currentRent: u.currentRent, suggestedTarget: u.suggestedTarget,
    median: u.market.median, capRate: u.capRate, coc: u.coc, amenities: u.amenities,
  }
}

// ─── Grade Pill ───────────────────────────────────────────────────────────────

function GradePill({ grade, tone = "neutral" }: { grade: string; tone?: "good" | "warn" | "neutral" }) {
  return <span className={`ur-grade ur-grade--${tone}`}>{grade}</span>
}

// ─── Inline-editable current rent ─────────────────────────────────────────────

function EditableRent({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editing])

  const commit = () => {
    const n = parseInt(draft.replace(/[^0-9]/g, ""), 10)
    if (!isNaN(n)) onChange(clamp(Math.round(n / 5) * 5, min, max))
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="ur-rentedit">
        <span className="ur-rentedit__dollar">$</span>
        <input ref={inputRef} className="ur-rentedit__input" type="text" inputMode="numeric" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }} />
      </span>
    )
  }
  return (
    <button className="ur-rentcol__val ur-rentcol__val--edit"
      onClick={() => { setDraft(String(value)); setEditing(true) }} title="Edit current rent">
      {fmt$(value)}
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </button>
  )
}

// ─── Bullet Graph (unit header) — current is the draggable thumb ──────────────

function BulletGraph({ currentRent, q, sliderMin, sliderMax, onChange }: {
  currentRent: number
  q: Quantiles
  sliderMin: number; sliderMax: number; onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)

  // Axis must always extend past the bar on both sides so grey shows
  const spread = Math.max(q.q3 - q.q1, 100)
  const lo = Math.min(q.min, q.q1 - spread * 0.38)
  const hi = Math.max(q.min + 100, q.max, q.q3 + spread * 0.38)
  const pct = (v: number) => clamp((v - lo) / (hi - lo), 0, 1) * 100

  // Q1 → Q3 bar (the B+ range)
  const barL = pct(q.q1)
  const barW = Math.max(0, pct(q.q3) - pct(q.q1))

  const cP = pct(currentRent)
  const tP = pct(q.q3)

  const valueFromX = useCallback((clientX: number) => {
    const el = trackRef.current; if (!el) return currentRent
    const r = el.getBoundingClientRect()
    const p = clamp((clientX - r.left) / r.width, 0, 1)
    return clamp(Math.round((lo + p * (hi - lo)) / 5) * 5, sliderMin, sliderMax)
  }, [lo, hi, sliderMin, sliderMax, currentRent])

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => onChange(valueFromX(e.clientX))
    const up = () => setDrag(false)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
  }, [drag, onChange, valueFromX])

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 5
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { onChange(clamp(currentRent - step, sliderMin, sliderMax)); e.preventDefault() }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { onChange(clamp(currentRent + step, sliderMin, sliderMax)); e.preventDefault() }
  }

  return (
    <div className="ur-bullet">
      <div className="ur-bullet__track" ref={trackRef}
        onPointerDown={(e) => { setDrag(true); onChange(valueFromX(e.clientX)) }}>
        {/* Grey rail = Min → Max full market range */}
        <div className="ur-bullet__rail" />
        {/* Blue/purple bar = Q1 → Q3 (B+ range) */}
        <div className="ur-bullet__bar" style={{ left: `${barL}%`, width: `${barW}%` }} />
        {/* Target ellipse — pinned at Q3 / B+ mark */}
        <div className="ur-bullet__tgt" style={{ left: `${tP}%` }} title={`B+ target: ${fmt$(q.q3)}`}
          onPointerDown={(e) => e.stopPropagation()} />
        {/* Current rent ellipse — draggable */}
        <button className={`ur-bullet__cur${drag ? " is-drag" : ""}`} style={{ left: `${cP}%` }}
          onPointerDown={(e) => { e.stopPropagation(); setDrag(true) }}
          onKeyDown={onKey} role="slider" aria-label="Current rent (drag to adjust)"
          aria-valuenow={currentRent} aria-valuemin={sliderMin} aria-valuemax={sliderMax} />
      </div>
      <div className="ur-bullet__minmax">
        <span>{fmtK(q.min)}</span>
        <span>{fmtK(q.max)}</span>
      </div>
    </div>
  )
}

// ─── Unit Header Card ─────────────────────────────────────────────────────────

function UnitHeaderCard({ unit, currentRent, target, onCurrent, onOppClick }: {
  unit: Unit; currentRent: number; target: number
  onCurrent: (v: number) => void; onOppClick?: () => void
}) {
  const delta = target - currentRent
  const deltaPct = currentRent ? Math.round((delta / currentRent) * 100) : 0
  const up = delta > 0
  const curGrade = gradeFromPct(pctRank(currentRent, unit.cloud))
  const tgtGrade = gradeFromPct(pctRank(target, unit.cloud))

  return (
    <section className="ur-card ur-head">
      <div className="ur-head__top">
        <div>
          <h1 className="ur-head__name">{unit.name}</h1>
          <div className="ur-spec">
            <span>{unit.beds === 0 ? "Studio" : `${unit.beds} Bed${unit.beds !== 1 ? "s" : ""}`}</span>
            <i /><span>{unit.baths} Bath{unit.baths !== 1 ? "s" : ""}</span>
            {unit.sqft > 0 && <><i /><span>{unit.sqft.toLocaleString()} Sq Ft</span></>}
          </div>
        </div>
        <div className="ur-head__delta">
          <div className="ur-head__delta-top">
            <div className={`ur-head__delta-val${up ? "" : " is-down"}`}>
              {up ? "+" : "−"}{fmt$(Math.abs(delta))}<span>/mo</span>
            </div>
            {up && onOppClick && (
              <button className="ur-head__star" onClick={onOppClick} aria-label="View opportunity details">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M12 2l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78 6.8 19.5l.99-5.79-4.21-4.1 5.82-.85z" />
                </svg>
              </button>
            )}
          </div>
          <div className="ur-head__delta-pct">({up ? "+" : "−"}{Math.abs(deltaPct)}%)</div>
        </div>
      </div>

      <div className="ur-head__viz">
        <BulletGraph currentRent={currentRent}
          q={unit.q} sliderMin={unit.sliderMin} sliderMax={unit.sliderMax} onChange={onCurrent} />
        <div className="ur-head__foot">
          <div className="ur-rentcol">
            <div className="ur-rentcol__row">
              <span className="ur-dotkey ur-dotkey--cur" />
              <EditableRent value={currentRent} min={unit.sliderMin} max={unit.sliderMax} onChange={onCurrent} />
              <GradePill grade={curGrade} tone="warn" />
            </div>
            <div className="ur-rentcol__lbl">Current</div>
          </div>
          <div className="ur-rentcol ur-rentcol--right">
            <div className="ur-rentcol__row">
              <span className="ur-dotkey ur-dotkey--tgt" />
              <span className="ur-rentcol__val">{fmt$(target)}</span>
              <GradePill grade={tgtGrade} tone="good" />
            </div>
            <div className="ur-rentcol__lbl">Target</div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Opportunity Modal ────────────────────────────────────────────────────────

function OpportunityModal({ unit, currentRent, onClose }: {
  unit: Unit; currentRent: number; onClose: () => void
}) {
  const bedBath = `${unit.beds === 0 ? "Studio" : `${unit.beds}BR`}/${unit.baths}BA`
  const city = unit.city.split(",")[0]
  const pct = pctRank(currentRent, unit.cloud)

  const state = pct < 0.35 ? "below" : pct < 0.67 ? "at" : "above"
  const content = {
    below: {
      badge: "Strong Opportunity",
      title: "Below Market Rent",
      text: <>This <b>{bedBath}</b> unit is renting in the lower range of comparable listings in {city}. A targeted renovation could meaningfully increase cash flow and property value.</>,
    },
    at: {
      badge: "Moderate Opportunity",
      title: "At Market Rent",
      text: <>This <b>{bedBath}</b> unit is tracking near market rate in {city}. Selective upgrades could push it into the upper tier of comparable listings.</>,
    },
    above: {
      badge: "Well Positioned",
      title: "Above Market Rent",
      text: <>This <b>{bedBath}</b> unit is performing at or above comparable listings in {city}. Pushing further may extend vacancy — validate against the comps below.</>,
    },
  }[state]

  return (
    <ModalSheet open onClose={onClose} wide centered label="Opportunity Assessment">
      <div className="ur-opp-modal">
        <div className="ur-opp-modal__icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78 6.8 19.5l.99-5.79-4.21-4.1 5.82-.85z" />
          </svg>
        </div>
        <p className="ur-opp-modal__badge">{content.badge}</p>
        <h2 className="ur-opp-modal__title">{content.title}</h2>
        <p className="ur-opp-modal__text">{content.text}</p>
        <div className="ur-opp-modal__cta">
          <button className="ur-btn ur-btn--primary" onClick={onClose}>View Details</button>
        </div>
      </div>
    </ModalSheet>
  )
}

// ─── Market Bee-Swarm (data-relative x-axis) ──────────────────────────────────

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v))
  return out
}

function MarketCard({ unit, currentRent, target, scatterComps }: { unit: Unit; currentRent: number; target: number; scatterComps?: RentComp[] }) {
  const q = unit.q
  const range = q.max - q.min || 500
  const pad = range * 0.04
  const xMin = q.min - pad, xMax = q.max + pad

  const W = 560, H = 168, padL = 28, padR = 28
  const baseY = 72, band = 76, axisBot = H - 42
  const x = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * (W - padL - padR)

  const [tooltip, setTooltip] = useState<{ comp: RentComp; sx: number; sy: number } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTip = (comp: RentComp, sx: number, sy: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setTooltip({ comp, sx, sy })
  }
  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setTooltip(null), 220)
  }
  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  const pts = useMemo(() => {
    let s = unit.market.seed * 7 + 11
    const rng = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    if (scatterComps) {
      return scatterComps
        .filter(c => c.rent !== null)
        .map(c => ({
          rent: c.rent as number,
          cy: baseY + (rng() + rng() - 1) * (band / 2),
          comp: c,
        }))
    }
    return unit.cloud.map(rent => ({
      rent,
      cy: baseY + (rng() + rng() - 1) * (band / 2),
      comp: null as RentComp | null,
    }))
  }, [scatterComps ? scatterComps.length : unit.cloud.length, scatterComps ? scatterComps[0]?.rent : unit.cloudMin])

  const curGrade = gradeFromPct(pctRank(currentRent, unit.cloud))
  const tgtGrade = gradeFromPct(pctRank(target, unit.cloud))

  const refs = [
    { v: q.q1,     label: "Q1" },
    { v: q.median, label: "Med" },
    { v: q.q3,     label: "Q3" },
  ]

  const TIP_W = 172, TIP_H = 90

  return (
    <section className="ur-card">
      <div className="ur-eyebrow">Market — 2BR Oakland B+ Comps</div>
      <div className="ur-market__plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
          onClick={() => setTooltip(null)}>

          {/* Reference lines at Q1, Median, Q3 — name + dollar stacked at top */}
          {refs.map(({ v, label }) => (
            <g key={label}>
              <line x1={x(v)} y1={30} x2={x(v)} y2={axisBot}
                stroke="var(--ur-hair)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={x(v)} y={11} className="ur-tick" textAnchor="middle" fontSize="11">{label}</text>
              <text x={x(v)} y={23} className="ur-tick" textAnchor="middle" fontSize="10">{fmtK(v)}</text>
            </g>
          ))}

          {/* Axis */}
          <line x1={padL} y1={axisBot} x2={W - padR} y2={axisBot} className="ur-axis" strokeWidth="1" />

          {/* Dots — tap/hover to reveal comp details */}
          {pts.map((p, i) => {
            const isActive = !!p.comp && tooltip?.comp === p.comp
            return (
              <circle
                key={i}
                cx={x(p.rent)} cy={p.cy}
                r={isActive ? 6 : 4}
                className={`ur-dot${isActive ? " ur-dot--active" : ""}`}
                onMouseEnter={p.comp ? () => showTip(p.comp!, x(p.rent), p.cy) : undefined}
                onMouseLeave={p.comp ? scheduleHide : undefined}
                onClick={p.comp ? (e) => { e.stopPropagation(); setTooltip(t => t?.comp === p.comp ? null : { comp: p.comp!, sx: x(p.rent), sy: p.cy }) } : undefined}
              />
            )
          })}

          {/* Current rent marker — white with outline */}
          <circle cx={x(currentRent)} cy={baseY} r={6} className="ur-mark ur-mark--cur" />
          {/* Target marker — solid black */}
          <circle cx={x(target)} cy={baseY} r={5.5} className="ur-mark ur-mark--tgt"
            style={{ transition: "cx .35s cubic-bezier(.22,1,.36,1)" }} />

          {/* Min / Max — anchored at far left and far right of axis */}
          <text x={padL} y={H - 24} className="ur-tick" textAnchor="middle" fontSize="10">Min</text>
          <text x={padL} y={H - 12} className="ur-tick" textAnchor="middle">{fmtK(q.min)}</text>
          <text x={W - padR} y={H - 24} className="ur-tick" textAnchor="middle" fontSize="10">Max</text>
          <text x={W - padR} y={H - 12} className="ur-tick" textAnchor="middle">{fmtK(q.max)}</text>

          {/* Tooltip card — offset right of dot, stays open while hovered */}
          {tooltip && (() => {
            const spaceRight = W - padR - tooltip.sx
            const tx = spaceRight >= TIP_W + 14
              ? tooltip.sx + 12
              : Math.max(padL, tooltip.sx - TIP_W - 12)
            const ty = Math.max(4, tooltip.sy - TIP_H / 2 - 4)
            const c = tooltip.comp
            return (
              <foreignObject x={tx} y={ty} width={TIP_W} height={TIP_H} style={{ overflow: "visible" }}>
                <div className="ur-dot-tip"
                  onMouseEnter={cancelHide}
                  onMouseLeave={scheduleHide}>
                  <div className="ur-dot-tip__rent">{fmt$(c.rent!)}</div>
                  <div className="ur-dot-tip__addr">{c.address}</div>
                  <div className="ur-dot-tip__meta">{c.bedrooms}br {c.bathrooms}ba{c.sqft ? ` · ${c.sqft} SF` : ""}</div>
                  <div className="ur-dot-tip__grade">{c.grade}{c.market_score != null ? ` · ${c.market_score.toFixed(0)} overall` : ""}</div>
                </div>
              </foreignObject>
            )
          })()}
        </svg>
      </div>
      <div className="ur-market__legend">
        <div className="ur-legend">
          <span className="ur-legend__dot ur-legend__dot--cur" />
          <b>{fmt$(currentRent)}</b> Current <GradePill grade={curGrade} tone="warn" />
        </div>
        <div className="ur-legend">
          <span className="ur-legend__dot ur-legend__dot--tgt" />
          <b>{fmt$(target)}</b> Target <GradePill grade={tgtGrade} tone="good" />
        </div>
      </div>
    </section>
  )
}

// ─── Editable Rate Pill ───────────────────────────────────────────────────────

function EditableRate({ value, min, max, step, unit = "%", onChange, decimals = 1 }: {
  value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; decimals?: number
}) {
  const [open, setOpen] = useState(false)
  const disp = (v: number) => (v * 100).toFixed(decimals).replace(/\.0$/, "") + unit
  const set = (v: number) => onChange(Math.round(clamp(v, min, max) / step) * step)
  return open ? (
    <span className="ur-rate__edit">
      <button className="ur-step" onClick={() => set(value - step)}>−</button>
      <span className="ur-rate__num">{disp(value)}</span>
      <button className="ur-step" onClick={() => set(value + step)}>+</button>
      <button className="ur-rate__done" onClick={() => setOpen(false)}>Done</button>
    </span>
  ) : (
    <button className="ur-rate__btn" onClick={() => setOpen(true)}>
      <span>{disp(value)}</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </button>
  )
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

function BudgetCard({ currentRent, target, capRate, coc, onCap, onCoc }: {
  currentRent: number; target: number; capRate: number; coc: number
  onCap: (v: number) => void; onCoc: (v: number) => void
}) {
  const m = computeMetrics(currentRent, target, capRate, coc)
  const incPct = Math.round(m.increasePct * 100)
  return (
    <section className="ur-card">
      <div className="ur-eyebrow">Remodel Budget</div>
      <div className="ur-budget__hero">
        <span className="ur-budget__big">{fmt$(m.remodelBudget)}</span>
        <span className="ur-budget__est">est.</span>
      </div>
      <p className="ur-budget__cap">Estimated investment to bring the unit to target condition.</p>
      <div className="ur-rows">
        <div className="ur-row">
          <div>
            <div className="ur-row__lbl">Annual Cash Flow Increase</div>
            <div className="ur-row__val">{fmt$(m.annualCashFlow)}<span className="ur-row__yr">/yr</span></div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">Increase</div>
            <span className="ur-chip ur-chip--good">+{incPct}%</span>
          </div>
        </div>
        <div className="ur-row">
          <div>
            <div className="ur-row__lbl">Property Value Increase est.</div>
            <div className="ur-row__val">{fmt$(m.propertyValueInc)}</div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">Cap rate</div>
            <EditableRate value={capRate} min={0.03} max={0.12} step={0.001} decimals={1} onChange={onCap} />
          </div>
        </div>
        <div className="ur-row">
          <div>
            <div className="ur-row__lbl">Remodel Budget</div>
            <div className="ur-row__val">{fmt$(m.remodelBudget)}<span className="ur-row__yr">est.</span></div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">CoC target</div>
            <EditableRate value={coc} min={0.10} max={0.60} step={0.01} decimals={0} onChange={onCoc} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Grade Ladder Card ────────────────────────────────────────────────────────

function GradeLadderCard({ unit, currentRent, target }: { unit: Unit; currentRent: number; target: number }) {
  const { tiers, recIdx } = gradeLadder(currentRent, target, unit.cloud)
  const [level, setLevel] = useState(1)

  const curGrade = gradeFromPct(pctRank(currentRent, unit.cloud))
  const goals = [
    { key: "current", cap: "Current", cutoff: 0, grade: curGrade, rent: currentRent, markGoal: true },
    { key: "target",  cap: "Target",  cutoff: recIdx, grade: "B−", rent: tiers[recIdx].rent, markGoal: true },
    { key: "median",  cap: "Median",  cutoff: tiers.length - 1,
      grade: gradeFromPct(pctRank(tiers[tiers.length - 1].rent, unit.cloud)),
      rent: tiers[tiers.length - 1].rent, markGoal: false },
  ]
  const goal = goals[level]

  return (
    <section className="ur-card">
      <div className="ur-eyebrow">Path to a Higher Grade</div>
      <p className="ur-ladder__lead">
        Choose a target grade to see the renovations that get you there. Each level lifts the unit&rsquo;s quality score — and the rent the market will bear.
      </p>
      <div className="ur-ladder__btns" role="tablist">
        {goals.map((g, i) => (
          <button key={g.key} role="tab" aria-selected={i === level}
            className={`ur-gbtn${i === level ? " is-on" : ""}`} onClick={() => setLevel(i)}>
            <GradePill grade={g.grade} tone={i === level ? "good" : "neutral"} />
            <span className="ur-gbtn__cap">{g.cap}</span>
            <span className="ur-gbtn__rent">{fmt$(g.rent)}</span>
          </button>
        ))}
      </div>
      <div className="ur-ladder__rail">
        {tiers.map((t, i) => {
          const lit = i <= goal.cutoff
          const isGoal = goal.markGoal && i === goal.cutoff
          return (
            <div key={i} className={`ur-tier${lit ? " is-lit" : " is-dim"}${isGoal ? " is-goal" : ""}`}>
              <div className="ur-tier__node"><span className="ur-tier__dot" /></div>
              <div className="ur-tier__main">
                <div className="ur-tier__top">
                  <span className="ur-tier__label">
                    {t.label}{isGoal && <em className="ur-tier__tag">{goal.cap}</em>}
                  </span>
                  <GradePill grade={t.grade} tone={lit ? "good" : "neutral"} />
                </div>
                <div className="ur-tier__work">{t.work}</div>
                <div className="ur-tier__nums">
                  <span className="ur-tier__rent">{fmt$(t.rent)}<small>/mo</small></span>
                  <span className="ur-tier__score">score {t.score}</span>
                  <span className={`ur-tier__prem${t.premium > 0 ? " is-up" : ""}`}>
                    {t.premium > 0 ? `+${fmt$(t.premium)}/mo` : "baseline"}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Comps Rail ───────────────────────────────────────────────────────────────

function CompsRail({ comps, onOpen }: { comps: RentComp[]; onOpen: (c: RentComp) => void }) {
  if (!comps.length) return null
  return (
    <section className="ur-card ur-comps">
      <div className="ur-comps__head">
        <div className="ur-eyebrow">Comparables</div>
        <div className="ur-comps__hint">Swipe →</div>
      </div>
      <div className="ur-comps__rail">
        {comps.map((c, i) => (
          <button key={i} className="ur-comp" onClick={() => onOpen(c)}>
            <div className="ur-ph ur-ph--r" style={{ height: 110 }}>
              <span className="ur-ph__cap">Photo</span>
            </div>
            <div className="ur-comp__price">{fmt$(c.rent ?? 0)} <span>/ mo</span></div>
            {c.rent && c.sqft && <div className="ur-comp__psf">${(c.rent / parseInt(c.sqft)).toFixed(2)} / SF</div>}
            <hr className="ur-hr" />
            <div className="ur-comp__addr">
              <div>{c.address}</div>
              <div>{c.city}</div>
              <div className="ur-comp__miles">{c.distance.toFixed(1)} mi away</div>
            </div>
            <hr className="ur-hr" />
            <div className="ur-comp__spec">{c.bedrooms} bd · {c.bathrooms} ba{c.sqft ? ` · ${parseInt(c.sqft).toLocaleString()} SF` : ""}</div>
            <hr className="ur-hr" />
            <div className="ur-comp__scores">
              <div className="ur-comp__overall">
                <GradePill grade={c.grade} tone="good" />
                <span>{c.market_score?.toFixed(0)} Overall</span>
              </div>
              {c.walk_score && <div className="ur-comp__scorerow"><span>Walk Score</span><b>{c.walk_score}</b></div>}
              {c.parking_type && <div className="ur-comp__scorerow"><span>Parking</span><b>{c.parking_type}</b></div>}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

// ─── Modal Sheet ──────────────────────────────────────────────────────────────

function ModalSheet({ open, onClose, label, wide, centered, children }: {
  open: boolean; onClose: () => void; label?: string; wide?: boolean; centered?: boolean; children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  return (
    <div className={`ur-modal${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="ur-modal__scrim" onClick={onClose} />
      <div className={`ur-modal__sheet${wide ? " ur-modal__sheet--wide" : ""}${centered ? " ur-modal__sheet--centered" : ""}`} role="dialog" aria-modal aria-label={label}>
        {!centered && <div className="ur-modal__grab" onClick={onClose} />}
        {children}
      </div>
    </div>
  )
}

// ─── Comp Detail Modal ────────────────────────────────────────────────────────

const GRADE_SCORE: Record<string, number> = {
  A: 95, "A-": 88, "B+": 82, B: 75, "B-": 68, "C+": 60, C: 52, "C-": 45, "D+": 38, D: 30,
}

function CompModal({ comp, unitName, onClose }: { comp: RentComp; unitName: string; onClose: () => void }) {
  const psf = comp.rent && comp.sqft ? comp.rent / parseInt(comp.sqft) : null
  const scores = [
    { label: "Quality", grade: comp.grade },
    { label: "Location", grade: comp.walk_score ? gradeFromPct(parseInt(comp.walk_score) / 100) : "B" },
    { label: "Amenities", grade: comp.parking_type ? "B+" : "B-" },
  ]
  return (
    <>
      <div className="ur-sheet__gallery">
        <div className="ur-ph" style={{ height: 188 }}><span className="ur-ph__cap">Photo 1</span></div>
        <div className="ur-sheet__thumbs">
          {["2","3","+4"].map((l) => <div key={l} className="ur-ph ur-ph--r" style={{ height: 84 }}><span className="ur-ph__cap">{l}</span></div>)}
        </div>
      </div>
      <div className="ur-sheet__body">
        <div className="ur-sheet__top">
          <div>
            <div className="ur-sheet__price">{fmt$(comp.rent ?? 0)} <span>/ mo</span></div>
            {psf && <div className="ur-sheet__psf">${psf.toFixed(2)} / SF · {comp.bedrooms} bd · {comp.bathrooms} ba</div>}
          </div>
          <div className="ur-sheet__overall">
            <GradePill grade={comp.grade} tone="good" />
            <span>{comp.market_score?.toFixed(0)}<small>Overall</small></span>
          </div>
        </div>
        <div className="ur-sheet__addr">{comp.address}, {comp.city} · {comp.distance.toFixed(1)} mi from {unitName}</div>
        <div className="ur-eyebrow ur-sheet__eyebrow">Score breakdown</div>
        <div className="ur-bars">
          {scores.map(({ label, grade }) => (
            <div key={label} className="ur-bar">
              <div className="ur-bar__lbl">{label}</div>
              <div className="ur-bar__track"><div className="ur-bar__fill" style={{ width: `${GRADE_SCORE[grade] ?? 50}%` }} /></div>
              <div className="ur-bar__g"><GradePill grade={grade} tone="neutral" /></div>
            </div>
          ))}
        </div>
        <div className="ur-sheet__cta">
          <button className="ur-btn ur-btn--primary" onClick={onClose}>Use as comp</button>
          {comp.listing_url
            ? <a href={comp.listing_url} target="_blank" rel="noopener noreferrer"
                className="ur-btn ur-btn--ghost" style={{ display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
                View listing
              </a>
            : <button className="ur-btn ur-btn--ghost" onClick={onClose}>Close</button>}
        </div>
      </div>
    </>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, step = 1, onChange, fmt: fmtFn }: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; fmt?: (v: number) => string
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v / step) * step)))
  return (
    <div className="ur-stepper">
      <button type="button" className="ur-step" onClick={() => set(value - step)}>−</button>
      <span className="ur-stepper__val">{fmtFn ? fmtFn(value) : value}</span>
      <button type="button" className="ur-step" onClick={() => set(value + step)}>+</button>
    </div>
  )
}

// ─── Unit Form Sheet (Add / Edit) — wide modal ────────────────────────────────

function UnitFormSheet({ open, mode, unit, currentRent: liveCurrentRent, propertyAddress, onClose, onSave }: {
  open: boolean; mode: "add" | "edit"; unit: Unit | null; currentRent: number
  propertyAddress: string; onClose: () => void; onSave: (f: FormState) => void
}) {
  const blank: FormState = { name: "", address: propertyAddress, currentRent: "", sqft: 700, beds: 1, baths: 1, amenities: [] }
  const [f, setF] = useState<FormState>(blank)

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && unit) {
      setF({ name: unit.name, address: unit.address || propertyAddress, currentRent: liveCurrentRent, sqft: unit.sqft, beds: unit.beds, baths: unit.baths, amenities: [...(unit.amenities ?? [])] })
    } else {
      setF(blank)
    }
  }, [open, mode, unit?.id])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const toggleAm = (a: string) => setF((s) => ({ ...s, amenities: s.amenities.includes(a) ? s.amenities.filter((x) => x !== a) : [...s.amenities, a] }))
  const valid = f.name.trim().length > 0 && f.sqft > 0

  return (
    <ModalSheet open={open} onClose={onClose} wide label={mode === "edit" ? "Edit unit" : "Add unit"}>
      <div className="ur-form">
        <h2 className="ur-form__title">{mode === "edit" ? "Edit unit details" : "Add a unit"}</h2>
        <p className="ur-form__sub">
          {mode === "edit"
            ? "Update the unit and its amenities. The grade rubric recalculates from these."
            : `Add a unit to ${propertyAddress}. We'll estimate its target rent from comps.`}
        </p>

        <label className="ur-field">
          <span className="ur-field__lbl">Unit name</span>
          <input className="ur-input" value={f.name} placeholder="e.g. Unit 1" onChange={(e) => set("name", e.target.value)} />
        </label>

        <label className="ur-field">
          <span className="ur-field__lbl">Address</span>
          <input className="ur-input" value={f.address} onChange={(e) => set("address", e.target.value)} />
        </label>

        <label className="ur-field">
          <span className="ur-field__lbl">Current rent <em className="ur-field__hint">· per month</em></span>
          <div className="ur-input__money">
            <span className="ur-input__prefix">$</span>
            <input className="ur-input ur-input--money" type="number" inputMode="numeric"
              value={f.currentRent === "" ? "" : f.currentRent}
              placeholder="e.g. 2200"
              onChange={(e) => set("currentRent", e.target.value === "" ? "" : parseInt(e.target.value || "0", 10))} />
          </div>
        </label>

        <div className="ur-field__row">
          <label className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Square feet</span>
            <input className="ur-input" type="number" inputMode="numeric" value={f.sqft || ""} onChange={(e) => set("sqft", parseInt(e.target.value) || 0)} />
          </label>
          <div className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Bedrooms</span>
            <Stepper value={f.beds} min={0} max={6} onChange={(v) => set("beds", v)} fmt={(v) => v === 0 ? "Studio" : String(v)} />
          </div>
          <div className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Bathrooms</span>
            <Stepper value={f.baths} min={1} max={5} step={0.5} onChange={(v) => set("baths", v)} />
          </div>
        </div>

        <div className="ur-field">
          <span className="ur-field__lbl">Amenities <em className="ur-field__hint">· scored in the grade rubric</em></span>
          <div className="ur-amgrid">
            {AMENITIES.map((a) => {
              const on = f.amenities.includes(a)
              return (
                <button type="button" key={a} className={`ur-amchip${on ? " is-on" : ""}`} onClick={() => toggleAm(a)}>
                  <span className="ur-amchip__box">
                    {on && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  {a}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ur-form__cta">
          <button className="ur-btn ur-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ur-btn ur-btn--primary" disabled={!valid} onClick={() => onSave(f)}>
            {mode === "edit" ? "Save changes" : "Add unit"}
          </button>
        </div>
      </div>
    </ModalSheet>
  )
}

// ─── Save Lead Sheet ──────────────────────────────────────────────────────────

function SaveLeadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [done, setDone] = useState(false)
  useEffect(() => { if (open) { setName(""); setEmail(""); setDone(false) } }, [open])
  const valid = name.trim() && /.+@.+\..+/.test(email)

  return (
    <ModalSheet open={open} onClose={onClose} label="Save report">
      <div className="ur-form">
        {done ? (
          <div className="ur-saved">
            <div className="ur-saved__check">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2 className="ur-form__title">Report saved</h2>
            <p className="ur-form__sub">We&rsquo;ve emailed a copy to <b>{email}</b>. You can keep refining the targets any time.</p>
            <div className="ur-form__cta"><button className="ur-btn ur-btn--primary" onClick={onClose}>Done</button></div>
          </div>
        ) : (
          <>
            <h2 className="ur-form__title">Save this report</h2>
            <p className="ur-form__sub">Get a copy of these target-income estimates emailed to you.</p>
            <label className="ur-field">
              <span className="ur-field__lbl">Full name</span>
              <input className="ur-input" value={name} placeholder="Jordan Rivera" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="ur-field">
              <span className="ur-field__lbl">Email</span>
              <input className="ur-input" type="email" value={email} placeholder="you@company.com" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="ur-form__cta">
              <button className="ur-btn ur-btn--ghost" onClick={onClose}>Cancel</button>
              <button className="ur-btn ur-btn--primary" disabled={!valid} onClick={() => setDone(true)}>Save report</button>
            </div>
          </>
        )}
      </div>
    </ModalSheet>
  )
}

// ─── Mini Bullet (unit row) — even-spaced domain ──────────────────────────────

function MiniBullet({ currentRent, target, sliderMin, sliderMax }: {
  currentRent: number; target: number; sliderMin: number; sliderMax: number
}) {
  const span = Math.max(1, Math.abs(target - currentRent))
  const mid = (target + currentRent) / 2
  const half = Math.max(span * 1.6, (sliderMax - sliderMin) * 0.18)
  const lo = mid - half, hi = mid + half
  const pct = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100
  const cP = pct(currentRent), tP = pct(target)
  const fillL = Math.min(cP, tP), fillW = Math.abs(tP - cP)
  return (
    <div className="ur-mini">
      <div className="ur-mini__rail" />
      <div className="ur-mini__fill" style={{ left: `${fillL}%`, width: `${fillW}%` }} />
      <div className="ur-mini__cur" style={{ left: `${cP}%` }} />
      <div className="ur-mini__tgt" style={{ left: `${tP}%` }} />
    </div>
  )
}

// ─── Rent Roll Screen ─────────────────────────────────────────────────────────

function RentRollScreen({ units, state, propertyAddress, onOpenUnit, onAddUnit }: {
  units: Unit[]; state: Record<string, UnitState>
  propertyAddress: Address; onOpenUnit: (id: string) => void; onAddUnit: () => void
}) {
  const sumCur = units.reduce((s, u) => s + (state[u.id]?.currentRent ?? u.currentRent), 0)
  const sumTgt = units.reduce((s, u) => s + (state[u.id]?.target ?? u.suggestedTarget), 0)
  const upMo = sumTgt - sumCur
  const upPct = sumCur ? Math.round((upMo / sumCur) * 100) : 0

  return (
    <div className="ur-roll">
      <div className="ur-roll__addr">{propertyAddress.street} · {propertyAddress.city}, {propertyAddress.state}</div>

      <section className="ur-card">
        <div className="ur-summary__grid">
          <div className="ur-stat ur-stat--l">
            <div className="ur-stat__lbl">Current / yr</div>
            <div className="ur-stat__val">{fmt$(sumCur)}</div>
          </div>
          <div className="ur-stat ur-stat--c">
            <div className="ur-stat__lbl">Target / yr</div>
            <div className="ur-stat__val">{fmt$(sumTgt)}</div>
          </div>
          <div className="ur-stat ur-stat--r">
            <div className="ur-stat__lbl">Monthly upside</div>
            <div className="ur-stat__val ur-stat__val--accent">+{fmt$(upMo)}</div>
          </div>
        </div>
        <div className="ur-summary__bar">
          <div className="ur-summary__fill" style={{ width: `${Math.min(100, (sumCur / sumTgt) * 100)}%` }} />
        </div>
        <div className="ur-summary__foot">
          <span>{units.length} unit{units.length !== 1 ? "s" : ""}</span>
          <span><b className="ur-up">+{upPct}%</b> potential gross uplift · +{fmt$(upMo * 12)}/yr</span>
        </div>
      </section>

      <div className="ur-roll__listhead">
        <div className="ur-roll__listlbl">Units</div>
        <button className="ur-addunit" onClick={onAddUnit} aria-label="Add a unit">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          <span>Add unit</span>
        </button>
      </div>

      <div className="ur-roll__list">
        {units.map((u) => {
          const st = state[u.id]
          const currentRent = st?.currentRent ?? u.currentRent
          const target = st?.target ?? u.suggestedTarget
          const delta = target - currentRent
          const up = delta > 0
          const curGrade = gradeFromPct(pctRank(currentRent, u.cloud))
          const tgtGrade = gradeFromPct(pctRank(target, u.cloud))
          const spec = `${u.beds === 0 ? "Studio" : `${u.beds} bd`} · ${u.baths} ba · ${u.sqft.toLocaleString()} SF`
          return (
            <button key={u.id} className="ur-urow" onClick={() => onOpenUnit(u.id)}>
              <div className="ur-urow__head">
                <div>
                  <div className="ur-urow__name">{u.name}</div>
                  <div className="ur-urow__spec">{spec}</div>
                </div>
                <div className={`ur-urow__delta${up ? "" : " is-flat"}`}>
                  {up ? `+${fmt$(delta)}/mo` : "At market"}
                </div>
              </div>
              <div className="ur-urow__bullet">
                <div className="ur-urow__side">
                  <span className="ur-urow__rent">{fmt$(currentRent)}</span>
                  <GradePill grade={curGrade} tone="warn" />
                </div>
                <MiniBullet currentRent={currentRent} target={target} sliderMin={u.sliderMin} sliderMax={u.sliderMax} />
                <div className="ur-urow__side ur-urow__side--r">
                  <span className="ur-urow__rent">{fmt$(target)}</span>
                  <GradePill grade={tgtGrade} tone="good" />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="ur-footnote">Estimates for illustration · not financial advice</div>
    </div>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ screen, unitName, onBack, onEdit }: {
  screen: "roll" | "unit"; unitName?: string
  onBack: () => void; onEdit: () => void
}) {
  return (
    <header className={`ur-topbar ur-topbar--${screen}`}>
      <div className="ur-topbar__l">
        {screen === "unit" && (
          <button className="ur-iconbtn" onClick={onBack} aria-label="Back to rent roll">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
      </div>
      <div className="ur-title">
        {screen === "roll"
          ? <><span className="ur-brand__mark" /><span className="ur-brand__name">Get Rent Ready</span></>
          : <span className="ur-brand__name">{unitName}</span>}
      </div>
      <div className="ur-topbar__r">
        {screen === "roll" ? (
          <label className="ur-search">
            <svg className="ur-search__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input className="ur-search__input" type="search" placeholder="Locate a property" aria-label="Locate a property" readOnly />
          </label>
        ) : (
          <button className="ur-iconbtn" onClick={onEdit} aria-label="Edit unit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PropertyScreens({ propertyAddress, initialUnitType, initialEstimate }: PropertyScreensProps) {
  const beds = BEDS[initialUnitType]
  const seed = addrSeed(propertyAddress)
  const rentcastMedian = initialEstimate.rent ?? 2000

  const initialUnit = useMemo(() => makeUnit({
    seed,
    n: "Unit 1",
    address: propertyAddress.street,
    city: `${propertyAddress.city}, ${propertyAddress.state} ${propertyAddress.zip}`,
    beds,
    baths: 1,
    sqft: SQFT[initialUnitType],
    currentRent: rentcastMedian,
    suggestedTarget: Math.round((rentcastMedian * 1.12) / 5) * 5,
    median: rentcastMedian,
    amenities: [],
  }), [])

  const [units, setUnits] = useState<Unit[]>([initialUnit])
  const [unitState, setUnitState] = useState<Record<string, UnitState>>({
    [initialUnit.id]: {
      currentRent: initialUnit.currentRent,
      target: initialUnit.suggestedTarget,
      capRate: initialUnit.capRate,
      coc: initialUnit.coc,
    },
  })
  const [screen, setScreen] = useState<"roll" | "unit">("unit")
  const [activeId, setActiveId] = useState(initialUnit.id)
  const [dir, setDir] = useState(1)
  const [showOppModal, setShowOppModal] = useState(true)
  const [form, setForm] = useState<{ open: boolean; mode: "add" | "edit" }>({ open: false, mode: "add" })
  const [leadOpen, setLeadOpen] = useState(false)
  const [modalComp, setModalComp] = useState<RentComp | null>(null)
  const [comps, setComps] = useState<RentComp[]>([])
  const [rubricQ, setRubricQ] = useState<Quantiles | null>(null)
  const [rubricRents, setRubricRents] = useState<number[]>([])

  const unit = units.find((u) => u.id === activeId) ?? units[0]
  const st = unitState[unit.id] ?? { currentRent: unit.currentRent, target: unit.suggestedTarget, capRate: unit.capRate, coc: unit.coc }
  const setVal = (k: keyof UnitState, v: number) =>
    setUnitState((s) => ({ ...s, [unit.id]: { ...s[unit.id], [k]: v } }))

  // live unit merges mutable currentRent for all downstream cards
  const liveUnit = useMemo(() => ({ ...unit, currentRent: st.currentRent }), [unit, st.currentRent])

  // apply rubric quantiles + real rent cloud to the live unit's display
  const displayUnit = useMemo(() => {
    const base = rubricQ
      ? {
          ...liveUnit,
          q: rubricQ,
          sliderMin: Math.min(liveUnit.sliderMin, Math.round((rubricQ.min * 0.94) / 5) * 5),
          sliderMax: Math.max(liveUnit.sliderMax, Math.round((rubricQ.max * 1.08) / 5) * 5),
        }
      : liveUnit
    if (rubricRents.length < 5) return base
    const sorted = [...rubricRents].sort((a, b) => a - b)
    return {
      ...base,
      cloud: rubricRents,
      cloudMin: sorted[0],
      cloudMax: sorted[sorted.length - 1],
    }
  }, [liveUnit, rubricQ, rubricRents])

  // fetch rubric comps, quantiles, and real rent cloud
  useEffect(() => {
    if (!propertyAddress.lat || !propertyAddress.lng) return
    fetch(`/api/comps?lat=${propertyAddress.lat}&lng=${propertyAddress.lng}&bedrooms=${beds}&bathrooms=${initialUnit.baths}&zip=${encodeURIComponent(propertyAddress.zip ?? "")}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.comps) setComps(data.comps)
        if (data.rents?.length >= 5) setRubricRents(data.rents)
        if (data.quantiles) {
          setRubricQ(data.quantiles)
          const q3 = data.quantiles.q3
          setUnitState((prev) => {
            const next = { ...prev }
            Object.keys(next).forEach((id) => {
              if (next[id].target === initialUnit.suggestedTarget) {
                next[id] = { ...next[id], target: Math.round(q3 / 5) * 5 }
              }
            })
            return next
          })
        }
      })
      .catch(() => {})
  }, [propertyAddress.lat, propertyAddress.lng])

  const openUnit = (id: string) => { setActiveId(id); setDir(1); setScreen("unit"); setShowOppModal(true); window.scrollTo(0, 0) }
  const backToRoll = () => { setDir(-1); setScreen("roll"); window.scrollTo(0, 0) }

  const addUnit = (f: FormState) => {
    const newSeed = seed + units.length * 37
    const cr = typeof f.currentRent === "number" && f.currentRent > 0
      ? f.currentRent
      : Math.round((1150 + f.beds * 540 + f.sqft * 1.05) / 5) * 5
    const u = makeUnit({
      seed: newSeed, n: f.name, address: propertyAddress.street,
      city: `${propertyAddress.city}, ${propertyAddress.state} ${propertyAddress.zip}`,
      beds: f.beds, baths: f.baths, sqft: f.sqft, currentRent: cr,
      suggestedTarget: rubricQ ? Math.round(rubricQ.q3 / 5) * 5 : Math.round((cr * 1.12) / 5) * 5,
      median: rubricQ?.median ?? cr, amenities: f.amenities,
    })
    setUnits((arr) => [...arr, u])
    setUnitState((s) => ({ ...s, [u.id]: { currentRent: u.currentRent, target: u.suggestedTarget, capRate: u.capRate, coc: u.coc } }))
    setForm({ open: false, mode: "add" })
    openUnit(u.id)
  }

  const saveEdit = (f: FormState) => {
    const cr = typeof f.currentRent === "number" && f.currentRent > 0 ? f.currentRent : unit.currentRent
    const updated = makeUnit({ ...rawFromUnit(unit), n: f.name, beds: f.beds, baths: f.baths, sqft: f.sqft, currentRent: cr, amenities: f.amenities })
    setUnits((arr) => arr.map((x) => (x.id === updated.id ? updated : x)))
    setUnitState((s) => ({ ...s, [updated.id]: { ...s[updated.id], currentRent: cr } }))
    setForm({ open: false, mode: "edit" })
  }

  return (
    <div className="ur-root">
      <div className="ur-shell">
        <TopBar screen={screen} unitName={unit.name}
          onBack={backToRoll}
          onEdit={() => setForm({ open: true, mode: "edit" })} />

        {screen === "roll" && (
          <RentRollScreen units={units} state={unitState} propertyAddress={propertyAddress}
            onOpenUnit={openUnit} onAddUnit={() => setForm({ open: true, mode: "add" })} />
        )}

        {screen === "unit" && (
          <>
            {showOppModal && (
              <OpportunityModal
                unit={displayUnit}
                currentRent={st.currentRent}
                onClose={() => setShowOppModal(false)}
              />
            )}
            <div className="ur-stack" data-dir={String(dir)}>
              <div className="ur-loc">{displayUnit.address} · {displayUnit.city}</div>
              <UnitHeaderCard unit={displayUnit} currentRent={st.currentRent} target={st.target}
                onCurrent={(v) => setVal("currentRent", v)}
                onOppClick={st.target > st.currentRent ? () => setShowOppModal(true) : undefined} />
              <MarketCard unit={displayUnit} currentRent={st.currentRent} target={st.target} scatterComps={comps.length > 0 ? comps : undefined} />
              <GradeLadderCard unit={displayUnit} currentRent={st.currentRent} target={st.target} />
              <BudgetCard currentRent={st.currentRent} target={st.target}
                capRate={st.capRate} coc={st.coc}
                onCap={(v) => setVal("capRate", v)} onCoc={(v) => setVal("coc", v)} />
              {comps.length > 0 && <CompsRail comps={comps} onOpen={setModalComp} />}
              <button className="ur-save" onClick={() => setLeadOpen(true)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
                Save report
              </button>
              <div className="ur-footnote">Estimates for illustration · not financial advice</div>
            </div>
          </>
        )}
      </div>

      <ModalSheet open={!!modalComp} onClose={() => setModalComp(null)} label="Comparable detail">
        {modalComp && <CompModal comp={modalComp} unitName={unit.name} onClose={() => setModalComp(null)} />}
      </ModalSheet>

      <UnitFormSheet open={form.open} mode={form.mode}
        unit={screen === "unit" ? unit : null}
        currentRent={st.currentRent}
        propertyAddress={propertyAddress.street}
        onClose={() => setForm((s) => ({ ...s, open: false }))}
        onSave={form.mode === "edit" ? saveEdit : addUnit} />

      <SaveLeadSheet open={leadOpen} onClose={() => setLeadOpen(false)} />
    </div>
  )
}
