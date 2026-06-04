// rentroll.jsx — property overview: portfolio summary + list of unit rows
const GradePillR = window.GradePill;

function MiniBullet({ currentRent, target, lo, hi }) {
  const pct = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100;
  const cP = pct(currentRent), tP = pct(target);
  const fillL = Math.min(cP, tP), fillW = Math.abs(tP - cP);
  return (
    <div className="ur-mini">
      <div className="ur-mini__rail" />
      <div className="ur-mini__fill" style={{ left: fillL + '%', width: fillW + '%' }} />
      <div className="ur-mini__cur" style={{ left: cP + '%' }} />
      <div className="ur-mini__tgt" style={{ left: tP + '%' }} />
    </div>
  );
}

function UnitRow({ unit, target, onOpen }) {
  const delta = target - unit.currentRent;
  const up = delta > 0;
  const curGrade = window.gradeFromPct(window.pctRank(unit.currentRent, unit.cloud));
  const tgtGrade = window.gradeFromPct(window.pctRank(target, unit.cloud));
  const spec = `${window.bedLabel(unit.beds)} · ${unit.baths} ba · ${unit.sqft.toLocaleString()} SF`;
  // even-spaced domain: pad the current→target span so the two dots always sit
  // comfortably inside the track regardless of how close the values are.
  const span = Math.max(1, Math.abs(target - unit.currentRent));
  const mid = (target + unit.currentRent) / 2;
  const half = Math.max(span * 1.6, (unit.sliderMax - unit.sliderMin) * 0.18);
  const lo = mid - half, hi = mid + half;
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
      <div className="ur-urow__bullet">
        <div className="ur-urow__side ur-urow__side--l">
          <span className="ur-urow__rent">{window.fmt$(unit.currentRent)}</span>
          <GradePillR grade={curGrade} tone="warn" />
        </div>
        <MiniBullet currentRent={unit.currentRent} target={target} lo={lo} hi={hi} />
        <div className="ur-urow__side ur-urow__side--r">
          <span className="ur-urow__rent">{window.fmt$(target)}</span>
          <GradePillR grade={tgtGrade} tone="good" />
        </div>
      </div>
    </button>
  );
}

function RentRollScreen({ units, state, onOpenUnit, onAdd }) {
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
          <div className="ur-stat ur-stat--l">
            <div className="ur-stat__lbl">Current / yr</div>
            <div className="ur-stat__val">{window.fmt$(sumCur)}</div>
          </div>
          <div className="ur-stat ur-stat--c">
            <div className="ur-stat__lbl">Target / yr</div>
            <div className="ur-stat__val">{window.fmt$(sumTgt)}</div>
          </div>
          <div className="ur-stat ur-stat--r">
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

      <div className="ur-roll__listhead">
        <div className="ur-roll__listlbl">Units</div>
        <button className="ur-addunit" onClick={onAdd} aria-label="Add a unit">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          <span>Add unit</span>
        </button>
      </div>
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
