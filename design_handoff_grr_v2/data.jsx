// data.jsx — one property, its units, finance model, grade + market helpers
// Exposed on window for the other Babel scripts.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeCompCloud(seed, median, spread, n) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = (rnd() + rnd() + rnd()) / 3 - 0.5;
    out.push(Math.round((median + g * spread * 2) / 5) * 5);
  }
  return out;
}
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtK = (n) => '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k';

function gradeFromPct(p) {
  const scale = [[0.92, 'A'], [0.82, 'A-'], [0.72, 'B+'], [0.60, 'B'], [0.48, 'B-'], [0.36, 'C+'], [0.24, 'C'], [0.14, 'C-'], [0.06, 'D+'], [0.0, 'D']];
  for (const [t, g] of scale) if (p >= t) return g;
  return 'D';
}
function pctRank(value, cloud) {
  let below = 0; for (const c of cloud) if (c <= value) below++; return below / cloud.length;
}
function computeMetrics(unit, target, capRate, coc) {
  const monthly = Math.max(0, target - unit.currentRent);
  const annualCashFlow = monthly * 12;
  const increasePct = unit.currentRent ? (target - unit.currentRent) / unit.currentRent : 0;
  const propertyValueInc = capRate > 0 ? annualCashFlow / capRate : 0;
  const remodelBudget = coc > 0 ? annualCashFlow / coc : 0;
  return { monthly, annualCashFlow, increasePct, propertyValueInc, remodelBudget };
}

// ---- rubric of amenities scored in the unit grade ----
const AMENITIES = [
  'In-unit Laundry', 'Dishwasher', 'Central A/C', 'Updated Kitchen', 'Updated Bath',
  'Hardwood Floors', 'Off-street Parking', 'Private Outdoor', 'Walk-in Closet', 'Stainless Appliances',
];

// map a rent to a 0–100 quality score via its standing in the comp cloud
function scoreFor(rent, cloud) {
  return Math.round((62 + pctRank(rent, cloud) * 33) * 10) / 10;
}

// least-squares fit: points [{x,y}] -> {m,b}
function linreg(points) {
  const n = points.length; if (!n) return { m: 0, b: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
  const d = n * sxx - sx * sx;
  const m = d ? (n * sxy - sx * sy) / d : 0;
  const b = (sy - m * sx) / n;
  return { m, b };
}

// upgrade ladder: scope of work -> grade -> target rent -> premium
const LADDER_DEF = [
  { label: 'Current condition', work: 'No upgrades', pct: 0 },
  { label: 'Cosmetic refresh', work: 'Paint, deep clean, dishwasher, microwave', pct: 0.10 },
  { label: 'Partial remodel', work: 'Flooring, paint, updated bath', pct: 0.16 },
  { label: 'Kitchen update', work: 'Above + updated kitchen', pct: 0.25 },
  { label: 'Full remodel', work: 'Kitchen, bath, floors, fresh paint', pct: 0.31 },
  { label: 'In-unit laundry', work: 'Full remodel + W/D (if hookups)', pct: 0.41 },
];
function gradeLadder(unit, target) {
  const recRent = target != null ? target : unit.suggestedTarget;
  const tiers = LADDER_DEF.map((d) => {
    const rent = Math.round((unit.currentRent * (1 + d.pct)) / 5) * 5;
    const score = scoreFor(rent, unit.cloud);
    return {
      ...d, rent, score,
      grade: gradeFromPct(pctRank(rent, unit.cloud)),
      premium: rent - unit.currentRent,
      premiumPct: Math.round(d.pct * 100),
    };
  });
  // closest tier to the recommended/target rent is the recommended path
  let recIdx = 0, best = Infinity;
  tiers.forEach((t, i) => { const dd = Math.abs(t.rent - recRent); if (dd < best) { best = dd; recIdx = i; } });
  tiers.forEach((t, i) => { t.beyond = i > recIdx; t.recommended = i === recIdx; });
  return { tiers, recIdx };
}

// ---- procedural comparable listings ----
const STREETS = ['Telegraph Ave', 'Shattuck Ave', 'Broadway', 'Martin Luther King Jr Way', 'Alcatraz Ave', 'College Ave', 'Grand Ave', 'Piedmont Ave', 'Webster St', '40th St', '51st St', 'Clay St'];
const BLURBS = [
  'Renovated unit with in-unit laundry and an updated kitchen.',
  'Hardwood floors, large windows, and access to a shared garden.',
  'Bright top-floor flat near transit with a dishwasher included.',
  'Classic building with high ceilings and a private back porch.',
  'Stainless appliances, fresh paint, and off-street parking.',
  'Modern finishes, quartz counters, and a generous walk-in closet.',
  'Spacious corner layout with abundant natural light all day.',
  'Updated bath, new flooring, and a walkable central location.',
];
const GRADES = ['A', 'A-', 'B+', 'B', 'B-'];
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

function genComps(seed, beds, baths, sqft, median) {
  const rnd = mulberry32(seed * 131 + 7);
  const n = 4 + Math.floor(rnd() * 2);
  const used = new Set();
  const out = [];
  for (let i = 0; i < n; i++) {
    const rent = Math.round((median * (0.92 + rnd() * 0.34)) / 5) * 5;
    const sf = Math.round((sqft * (0.92 + rnd() * 0.26)) / 5) * 5;
    let st; do { st = pick(rnd, STREETS); } while (used.has(st) && used.size < STREETS.length); used.add(st);
    out.push({
      rent, sqft: sf, beds, baths,
      address: `${100 + Math.floor(rnd() * 5800)} ${st}.`,
      city: 'Oakland, CA ' + (94601 + Math.floor(rnd() * 12)),
      miles: Math.round((0.3 + rnd() * 2.3) * 10) / 10,
      overall: 76 + Math.floor(rnd() * 17),
      grades: { Quality: pick(rnd, GRADES), 'Size/Layout': pick(rnd, GRADES), Amenities: pick(rnd, GRADES), Location: pick(rnd, GRADES) },
      blurb: pick(rnd, BLURBS),
    });
  }
  return out.sort((a, b) => b.rent - a.rent);
}

const PROPERTY = { name: '2836 Telegraph Ave', city: 'Oakland, CA 94609', units: 8 };

const DEFAULT_AMENITIES = {
  101: ['Dishwasher', 'Hardwood Floors'],
  102: ['Dishwasher', 'Hardwood Floors', 'Off-street Parking'],
  201: ['Hardwood Floors', 'Private Outdoor'],
  202: ['Dishwasher', 'Hardwood Floors', 'Updated Bath'],
  203: ['Dishwasher', 'Walk-in Closet'],
  301: ['Dishwasher', 'Updated Kitchen', 'Updated Bath', 'Stainless Appliances', 'Off-street Parking'],
  302: ['Dishwasher', 'Central A/C', 'Updated Kitchen', 'Hardwood Floors', 'Off-street Parking', 'Private Outdoor'],
  303: ['Hardwood Floors'],
};

// core unit definitions (single property)
const RAW = [
  { n: 'Unit 101', beds: 0, baths: 1, sqft: 480, currentRent: 1495, suggestedTarget: 1720, median: 1720, capRate: 0.058, coc: 0.28, seed: 101 },
  { n: 'Unit 102', beds: 1, baths: 1, sqft: 620, currentRent: 1850, suggestedTarget: 2060, median: 2080, capRate: 0.060, coc: 0.30, seed: 102 },
  { n: 'Unit 201', beds: 2, baths: 1, sqft: 800, currentRent: 2195, suggestedTarget: 2495, median: 2460, capRate: 0.065, coc: 0.30, seed: 201 },
  { n: 'Unit 202', beds: 2, baths: 1, sqft: 820, currentRent: 2400, suggestedTarget: 2540, median: 2520, capRate: 0.063, coc: 0.31, seed: 202 },
  { n: 'Unit 203', beds: 1, baths: 1, sqft: 600, currentRent: 1980, suggestedTarget: 2020, median: 2010, capRate: 0.060, coc: 0.29, seed: 203 },
  { n: 'Unit 301', beds: 2, baths: 2, sqft: 950, currentRent: 2650, suggestedTarget: 3050, median: 3050, capRate: 0.062, coc: 0.32, seed: 301 },
  { n: 'Unit 302', beds: 3, baths: 2, sqft: 1150, currentRent: 2950, suggestedTarget: 3400, median: 3380, capRate: 0.062, coc: 0.33, seed: 302 },
  { n: 'Unit 303', beds: 1, baths: 1, sqft: 640, currentRent: 1720, suggestedTarget: 2000, median: 2010, capRate: 0.059, coc: 0.28, seed: 303 },
];

// factory: turn a raw spec into a fully-derived unit (cloud, quantiles, comps, etc.)
function makeUnit(r) {
  const median = r.median || Math.round((r.suggestedTarget || r.currentRent) / 5) * 5;
  const u = {
    id: r.id || ('u-' + r.seed),
    name: r.n,
    address: r.address || PROPERTY.name,
    building: PROPERTY.name,
    city: PROPERTY.city,
    beds: r.beds, baths: r.baths, sqft: r.sqft,
    currentRent: r.currentRent,
    suggestedTarget: r.suggestedTarget || Math.round((r.currentRent * 1.12) / 5) * 5,
    capRate: r.capRate || 0.06, coc: r.coc || 0.30,
    amenities: r.amenities || DEFAULT_AMENITIES[r.seed] || [],
    market: { median, spread: Math.round(median * 0.18), n: 44, seed: r.seed },
  };
  u.cloud = makeCompCloud(u.market.seed, u.market.median, u.market.spread, u.market.n);
  const sorted = [...u.cloud].sort((a, b) => a - b);
  u.cloudMin = sorted[0]; u.cloudMax = sorted[sorted.length - 1];
  u.q = { min: sorted[0], q1: Math.round(quantile(sorted, 0.25)), median: Math.round(quantile(sorted, 0.5)), q3: Math.round(quantile(sorted, 0.75)), max: sorted[sorted.length - 1] };
  u.sliderMin = Math.round((Math.min(u.cloudMin, u.currentRent) * 0.98) / 5) * 5;
  u.sliderMax = Math.round((Math.max(u.cloudMax, u.suggestedTarget) * 1.04) / 5) * 5;
  u.comps = genComps(u.market.seed, u.beds, u.baths, u.sqft, u.market.median);
  return u;
}

const UNITS = RAW.map(makeUnit);

const bedLabel = (b) => (b === 0 ? 'Studio' : b + ' bd');

Object.assign(window, {
  UNITS, PROPERTY, AMENITIES, computeMetrics, gradeFromPct, pctRank, fmt$, fmtK, makeCompCloud, bedLabel,
  scoreFor, linreg, gradeLadder, makeUnit,
});
