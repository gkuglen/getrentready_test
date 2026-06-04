// cards.jsx — GradePill, RentSlider, UnitHeader, OpportunityCard, MarketCard
const { useState, useRef, useEffect, useCallback } = React;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- letter-grade pill ----------
function GradePill({ grade, tone = 'neutral' }) {
  return <span className={'ur-grade ur-grade--' + tone}>{grade}</span>;
}

// ---------- inline-editable rent value (click to type a dollar amount) ----------
function EditableRent({ value, min, max, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  const commit = () => {
    const n = parseInt(String(draft).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n)) onChange(clamp(Math.round(n / 5) * 5, min, max));
    setEditing(false);
  };
  if (editing) {
    return (
      <span className="ur-rentedit">
        <span className="ur-rentedit__dollar">$</span>
        <input ref={inputRef} className="ur-rentedit__input" type="text" inputMode="numeric" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
      </span>
    );
  }
  return (
    <button className="ur-rentcol__val ur-rentcol__val--edit" onClick={() => { setDraft(String(value)); setEditing(true); }} title="Edit current rent">
      {window.fmt$(value)}
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
    </button>
  );
}

// ---------- bullet graph (current → target, current rent is draggable) ----------
function BulletGraph({ currentRent, target, sliderMin, sliderMax, onChange }) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const pad = (sliderMax - sliderMin) * 0.04;
  const lo = sliderMin - pad, hi = sliderMax + pad;
  const pct = (v) => clamp((v - lo) / (hi - lo), 0, 1) * 100;

  const valueFromClientX = useCallback((clientX) => {
    const el = trackRef.current; if (!el) return currentRent;
    const r = el.getBoundingClientRect();
    const p = clamp((clientX - r.left) / r.width, 0, 1);
    return clamp(Math.round((lo + p * (hi - lo)) / 5) * 5, sliderMin, sliderMax);
  }, [lo, hi, sliderMin, sliderMax, currentRent]);

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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange(clamp(currentRent - step, sliderMin, sliderMax)); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange(clamp(currentRent + step, sliderMin, sliderMax)); e.preventDefault(); }
  };

  const cP = pct(currentRent), tP = pct(target);
  const fillL = Math.min(cP, tP), fillW = Math.abs(tP - cP);

  return (
    <div className="ur-bullet">
      <div className="ur-bullet__track" ref={trackRef}
        onPointerDown={(e) => { setDrag(true); onChange(valueFromClientX(e.clientX)); }}>
        <div className="ur-bullet__rail" />
        <div className="ur-bullet__fill" style={{ left: fillL + '%', width: fillW + '%' }} />
        <div className="ur-bullet__tgt" style={{ left: tP + '%' }} title="Target rent" />
        <button className={'ur-bullet__cur' + (drag ? ' is-drag' : '')} style={{ left: cP + '%' }}
          onKeyDown={onKey} role="slider" aria-label="Current rent (drag to adjust)"
          aria-valuenow={currentRent} aria-valuemin={sliderMin} aria-valuemax={sliderMax} />
      </div>
    </div>
  );
}

// ---------- unit header ----------
function UnitHeader({ unit, target, onCurrent }) {
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
        <BulletGraph currentRent={unit.currentRent} target={target}
          sliderMin={unit.sliderMin} sliderMax={unit.sliderMax} onChange={onCurrent} />
        <div className="ur-head__foot">
          <div className="ur-rentcol">
            <div className="ur-rentcol__row">
              <span className="ur-dotkey ur-dotkey--cur" />
              <EditableRent value={unit.currentRent} min={unit.sliderMin} max={unit.sliderMax} onChange={onCurrent} />
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
function niceTicks(min, max, count) {
  const span = max - min || 1;
  const raw = span / (count || 4);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v));
  return out;
}

function MarketCard({ unit, target }) {
  // data-relative domain so the cloud spreads across the full width
  const dataMin = Math.min(unit.cloudMin, unit.currentRent, target);
  const dataMax = Math.max(unit.cloudMax, unit.currentRent, target);
  const pad = (dataMax - dataMin) * 0.07 || 50;
  const xMin = dataMin - pad, xMax = dataMax + pad;

  const W = 560, H = 140, padL = 16, padR = 16;
  const baseY = 60, band = 70, axisTop = 12, axisBot = H - 30;
  const x = (v) => padL + ((v - xMin) / (xMax - xMin)) * (W - padL - padR);

  // precompute jittered y positions once per unit
  const pts = React.useMemo(() => {
    let s = unit.market.seed * 7 + 11;
    const rng = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return unit.cloud.map((rent) => {
      const j = (rng() + rng() - 1); // -1..1, denser near 0
      return { rent, cy: baseY + j * (band / 2), r: 4 + rng() * 2.5 };
    });
  }, [unit.id]);

  const ticks = niceTicks(xMin, xMax, 4);
  const curG = window.gradeFromPct(window.pctRank(unit.currentRent, unit.cloud));
  const tgtG = window.gradeFromPct(window.pctRank(target, unit.cloud));

  return (
    <section className="ur-card ur-market" data-screen-label="market">
      <div className="ur-eyebrow">Market</div>
      <div className="ur-market__plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
          <line x1={padL} y1={axisTop} x2={padL} y2={axisBot} className="ur-axis" />
          <line x1={padL} y1={axisBot} x2={W - padR} y2={axisBot} className="ur-axis" />
          {pts.map((p, i) => (
            <circle key={i} cx={x(p.rent)} cy={p.cy} r={p.r} className="ur-dot" />
          ))}
          {/* current marker (hollow) */}
          <circle cx={x(unit.currentRent)} cy={baseY} r={5} className="ur-mark ur-mark--cur" />
          {/* target marker (solid, black) — animates */}
          <circle cx={x(target)} cy={baseY} r={4.5} className="ur-mark ur-mark--tgt" style={{ transition: 'cx .35s cubic-bezier(.22,1,.36,1)' }} />
          {ticks.map((v) => (
            <text key={v} x={x(v)} y={H - 10} className="ur-tick" textAnchor="middle">{window.fmtK(v)}</text>
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
