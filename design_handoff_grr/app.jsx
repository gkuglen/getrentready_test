// app.jsx — routing between Rent Roll overview and Unit detail
const { useState: useStateA } = React;
const { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSlider } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#4D6CFA",
  "cardStyle": "shadow",
  "radius": 18,
  "density": "regular"
}/*EDITMODE-END*/;

const DENSITY = {
  compact: { pad: 16, gap: 12, fs: 14.5 },
  regular: { pad: 22, gap: 16, fs: 15.5 },
  comfy: { pad: 28, gap: 22, fs: 16.5 },
};

// reconstruct a raw spec from a derived unit (for re-running makeUnit on edit)
function rawFromUnit(u) {
  return {
    id: u.id, seed: u.market.seed, n: u.name, address: u.address,
    beds: u.beds, baths: u.baths, sqft: u.sqft,
    currentRent: u.currentRent, suggestedTarget: u.suggestedTarget,
    median: u.market.median, capRate: u.capRate, coc: u.coc, amenities: u.amenities,
  };
}

function UnitDetail({ unit, st, setVal, onOpenComp, onSave, dir }) {
  return (
    <div className="ur-stack" key={unit.id} data-dir={dir}>
      <div className="ur-loc">{unit.address || unit.building} · {unit.city}</div>
      <window.UnitHeader unit={unit} target={st.target} onTarget={(v) => setVal('target', v)} />
      <window.OpportunityCard unit={unit} target={st.target} />
      <window.MarketCard unit={unit} target={st.target} />
      <window.BudgetCard unit={unit} target={st.target} capRate={st.capRate} coc={st.coc}
        onCap={(v) => setVal('capRate', v)} onCoc={(v) => setVal('coc', v)} />
      <window.GradeLadderCard unit={unit} target={st.target} />
      <window.CompsRail unit={unit} onOpen={onOpenComp} />
      <button className="ur-save" onClick={onSave}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
        Save report
      </button>
      <div className="ur-footnote">Estimates for illustration · not financial advice</div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [units, setUnits] = useStateA(window.UNITS);
  const [screen, setScreen] = useStateA('roll');     // 'roll' | 'unit'
  const [activeId, setActiveId] = useStateA(window.UNITS[0].id);
  const [dir, setDir] = useStateA(1);
  const [modalComp, setModalComp] = useStateA(null);
  const [form, setForm] = useStateA({ open: false, mode: 'add' });
  const [leadOpen, setLeadOpen] = useStateA(false);
  const [state, setState] = useStateA(() => {
    const o = {};
    window.UNITS.forEach((u) => { o[u.id] = { target: u.suggestedTarget, capRate: u.capRate, coc: u.coc }; });
    return o;
  });

  const unit = units.find((u) => u.id === activeId) || units[0];
  const st = state[unit.id];
  const setVal = (field, value) => setState((s) => ({ ...s, [unit.id]: { ...s[unit.id], [field]: value } }));

  const openUnit = (id) => { setActiveId(id); setDir(1); setScreen('unit'); setModalComp(null); window.scrollTo(0, 0); };
  const backToRoll = () => { setDir(-1); setScreen('roll'); setModalComp(null); window.scrollTo(0, 0); };

  const addUnit = (f) => {
    const seed = 400 + units.length;
    const currentRent = Math.round((1150 + f.beds * 540 + f.sqft * 1.05) / 5) * 5;
    const u = window.makeUnit({ n: f.name || ('Unit ' + (units.length + 1)), address: f.address, beds: f.beds, baths: f.baths, sqft: f.sqft, currentRent, seed, amenities: f.amenities });
    setUnits((arr) => [...arr, u]);
    setState((s) => ({ ...s, [u.id]: { target: u.suggestedTarget, capRate: u.capRate, coc: u.coc } }));
    setForm({ open: false, mode: 'add' });
    openUnit(u.id);
  };

  const saveEdit = (f) => {
    const u = window.makeUnit({ ...rawFromUnit(unit), n: f.name, address: f.address, beds: f.beds, baths: f.baths, sqft: f.sqft, amenities: f.amenities });
    setUnits((arr) => arr.map((x) => (x.id === u.id ? u : x)));
    setForm({ open: false, mode: 'edit' });
  };

  const d = DENSITY[t.density] || DENSITY.regular;
  const rootStyle = {
    '--accent': t.accent,
    '--radius': t.radius + 'px',
    '--radius-img': Math.max(6, t.radius - 6) + 'px',
    '--card-pad': d.pad + 'px',
    '--stack-gap': d.gap + 'px',
    '--fs': d.fs + 'px',
  };

  return (
    <div className="ur-root" style={rootStyle} data-card={t.cardStyle}>
      <div className="ur-shell">
        <header className="ur-topbar">
          <div className="ur-topbar__l">
            {screen === 'unit' && (
              <button className="ur-iconbtn" onClick={backToRoll} aria-label="Back to rent roll">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
          </div>
          <div className="ur-title">
            {screen === 'roll'
              ? <><span className="ur-brand__mark" /><span className="ur-brand__name">Rent Roll</span></>
              : <span className="ur-brand__name">{unit.name}</span>}
          </div>
          <div className="ur-topbar__r">
            {screen === 'roll' ? (
              <button className="ur-iconbtn ur-iconbtn--accent" onClick={() => setForm({ open: true, mode: 'add' })} aria-label="Add a unit">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            ) : (
              <button className="ur-iconbtn" onClick={() => setForm({ open: true, mode: 'edit' })} aria-label="Edit unit">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
              </button>
            )}
          </div>
        </header>

        {screen === 'roll'
          ? <window.RentRollScreen units={units} state={state} onOpenUnit={openUnit} />
          : <UnitDetail unit={unit} st={st} setVal={setVal} onOpenComp={(c) => setModalComp(c)} onSave={() => setLeadOpen(true)} dir={dir} />}
      </div>

      <window.ModalSheet open={!!modalComp} onClose={() => setModalComp(null)} label="Comparable detail">
        <window.CompModal comp={modalComp} unit={unit} onClose={() => setModalComp(null)} />
      </window.ModalSheet>

      <window.UnitFormSheet open={form.open} mode={form.mode} unit={unit}
        onClose={() => setForm((s) => ({ ...s, open: false }))}
        onSave={form.mode === 'edit' ? saveEdit : addUnit} />

      <window.SaveLeadSheet open={leadOpen} onClose={() => setLeadOpen(false)} />

      <TweaksPanel>
        <TweakSection label="Color" />
        <TweakColor label="Accent" value={t.accent}
          options={["#4D6CFA", "#1F8A5B", "#7A5AE0", "#D97757", "#0E7C86"]}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Cards" />
        <TweakRadio label="Style" value={t.cardStyle}
          options={["flat", "shadow", "outline"]}
          onChange={(v) => setTweak('cardStyle', v)} />
        <TweakSlider label="Corner radius" value={t.radius} min={2} max={30} step={1} unit="px"
          onChange={(v) => setTweak('radius', v)} />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
