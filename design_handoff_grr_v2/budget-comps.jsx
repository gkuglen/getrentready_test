// budget-comps.jsx — BudgetCard, Placeholder, CompsRail, CompCard, ModalSheet, CompModal
const { useState: useStateB, useRef: useRefB, useEffect: useEffectB } = React;
const GradePill = window.GradePill;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// striped image placeholder with a mono caption
function Placeholder({ label = 'PHOTO', h = 150, radius = true }) {
  return (
    <div className={'ur-ph' + (radius ? ' ur-ph--r' : '')} style={{ height: h }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="ph-stripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(0,0,0,.06)" strokeWidth="8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ph-stripe)" />
      </svg>
      <span className="ur-ph__cap">{label}</span>
    </div>
  );
}

// ---- editable assumption pill ----
function EditableRate({ value, min, max, step, unit = '%', onChange, decimals = 1 }) {
  const [open, setOpen] = useStateB(false);
  const disp = (v) => (v * 100).toFixed(decimals).replace(/\.0$/, '') + unit;
  const set = (v) => onChange(Math.round(clamp(v, min, max) / step) * step);
  return (
    <span className={'ur-rate' + (open ? ' is-open' : '')}>
      {open ? (
        <span className="ur-rate__edit">
          <button className="ur-step" onClick={() => set(value - step)} aria-label="decrease">&minus;</button>
          <span className="ur-rate__num">{disp(value)}</span>
          <button className="ur-step" onClick={() => set(value + step)} aria-label="increase">+</button>
          <button className="ur-rate__done" onClick={() => setOpen(false)}>Done</button>
        </span>
      ) : (
        <button className="ur-rate__btn" onClick={() => setOpen(true)}>
          <span>{disp(value)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </button>
      )}
    </span>
  );
}

// ---- budget card ----
function BudgetCard({ unit, target, capRate, coc, onCap, onCoc }) {
  const m = window.computeMetrics(unit, target, capRate, coc);
  const incPct = Math.round(m.increasePct * 100);
  return (
    <section className="ur-card ur-budget" data-screen-label="budget">
      <div className="ur-eyebrow">Remodel Budget</div>
      <div className="ur-budget__hero">
        <span className="ur-budget__big">{window.fmt$(m.remodelBudget)}</span>
        <span className="ur-budget__est">est.</span>
      </div>
      <p className="ur-budget__cap">Estimated investment to bring the unit to target condition.</p>

      <div className="ur-rows">
        <div className="ur-row">
          <div className="ur-row__l">
            <div className="ur-row__lbl">Annual Cash Flow Increase</div>
            <div className="ur-row__val">{window.fmt$(m.annualCashFlow)}<span className="ur-row__yr">/yr</span></div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">Increase</div>
            <div className="ur-chip ur-chip--good">+{incPct}%</div>
          </div>
        </div>

        <div className="ur-row">
          <div className="ur-row__l">
            <div className="ur-row__lbl">Property Value Increase est.</div>
            <div className="ur-row__val">{window.fmt$(m.propertyValueInc)}</div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">Cap rate</div>
            <EditableRate value={capRate} min={0.03} max={0.12} step={0.001} decimals={1} onChange={onCap} />
          </div>
        </div>

        <div className="ur-row">
          <div className="ur-row__l">
            <div className="ur-row__lbl">Remodel Budget</div>
            <div className="ur-row__val">{window.fmt$(m.remodelBudget)}<span className="ur-row__yr">est.</span></div>
          </div>
          <div className="ur-row__r">
            <div className="ur-row__rlbl">CoC target <span className="ur-q" title="Cash-on-cash = annual cash flow ÷ remodel budget">?</span></div>
            <EditableRate value={coc} min={0.10} max={0.60} step={0.01} decimals={0} onChange={onCoc} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- comp card (rail item) ----
function CompCard({ comp, unit, onOpen }) {
  const psf = (comp.rent / comp.sqft);
  return (
    <button className="ur-comp" onClick={onOpen}>
      <Placeholder label="PHOTO" h={132} />
      <div className="ur-comp__price">{window.fmt$(comp.rent)} <span>/ mo</span></div>
      <div className="ur-comp__psf">${psf.toFixed(2)} / SF</div>
      <hr className="ur-hr" />
      <div className="ur-comp__addr">
        <div>{comp.address}</div>
        <div>{comp.city}</div>
        <div className="ur-comp__miles">{comp.miles.toFixed(1)} mi away</div>
      </div>
      <hr className="ur-hr" />
      <div className="ur-comp__spec">
        {comp.beds} bd · {comp.baths} ba · {comp.sqft.toLocaleString()} SF
      </div>
      <hr className="ur-hr" />
      <div className="ur-comp__scores">
        <div className="ur-comp__overall">
          <GradePill grade={window.gradeFromPct(comp.overall / 100)} tone="good" />
          <span>{comp.overall} Overall</span>
        </div>
        {Object.entries(comp.grades).map(([k, g]) => (
          <div key={k} className="ur-comp__scorerow"><span>{k}</span><b>{g}</b></div>
        ))}
      </div>
    </button>
  );
}

function CompsRail({ unit, onOpen }) {
  return (
    <section className="ur-card ur-comps" data-screen-label="comparables">
      <div className="ur-comps__head">
        <div className="ur-eyebrow">Comparables</div>
        <div className="ur-comps__hint">Swipe →</div>
      </div>
      <div className="ur-comps__rail">
        {unit.comps.map((c, i) => <CompCard key={i} comp={c} unit={unit} onOpen={() => onOpen(c)} />)}
      </div>
    </section>
  );
}

// ---- generic bottom-sheet modal ----
function ModalSheet({ open, onClose, children, label, wide }) {
  useEffectB(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={'ur-modal' + (open ? ' is-open' : '')} aria-hidden={!open}>
      <div className="ur-modal__scrim" onClick={onClose} />
      <div className={'ur-modal__sheet' + (wide ? ' ur-modal__sheet--wide' : '')} role="dialog" aria-modal="true" aria-label={label} data-screen-label="modal">
        <div className="ur-modal__grab" onClick={onClose} />
        {children}
      </div>
    </div>
  );
}

const GRADE_SCORE = { 'A': 95, 'A-': 88, 'B+': 82, 'B': 75, 'B-': 68, 'C+': 60, 'C': 52, 'C-': 45, 'D+': 38, 'D': 30 };

function CompModal({ comp, unit, onClose }) {
  if (!comp) return null;
  const psf = comp.rent / comp.sqft;
  return (
    <>
      <div className="ur-sheet__gallery">
        <Placeholder label="PHOTO 1" h={188} radius={false} />
        <div className="ur-sheet__thumbs">
          <Placeholder label="2" h={84} />
          <Placeholder label="3" h={84} />
          <Placeholder label="+4" h={84} />
        </div>
      </div>
      <div className="ur-sheet__body">
        <div className="ur-sheet__top">
          <div>
            <div className="ur-sheet__price">{window.fmt$(comp.rent)} <span>/ mo</span></div>
            <div className="ur-sheet__psf">${psf.toFixed(2)} / SF · {comp.beds} bd · {comp.baths} ba · {comp.sqft.toLocaleString()} SF</div>
          </div>
          <div className="ur-sheet__overall">
            <GradePill grade={window.gradeFromPct(comp.overall / 100)} tone="good" />
            <span>{comp.overall}<small>Overall</small></span>
          </div>
        </div>

        <div className="ur-sheet__addr">
          {comp.address}, {comp.city} &nbsp;·&nbsp; {comp.miles.toFixed(1)} mi from {unit.name}
        </div>

        <p className="ur-sheet__blurb">{comp.blurb}</p>

        <div className="ur-eyebrow ur-sheet__eyebrow">Score breakdown</div>
        <div className="ur-bars">
          {Object.entries(comp.grades).map(([k, g]) => (
            <div key={k} className="ur-bar">
              <div className="ur-bar__lbl">{k}</div>
              <div className="ur-bar__track"><div className="ur-bar__fill" style={{ width: (GRADE_SCORE[g] || 50) + '%' }} /></div>
              <div className="ur-bar__g"><GradePill grade={g} tone="neutral" /></div>
            </div>
          ))}
        </div>

        <div className="ur-sheet__cta">
          <button className="ur-btn ur-btn--primary" onClick={onClose}>Use as comp</button>
          <button className="ur-btn ur-btn--ghost" onClick={onClose}>View listing</button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Placeholder, EditableRate, BudgetCard, CompCard, CompsRail, ModalSheet, CompModal });
