// rentroll.jsx — property overview: portfolio summary + list of unit rows
const GradePillR = window.GradePill;

function MiniBullet({ q, currentRent, target, sliderMin, sliderMax }) {
  const dMin = Math.min(q.min, sliderMin, currentRent);
  const dMax = Math.max(q.max, sliderMax, currentRent);
  const pad = (dMax - dMin) * 0.08;
  const lo = dMin - pad, hi = dMax + pad;
  const pct = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100;
  return (
    <div className="ur-mini">
      <div className="ur-mini__rail" />
      <div className="ur-mini__band" style={{ left: pct(q.q1) + '%', width: (pct(q.q3) - pct(q.q1)) + '%' }} />
      <div className="ur-mini__cur" style={{ left: pct(currentRent) + '%' }} />
      <div className="ur-mini__tgt" style={{ left: pct(target) + '%' }} />
    </div>
  );
}

function UnitRow({ unit, target, onOpen }) {
  const delta = target - unit.currentRent;
  const up = delta > 0;
  const tgtGrade = window.gradeFromPct(window.pctRank(target, unit.cloud));
  const spec = `${window.bedLabel(unit.beds)} · ${unit.baths} ba · ${unit.sqft.toLocaleString()} SF`;
  return (
    <button className="ur-urow" onClick={onOpen}>
      <div className="ur-urow__head">
        <div>
          <div className="ur-urow__name">{unit.name}</div>
          <div className="ur-urow__spec">{spec}</div>
        </div>
        <div className={'ur-urow__delta' + (up ? '' : ' is-flat')}>
          {up ? '+' + window.fmt$(delta) + '/mo' : 'At market'}
        </div>
      </div>
      <MiniBullet q={unit.q} currentRent={unit.currentRent} target={target}
        sliderMin={unit.sliderMin} sliderMax={unit.sliderMax} />
      <div className="ur-urow__foot">
        <div className="ur-urow__rents">
          <span className="ur-urow__cur">{window.fmt$(unit.currentRent)}</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          <span className="ur-urow__tgt">{window.fmt$(target)}</span>
          <GradePillR grade={tgtGrade} tone="good" />
        </div>
        <svg className="ur-urow__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </button>
  );
}

function RentRollScreen({ units, state, onOpenUnit }) {
  const sumCur = units.reduce((s, u) => s + u.currentRent, 0);
  const sumTgt = units.reduce((s, u) => s + state[u.id].target, 0);
  const upMo = sumTgt - sumCur;
  const upPct = sumCur ? Math.round((upMo / sumCur) * 100) : 0;
  const occupied = units.length;

  return (
    <div className="ur-roll" key="roll" data-screen-label="rent-roll">
      <div className="ur-roll__addr">{window.PROPERTY.name} · {window.PROPERTY.city}</div>

      <section className="ur-card ur-summary">
        <div className="ur-summary__grid">
          <div className="ur-stat">
            <div className="ur-stat__lbl">In-place / mo</div>
            <div className="ur-stat__val">{window.fmt$(sumCur)}</div>
          </div>
          <div className="ur-stat">
            <div className="ur-stat__lbl">Target / mo</div>
            <div className="ur-stat__val">{window.fmt$(sumTgt)}</div>
          </div>
          <div className="ur-stat">
            <div className="ur-stat__lbl">Monthly upside</div>
            <div className="ur-stat__val ur-stat__val--accent">+{window.fmt$(upMo)}</div>
          </div>
        </div>
        <div className="ur-summary__bar">
          <div className="ur-summary__fill" style={{ width: Math.min(100, (sumCur / sumTgt) * 100) + '%' }} />
        </div>
        <div className="ur-summary__foot">
          <span>{occupied} units</span>
          <span><b className="ur-up">+{upPct}%</b> potential gross uplift · +{window.fmt$(upMo * 12)}/yr</span>
        </div>
      </section>

      <div className="ur-roll__listlbl">Units</div>
      <div className="ur-roll__list">
        {units.map((u) => (
          <UnitRow key={u.id} unit={u} target={state[u.id].target} onOpen={() => onOpenUnit(u.id)} />
        ))}
      </div>
      <div className="ur-footnote">Estimates for illustration · not financial advice</div>
    </div>
  );
}

Object.assign(window, { RentRollScreen, UnitRow, MiniBullet });
