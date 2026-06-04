// cards.jsx — GradePill, RentSlider, UnitHeader, OpportunityCard, MarketCard
const { useState, useRef, useEffect, useCallback } = React;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- letter-grade pill ----------
function GradePill({ grade, tone = 'neutral' }) {
  return <span className={'ur-grade ur-grade--' + tone}>{grade}</span>;
}

// ---------- bullet graph (market distribution + current/target markers) ----------
function BulletGraph({ q, currentRent, target, sliderMin, sliderMax, onChange }) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const dMin = Math.min(q.min, sliderMin, currentRent);
  const dMax = Math.max(q.max, sliderMax, currentRent);
  const pad = (dMax - dMin) * 0.08;
  const lo = dMin - pad, hi = dMax + pad;
  const pct = (v) => clamp((v - lo) / (hi - lo), 0, 1) * 100;

  const valueFromClientX = useCallback((clientX) => {
    const el = trackRef.current; if (!el) return target;
    const r = el.getBoundingClientRect();
    const p = clamp((clientX - r.left) / r.width, 0, 1);
    return clamp(Math.round((lo + p * (hi - lo)) / 5) * 5, sliderMin, sliderMax);
  }, [lo, hi, sliderMin, sliderMax, target]);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => { const x = e.touches ? e.touches[0].clientX : e.clientX; onChange(valueFromClientX(x)); };
    const up = () => setDrag(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [drag, onChange, valueFromClientX]);

  const onKey = (e) => {
    const step = e.shiftKey ? 50 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange(clamp(target - step, sliderMin, sliderMax)); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange(clamp(target + step, sliderMin, sliderMax)); e.preventDefault(); }
  };

  return (
    <div className="ur-bullet">
      <div className="ur-bullet__track" ref={trackRef}
        onPointerDown={(e) => { setDrag(true); onChange(valueFromClientX(e.clientX)); }}>
        <div className="ur-bullet__rail" />
        <div className="ur-bullet__band" style={{ left: pct(q.q1) + '%', width: (pct(q.q3) - pct(q.q1)) + '%' }} title="Typical market range (Q1–Q3)" />
        <div className="ur-bullet__median" style={{ left: pct(q.median) + '%' }} title="Market median" />
        <div className="ur-bullet__cur" style={{ left: pct(currentRent) + '%' }} title="Current rent" />
        <button className={'ur-bullet__tgt' + (drag ? ' is-drag' : '')} style={{ left: pct(target) + '%' }}
          onKeyDown={onKey} role="slider" aria-label="Target rent"
          aria-valuenow={target} aria-valuemin={sliderMin} aria-valuemax={sliderMax} />
      </div>
      <div className="ur-bullet__ends">
        <span>{window.fmt$(q.min)}</span>
        <span className="ur-bullet__iqr">Typical {window.fmt$(q.q1)}–{window.fmt$(q.q3)}</span>
        <span>{window.fmt$(q.max)}</span>
      </div>
    </div>
  );
}

// ---------- unit header ----------
function UnitHeader({ unit, target, onTarget }) {
  const delta = target - unit.currentRent;
  const deltaPct = unit.currentRent ? Math.round((delta / unit.currentRent) * 100) : 0;
  const curGrade = window.gradeFromPct(window.pctRank(unit.currentRent, unit.cloud));
  const tgtGrade = window.gradeFromPct(window.pctRank(target, unit.cloud));
  const up = delta >= 0;

  return (
    <section className="ur-card ur-head" data-screen-label="unit-header">
      <div className="ur-head__top">
        <div>
          <h1 className="ur-head__name">{unit.name}</h1>
          <div className="ur-spec">
            <span>{unit.beds === 0 ? 'Studio' : unit.beds + ' Bed' + (unit.beds !== 1 ? 's' : '')}</span>
            <i />
            <span>{unit.baths} Bath{unit.baths !== 1 ? 's' : ''}</span>
            <i />
            <span>{unit.sqft.toLocaleString()} Sq Ft</span>
          </div>
        </div>
        <div className="ur-head__delta">
          <div className={'ur-head__delta-val' + (up ? '' : ' is-down')}>
            {up ? '+' : '\u2212'}{window.fmt$(Math.abs(delta))}<span>/mo</span>
          </div>
          <div className="ur-head__delta-pct">({up ? '+' : '\u2212'}{Math.abs(deltaPct)}%)</div>
        </div>
      </div>

      <div className="ur-head__viz">
        <BulletGraph q={unit.q} currentRent={unit.currentRent} target={target}
          sliderMin={unit.sliderMin} sliderMax={unit.sliderMax} onChange={onTarget} />
        <div className="ur-head__foot">
          <div className="ur-rentcol">
            <div className="ur-rentcol__row">
              <span className="ur-dotkey ur-dotkey--cur" />
              <span className="ur-rentcol__val">{window.fmt$(unit.currentRent)}</span>
              <GradePill grade={curGrade} tone="warn" />
            </div>
            <div className="ur-rentcol__lbl">Current</div>
          </div>
          <div className="ur-rentcol ur-rentcol--right">
            <div className="ur-rentcol__row">
              <GradePill grade={tgtGrade} tone="good" />
              <span className="ur-rentcol__val">{window.fmt$(target)}</span>
              <span className="ur-dotkey ur-dotkey--tgt" />
            </div>
            <div className="ur-rentcol__lbl">Target</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- opportunity callout ----------
function OpportunityCard({ unit, target }) {
  const delta = target - unit.currentRent;
  const positive = delta > 0;
  const bedBath = `${unit.beds}BR/${unit.baths}BA`;
  return (
    <section className="ur-card ur-opp" data-screen-label="opportunity">
      <div className="ur-opp__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 3l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78 6.8 19.5l.99-5.79-4.21-4.1 5.82-.85z" />
        </svg>
      </div>
      <div className="ur-opp__body">
        <h2 className="ur-opp__title">{positive ? 'Potential Opportunity' : 'At or above market'}</h2>
        {positive ? (
          <p>
            You may be able to increase cash flow and property value. This unit&rsquo;s rent reads
            lower than comparable <b>{bedBath}</b> listings in {unit.city.split(',')[0]} — a likely
            opening to raise income by refreshing its present condition.
          </p>
        ) : (
          <p>
            Target is tracking at or beyond comparable <b>{bedBath}</b> listings in {unit.city.split(',')[0]}.
            Pushing further may extend days-on-market — validate against the comps below.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- market bee-swarm ----------
function MarketCard({ unit, target }) {
  const W = 560, H = 230, padL = 8, padR = 8, baseY = 132, band = 64;
  const axisMax = Math.max(4000, Math.ceil(Math.max(unit.cloudMax, unit.sliderMax) / 1000) * 1000);
  const x = (v) => padL + (v / axisMax) * (W - padL - padR);

  // precompute jittered y positions once per unit
  const pts = React.useMemo(() => {
    const rnd = window.makeCompCloud; // reuse seeded generator indirectly
    let s = unit.market.seed * 7 + 11;
    const rng = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return unit.cloud.map((rent) => {
      const j = (rng() + rng() - 1); // -1..1, denser near 0
      return { rent, cx: x(rent), cy: baseY + j * (band / 2), r: 6.5 + rng() * 3 };
    });
  }, [unit.id]);

  const ticks = [];
  for (let v = 0; v <= axisMax; v += 1000) ticks.push(v);
  const curG = window.gradeFromPct(window.pctRank(unit.currentRent, unit.cloud));
  const tgtG = window.gradeFromPct(window.pctRank(target, unit.cloud));

  return (
    <section className="ur-card ur-market" data-screen-label="market">
      <div className="ur-eyebrow">Market</div>
      <div className="ur-market__plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
          <line x1={padL} y1={20} x2={padL} y2={H - 40} className="ur-axis" />
          <line x1={padL} y1={H - 40} x2={W - padR} y2={H - 40} className="ur-axis" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} className="ur-dot" />
          ))}
          {/* current marker (hollow) */}
          <circle cx={x(unit.currentRent)} cy={baseY} r={8} className="ur-mark ur-mark--cur" />
          {/* target marker (solid) — animates */}
          <circle cx={x(target)} cy={baseY} r={9} className="ur-mark ur-mark--tgt" style={{ transition: 'cx .35s cubic-bezier(.22,1,.36,1)' }} />
          {ticks.map((v) => (
            <text key={v} x={x(v)} y={H - 22} className="ur-tick" textAnchor="middle">{v === 0 ? '$0' : window.fmtK(v)}</text>
          ))}
        </svg>
      </div>
      <div className="ur-market__legend">
        <div className="ur-legend">
          <span className="ur-legend__dot ur-legend__dot--cur" />
          <b>{window.fmt$(unit.currentRent)}</b> Current
          <GradePill grade={curG} tone="warn" />
        </div>
        <div className="ur-legend">
          <span className="ur-legend__dot ur-legend__dot--tgt" />
          <b>{window.fmt$(target)}</b> Target
          <GradePill grade={tgtG} tone="good" />
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { GradePill, BulletGraph, UnitHeader, OpportunityCard, MarketCard });
