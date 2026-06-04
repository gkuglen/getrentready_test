// forms-grade.jsx — GradeLadderCard, UnitFormSheet (add/edit), SaveLeadSheet
const { useState: useStateF, useEffect: useEffectF, useMemo: useMemoF } = React;
const GradePillF = window.GradePill;

// ───────────────────────── Path to a Higher Grade ─────────────────────────
function GradeLadderCard({ unit, target }) {
  const { tiers, recIdx } = window.gradeLadder(unit, target);
  const curScore = window.scoreFor(unit.currentRent, unit.cloud);
  const lastIdx = tiers.length - 1;

  // three selectable grade milestones. each lights tiers 0..cutoff, dims the rest.
  const curGrade = window.gradeFromPct(window.pctRank(unit.currentRent, unit.cloud));
  const medianGrade = window.gradeFromPct(window.pctRank(unit.market.median, unit.cloud));
  const medianScore = window.scoreFor(unit.market.median, unit.cloud);
  const goals = [
    { key: 'current', cap: 'Current', cutoff: 0, grade: 'C', rent: unit.currentRent, score: curScore, markGoal: true },
    { key: 'target', cap: 'Target', cutoff: recIdx, grade: 'B-', rent: tiers[recIdx].rent, score: tiers[recIdx].score, markGoal: true },
    { key: 'median', cap: 'Median', cutoff: lastIdx, grade: 'B+', rent: unit.market.median, score: medianScore, markGoal: false },
  ];
  const [level, setLevel] = useStateF(1); // default: recommended target
  const goal = goals[level];

  return (
    <section className="ur-card ur-ladder" data-screen-label="grade-path">
      <div className="ur-eyebrow">Path to a Higher Grade</div>
      <p className="ur-ladder__lead">
        Choose a target grade to see the renovations that get you there. Each level lifts the
        unit&rsquo;s quality score — and the rent the market will bear.
      </p>

      <div className="ur-ladder__btns" role="tablist" aria-label="Target grade">
        {goals.map((g, i) => (
          <button key={g.key} role="tab" aria-selected={i === level}
            className={'ur-gbtn' + (i === level ? ' is-on' : '')} onClick={() => setLevel(i)}>
            <GradePillF grade={g.grade} tone={i === level ? 'good' : 'neutral'} />
            <span className="ur-gbtn__cap">{g.cap}</span>
            <span className="ur-gbtn__rent">{window.fmt$(g.rent)}</span>
          </button>
        ))}
      </div>

      <div className="ur-ladder__rail">
        {tiers.map((t, i) => {
          const lit = i <= goal.cutoff;
          const isGoal = goal.markGoal && i === goal.cutoff;
          const cls = 'ur-tier' + (lit ? ' is-lit' : ' is-dim') + (isGoal ? ' is-goal' : '');
          return (
            <div key={i} className={cls}>
              <div className="ur-tier__node"><span className="ur-tier__dot" /></div>
              <div className="ur-tier__main">
                <div className="ur-tier__top">
                  <span className="ur-tier__label">{t.label}{isGoal && <em className="ur-tier__tag">{goal.cap}</em>}</span>
                  <GradePillF grade={t.grade} tone={lit ? 'good' : 'neutral'} />
                </div>
                <div className="ur-tier__work">{t.work}</div>
                <div className="ur-tier__nums">
                  <span className="ur-tier__rent">{window.fmt$(t.rent)}<small>/mo</small></span>
                  <span className="ur-tier__score">score {t.score}</span>
                  <span className={'ur-tier__prem' + (t.premium > 0 ? ' is-up' : '')}>
                    {t.premium > 0 ? '+' + window.fmt$(t.premium) + '/mo' : 'baseline'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── shared little controls ─────────────────────────
function Stepper({ value, min, max, step = 1, onChange, fmt }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, Math.round(v / step) * step)));
  return (
    <div className="ur-stepper">
      <button type="button" className="ur-step" onClick={() => set(value - step)} aria-label="decrease">&minus;</button>
      <span className="ur-stepper__val">{fmt ? fmt(value) : value}</span>
      <button type="button" className="ur-step" onClick={() => set(value + step)} aria-label="increase">+</button>
    </div>
  );
}

// ───────────────────────── Add / Edit unit ─────────────────────────
function UnitFormSheet({ open, mode, unit, onClose, onSave }) {
  const blank = { name: '', address: window.PROPERTY.name, sqft: 700, beds: 1, baths: 1, amenities: [] };
  const [f, setF] = useStateF(blank);

  useEffectF(() => {
    if (!open) return;
    if (mode === 'edit' && unit) {
      setF({ name: unit.name, address: unit.address || unit.building, sqft: unit.sqft, beds: unit.beds, baths: unit.baths, amenities: [...(unit.amenities || [])] });
    } else {
      setF(blank);
    }
  }, [open, mode, unit && unit.id]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleAm = (a) => setF((s) => ({ ...s, amenities: s.amenities.includes(a) ? s.amenities.filter((x) => x !== a) : [...s.amenities, a] }));
  const valid = f.name.trim().length > 0 && f.sqft > 0;

  return (
    <window.ModalSheet open={open} onClose={onClose} label={mode === 'edit' ? 'Edit unit' : 'Add unit'}>
      <div className="ur-form">
        <h2 className="ur-form__title">{mode === 'edit' ? 'Edit unit details' : 'Add a unit'}</h2>
        <p className="ur-form__sub">{mode === 'edit' ? 'Update the unit and its amenities. The grade rubric recalculates from these.' : 'Add a unit to ' + window.PROPERTY.name + '. We\u2019ll estimate its target rent from comps.'}</p>

        <label className="ur-field">
          <span className="ur-field__lbl">Unit name</span>
          <input className="ur-input" value={f.name} placeholder="e.g. Unit 304" onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="ur-field">
          <span className="ur-field__lbl">Address</span>
          <input className="ur-input" value={f.address} onChange={(e) => set('address', e.target.value)} />
        </label>

        <div className="ur-field__row">
          <label className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Square feet</span>
            <input className="ur-input" type="number" inputMode="numeric" value={f.sqft} onChange={(e) => set('sqft', parseInt(e.target.value || '0', 10))} />
          </label>
          <div className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Bedrooms</span>
            <Stepper value={f.beds} min={0} max={6} onChange={(v) => set('beds', v)} fmt={(v) => (v === 0 ? 'Studio' : v)} />
          </div>
          <div className="ur-field ur-field--sm">
            <span className="ur-field__lbl">Bathrooms</span>
            <Stepper value={f.baths} min={1} max={5} step={0.5} onChange={(v) => set('baths', v)} />
          </div>
        </div>

        <div className="ur-field">
          <span className="ur-field__lbl">Amenities <em className="ur-field__hint">· scored in the grade rubric</em></span>
          <div className="ur-amgrid">
            {window.AMENITIES.map((a) => {
              const on = f.amenities.includes(a);
              return (
                <button type="button" key={a} className={'ur-amchip' + (on ? ' is-on' : '')} onClick={() => toggleAm(a)}>
                  <span className="ur-amchip__box">{on && (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}</span>
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ur-form__cta">
          <button className="ur-btn ur-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ur-btn ur-btn--primary" disabled={!valid} onClick={() => onSave(f)}>{mode === 'edit' ? 'Save changes' : 'Add unit'}</button>
        </div>
      </div>
    </window.ModalSheet>
  );
}

// ───────────────────────── Save report (lead capture) ─────────────────────────
function SaveLeadSheet({ open, onClose, onSubmit }) {
  const [name, setName] = useStateF('');
  const [email, setEmail] = useStateF('');
  const [done, setDone] = useStateF(false);
  useEffectF(() => { if (open) { setName(''); setEmail(''); setDone(false); } }, [open]);
  const emailOk = /.+@.+\..+/.test(email);
  const valid = name.trim() && emailOk;

  return (
    <window.ModalSheet open={open} onClose={onClose} label="Save report">
      <div className="ur-form">
        {done ? (
          <div className="ur-saved">
            <div className="ur-saved__check" aria-hidden="true">
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
              <button className="ur-btn ur-btn--primary" disabled={!valid} onClick={() => { onSubmit && onSubmit({ name, email }); setDone(true); }}>Save report</button>
            </div>
          </>
        )}
      </div>
    </window.ModalSheet>
  );
}

Object.assign(window, { GradeLadderCard, UnitFormSheet, SaveLeadSheet, Stepper });
