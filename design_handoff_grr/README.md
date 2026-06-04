# Handoff: GRR — Unit Target-Income App

## Overview
**GRR** ("Gross Rent Roll") is a card-based, mobile-first app that shows a property owner the **target rent potential** of each apartment unit and the renovation path to get there. For any unit it surfaces: current vs. target rent, the monthly/annual upside, where the unit sits in the local rental market, an estimated remodel budget, a ladder of renovation tiers that each raise the unit's letter grade, and a rail of comparable listings. Users can browse a whole property's rent roll, drill into a unit, edit unit details, and save a report (lead capture).

---

## About the Design Files
The files in this bundle are **design references created in HTML/React (via in-browser Babel)** — prototypes that demonstrate intended look, layout, and behavior. **They are not production code to copy directly.**

Your task is to **recreate these designs in the target codebase's existing environment**, using its established patterns, component library, routing, and state management. If no front-end environment exists yet, choose the most appropriate framework for the project (React, React Native, SwiftUI, etc.) and implement the designs there. The math/model logic in `data.jsx` is the most directly reusable part — it is plain functions and can be ported almost verbatim.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, interaction behavior, and copy are all intentional. Recreate the UI to match, using the codebase's existing primitives where they exist (buttons, sheets, sliders). Exact tokens are listed below.

---

## Tech Notes on the Prototype (for reference)
- React 18 + Babel standalone, no build step. Each `*.jsx` file is a `<script type="text/babel">`.
- Components are shared across files via `window` (e.g. `window.UnitHeader`). In a real codebase, these become normal module imports.
- A `tweaks-panel.jsx` exists **only** for in-prototype design exploration (accent color, card style, radius, density). **Do not port the Tweaks panel** — it is a design tool, not a product feature. Its values do, however, reveal which tokens are themeable (see Design Tokens).

---

## Screens / Views

### 1. Rent Roll (list) — `screen === 'roll'`
**Purpose:** Browse all units in a property; see portfolio-level upside; jump into a unit; add a new unit.

**Layout:**
- Centered single column, `max-width: 468px`, `padding: 0 18px 40px`. The whole app lives in this column on all viewport sizes (mobile-style even on desktop).
- **Top bar** — sticky, `z-index: 20`, background `--cream`. CSS grid `40px 1fr 40px`: left cell empty, center cell a centered title **"Rent Roll"** (with a small brand mark square), right cell the **Add (+) button**.
- **Summary card** — portfolio totals: In-place /mo, Target /mo, Monthly upside (accent-colored), a progress bar, and "N units · +X% potential gross uplift · +$Y/yr".
- **"UNITS"** mono eyebrow label, then a stack of **unit rows**.

**Unit row component** (`.ur-urow`, a clickable card):
- Top line: unit name (e.g. "Unit 101") left, monthly upside (e.g. "+$225/mo", green) right.
- Sub-line: spec — `Studio · 1 ba · 480 SF` (mono, muted).
- A compact **bullet/range bar** showing current (hollow dot) → target (filled dot) against the market range.
- Bottom: `$1,495 → $1,720` with a letter-grade pill, and a chevron `›` on the right.

**Add (+) button** (`.ur-iconbtn.ur-iconbtn--accent`):
- 34×34 circle, **transparent background**, **1px solid `--ink` border (outlined ellipse)**, **black `+` glyph** (`--ink`), no shadow. Background shows through. Hover: `background: color-mix(in srgb, var(--ink) 8%, transparent)`.
- Opens the Add-unit form sheet (`mode: 'add'`).

### 2. Unit Detail — `screen === 'unit'`
**Purpose:** The core screen — everything about one unit's income potential. Vertical stack of cards.

**Top bar:** grid `40px 1fr 40px`. Left = **Back button** (`‹`), center = title **"Unit"**, right = **Edit button** (pencil). Both Back and Edit use `.ur-iconbtn`: 34×34 circle, **transparent background, 1px solid `--ink` outline**, ink-colored icon — background shows through.

Cards in order (each `.ur-card`: white, `border-radius: var(--radius, 18px)`, `padding: var(--card-pad, 22px)`):

**(a) Unit Header** (`.ur-head`)
- Location eyebrow above the card: `2836 TELEGRAPH AVE · OAKLAND, CA 94609` (mono, faint).
- Name (e.g. "Unit 101") + spec line `Studio | 1 Bath | 480 Sq Ft`.
- Right: monthly delta `+$225 /mo` (green if positive) and `(+15%)`.
- **Bullet graph** (replaces a slider): a horizontal range showing market **min, Q1, median, Q3, max** as a banded bar, with the **current rent** as a hollow marker and **target rent** as a filled accent marker. Labeled `TYPICAL $1,636–$1,776` (Q1–Q3 range).
- Bottom row: `○ $1,495 [D] CURRENT` … `TARGET [B-] $1,720 ●`.

**(b) Potential Opportunity** (`.ur-opp`)
- Tea-green card (`--mint`), star icon, headline "Potential Opportunity", body copy referencing comparable listings (e.g. "This unit's rent reads lower than comparable 0BR/1BA listings in Oakland — a likely opening to raise income by refreshing its present condition.").

**(c) Market** (`.ur-market`)
- "MARKET" eyebrow.
- **Bee-swarm scatter plot** (SVG): a cloud of comparable rents jittered vertically along a rent axis ($0–$4k ticks). Current rent = hollow ink marker, target = filled accent marker (animates horizontally when target changes).
- Legend: `● $1,495 Current [D]` and `● $1,720 Target [B-]`.

**(d) Remodel Budget** (`.ur-budget`)
- "REMODEL BUDGET" eyebrow.
- Big number = estimated remodel budget (e.g. `$9,643`).
- Rows: **Annual Cash Flow Increase** (`$X/yr`, +% chip), **Property Value Increase est.** (`$X`, with editable **Cap rate** pill), **Cash-on-Cash** (with editable **CoC target** pill). Editing cap rate or CoC live-recomputes the budget and value numbers.
- Editable pills (`.ur-rate`): tap to reveal a `− value +` stepper with a Done button.

**(e) Path to a Higher Grade** (`.ur-ladder`)
- "Path to a Higher Grade" eyebrow + lead paragraph.
- **Three selectable milestone buttons** (`.ur-gbtn`), segmented: **C** (cap "Current"), **B−** (cap "Target", selected by default), **B+** (cap "Median"). Each shows its grade pill, caption, and the rent at that level.
- Selecting a button **progressively lights the tier rail below**: the **C** button lights only the first tier (Current condition) and dims the rest; **B−** lights through the recommended/target tier; **B+** lights all tiers. The selected cutoff tier gets a "goal" highlight (accent ring + tinted background + a tag showing the caption).
- **Tier rail** (`.ur-ladder__rail`): a vertical list of renovation tiers, each with a node dot, label (e.g. "Partial remodel"), scope of work ("Flooring, paint, updated bath"), target rent `$1,735/mo`, quality `score 80`, and premium `+$240/mo`. Lit tiers full opacity; dimmed tiers `opacity: .32`.
- **Note:** an earlier version had a regression scatter plot between the buttons and the rail. It was **removed** — there is no chart in this card now; buttons sit directly above the tier rail.

**(f) Comparables** (`.ur-comps`)
- "COMPARABLES" eyebrow + "SWIPE →" hint.
- Horizontal **scroll-snap rail** of comp cards (`.ur-comp`, `flex: 0 0 232px`). Each: photo placeholder, `$3,200 / mo`, `$/SF`, address/city, `mi away`, spec, an "Overall" grade pill + score, and a per-attribute grade list (Quality / Size·Layout / Amenities / Location).
- Tapping a comp opens the **Comp Detail modal**.

**(g) Save Report button** (`.ur-save`)
- Full-width, 52px, `border-radius: var(--radius)`, **1.5px dashed** accent-tinted border, **transparent background**, accent text, save icon + "Save report". Background shows through. Hover tints faintly. Opens the Save-report (lead capture) modal.

- Footnote: "Estimates for illustration · not financial advice".

### 3. Modals (bottom sheets) — `ModalSheet`
All modals are bottom sheets: scrim (`rgba(50,50,44,.42)`), sheet slides up from bottom (`translateY(100%) → 0`, `cubic-bezier(.22,1,.36,1)`, ~360ms), `max-width: 468px`, rounded top corners, drag-handle at top, Esc / scrim-tap / handle-tap to close.

**(i) Comp Detail** (`CompModal`) — photo gallery (1 large + 3 thumbs), price/$SF/spec, overall grade+score, address + distance, blurb, a **score breakdown** with per-attribute bars + grade pills, and CTAs "Use as comp" / "View listing".

**(ii) Add / Edit Unit** (`UnitFormSheet`) — title "Add a unit" or "Edit unit details". Fields: **Unit name**, **Address**, **Sq Ft**, **# Beds**, **# Baths**, and an **Amenities** checkbox grid (the grade rubric). Footer: Cancel / "Add unit" or "Save changes". On save, the unit's grade rubric **recalculates** from the new amenities/specs (re-runs `makeUnit`).

**(iii) Save Report** (`SaveLeadSheet`) — lead capture: **Name** + **Email** fields, submit → a success state ("Report saved" with a checkmark).

---

## Interactions & Behavior
- **Rent Roll → Unit:** tap a unit row → `screen = 'unit'`, slide/fade transition. Back button returns to `'roll'`.
- **Bullet graph / market plot:** target marker animates (`cx` transition ~350ms) when target changes.
- **Editable cap rate / CoC:** tap pill → stepper; `±step` clamped to `[min,max]`; live-recompute of budget + property-value numbers via `computeMetrics`.
- **Grade milestone buttons:** selecting one sets a `cutoff` index; tiers at index `≤ cutoff` are "lit", the rest "dimmed" (`opacity .32`); the cutoff tier shows the goal highlight + caption tag.
- **Comps rail:** native horizontal scroll with `scroll-snap-type: x mandatory`; scrollbar hidden. Tap a card → Comp Detail modal.
- **Add/Edit unit:** form writes back into the units array; grade recalculation is automatic from amenities + rent standing.
- **Save report:** validates name + email present, then shows success state.
- **Reduced motion:** entrance animations are transform-only and must not leave content at `opacity: 0` at rest (respect `prefers-reduced-motion`).

## State Management
Top-level state lives in `app.jsx`:
- `screen`: `'roll' | 'unit'` — which view is shown.
- `units`: array of derived unit objects (from `makeUnit`). Add/Edit mutate this.
- `activeUnitId` / index: which unit the detail screen shows.
- Per-unit editable state: `target` (rent), `capRate`, `coc`. (In the prototype these are tracked per unit id.)
- `form`: `{ open, mode: 'add' | 'edit' }` for the unit form sheet.
- `leadOpen`: boolean for Save-report sheet.
- `modalComp`: the comp object shown in the detail sheet (or null).
- Grade-ladder selection (`level`: 0/1/2) is local to the ladder card, default `1` (Target / B−).

---

## The Model (port this logic — see `data.jsx`)

**Finance** — `computeMetrics(unit, target, capRate, coc)`:
```
monthly          = max(0, target − currentRent)
annualCashFlow   = monthly × 12
increasePct      = (target − currentRent) / currentRent
propertyValueInc = annualCashFlow / capRate          // income-cap valuation
remodelBudget    = annualCashFlow / coc              // budget implied by a target cash-on-cash
```

**Market cloud** — each unit gets a deterministic, seeded cloud of ~44 comparable rents (`makeCompCloud`, seeded `mulberry32` RNG) centered on `market.median` with `spread = median × 0.18`. Quantiles (min/Q1/median/Q3/max) drive the bullet graph; the raw cloud drives the bee-swarm.

**Letter grade** — `gradeFromPct(pctRank(rent, cloud))`. A rent's percentile rank within the comp cloud maps to A / A− / B+ / B / B− / C+ / C / C− / D+ / D via fixed thresholds (`0.92→A`, `0.82→A−`, … `0→D`).

**Quality score (0–100)** — `scoreFor(rent, cloud) = 62 + pctRank × 33` (≈62–95).

**Renovation ladder** — `LADDER_DEF` (6 tiers, each a % rent lift over current):
| Tier | Work | % lift |
|---|---|---|
| Current condition | No upgrades | 0% |
| Cosmetic refresh | Paint, deep clean, dishwasher, microwave | 10% |
| Partial remodel | Flooring, paint, updated bath | 16% |
| Kitchen update | Above + updated kitchen | 25% |
| Full remodel | Kitchen, bath, floors, fresh paint | 31% |
| In-unit laundry | Full remodel + W/D (if hookups) | 41% |

`gradeLadder(unit, target)` computes each tier's rent (`currentRent × (1+pct)`), score, grade, and premium; the tier closest to the target rent is flagged `recommended` (drives the B− "Target" milestone).

**Amenities rubric** — `AMENITIES` (10 checkboxes): In-unit Laundry, Dishwasher, Central A/C, Updated Kitchen, Updated Bath, Hardwood Floors, Off-street Parking, Private Outdoor, Walk-in Closet, Stainless Appliances. Edited in the unit form; feed the grade.

**Comps** — `genComps(seed, beds, baths, sqft, median)` procedurally generates 4–6 comparable listings (seeded) with rent/sqft/address/distance/grades/blurb.

---

## Design Tokens

**Color palette** (CSS custom properties on `:root`):
| Token | Hex | Role |
|---|---|---|
| `--ink` | `#32322C` | Charcoal — primary text, outlines |
| `--muted` | `#6B695F` | Secondary text |
| `--faint` | `#9B978C` | Tertiary / mono eyebrows |
| `--cream` | `#F0EDE5` | Softlinen — app background |
| `--cream-2` | `#E5DECF` | Pale Oak tint — bars/tracks |
| `--oak` | `#D4CBB3` | Pale Oak |
| `--card` | `#FFFFFF` | Card surface |
| `--hair` | `rgba(50,50,44,.10)` | Hairline borders |
| `--accent` | `#4D6CFA` | **Electric Saphire — primary/brand (purple-blue)** |
| `--mint` / `--mint-edge` | `#D2E0BF` / `#BCCFA0` | Tea Green — opportunity card |
| `--rose` | `#F76F8E` | Bubblegum — reserved accent |
| `--good-bg` / `--good-fg` | `#E2EED2` / `#4A6E2C` | Positive grade pills/chips |
| `--warn-bg` / `--warn-fg` | `#FAE8CF` / `#946312` | Caution pills |
| `--neutral-bg` / `--neutral-fg` | `#EAE6DB` / `#5C5950` | Neutral pills |

`--accent` is the one brand color; it is themeable. Keep it as the purple-blue Electric Saphire.

**Typography:**
- Body/UI: **"Schibsted Grotesk"** (Google Fonts), weights 400/500/600/700. Fallback `system-ui, sans-serif`.
- Mono (eyebrows, specs, ticks, labels): **"Geist Mono"**, 400/500. Used uppercase with `letter-spacing` for eyebrow labels.
- Base font-size `15.5px` (themeable via `--fs`); line-height `1.45`. Numbers use `font-variant-numeric: tabular-nums`. Headings use slight negative letter-spacing (`-.01em` to `-.025em`).

**Spacing / shape (themeable):**
- `--radius` card corner radius default `18px`; `--radius-img` = `radius − 6`.
- `--card-pad` default `22px`; `--stack-gap` default `16px`.
- Density presets (compact/regular/comfy) adjust pad/gap/font: e.g. regular = `{pad:22, gap:16, fs:15.5}`.
- App column: `max-width: 468px`, centered.

**Card style** (themeable, three variants — pick "shadow" as default):
- `shadow`: `box-shadow: 0 1px 2px rgba(50,50,44,.04), 0 10px 30px -16px rgba(50,50,44,.22)`.
- `flat`: no shadow, `1px solid --hair` border.
- `outline`: no shadow, `1.5px solid rgba(50,50,44,.16)` border.

**Grade pill** (`.ur-grade`): min-width 30px, height 21px, radius 6px, 12px/600. Tones map to the good/warn/neutral bg+fg pairs above.

**Buttons of note:**
- Top-bar icon buttons (Back, Edit, Add): 34×34 circle, **transparent fill, 1px solid `--ink` outline**, ink icon. Hover = 8% ink wash.
- Save report: full-width 52px, `--radius`, **1.5px dashed** accent-tinted border, transparent fill, accent text.

---

## Assets
- **Fonts:** Schibsted Grotesk + Geist Mono via Google Fonts (`<link>` in `UnitRoll.html`). Use the codebase's font-loading approach.
- **Icons:** inline SVG (stroke-based, ~1.6–2.4 stroke width): star, chevrons, pencil (edit), plus, save/disk, checkmark. Replace with the codebase's icon set.
- **Photos:** the prototype uses striped **placeholder** blocks (`.ur-ph`) labeled "PHOTO". Wire these to real listing imagery in production.
- **No raster/brand image assets** are required.

---

## Files (in this bundle)
| File | Contents |
|---|---|
| `UnitRoll.html` | Entry point: `:root` design tokens, **all CSS** (the source of truth for styling), font links, script load order. |
| `data.jsx` | **Model layer** — finance math, market cloud + quantiles, grade/score functions, renovation ladder, amenities rubric, comp generator, the property + units data. Port this first. |
| `cards.jsx` | Unit header (bullet graph), Opportunity card, Market bee-swarm, grade pill, range/slider primitives. |
| `budget-comps.jsx` | Remodel Budget card (editable cap-rate/CoC pills), Comparables rail + card, Comp Detail modal, photo placeholder, `ModalSheet` base. |
| `forms-grade.jsx` | "Path to a Higher Grade" card (milestone buttons + tier rail), Add/Edit Unit form sheet, Save Report (lead) sheet. |
| `rentroll.jsx` | Rent Roll list screen — summary card + unit rows. |
| `app.jsx` | Top-level app: screen routing (roll/unit), state, top bar, modal orchestration. |
| `tweaks-panel.jsx` | **Design-exploration tool only — do not port.** Reveals which tokens are themeable. |

**Start here:** read `UnitRoll.html` (tokens + CSS) and `data.jsx` (model). Open `UnitRoll.html` in a browser to see the live design before implementing.
