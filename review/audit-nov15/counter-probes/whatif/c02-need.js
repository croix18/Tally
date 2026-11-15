// WIF-02 recount on the untouched scrubbed class: for each linked student whose retake is blocked by an IXL unit, the count shown vs what opens it.
const S = require('/home/claude/work/audit/whatif/probes/_setup.js');
(async () => { const { b, p } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const out = [];
    gb.students.forEach((n, i) => { const rt = A.retakeStatus(s, n); if (rt.noIxl) return; const f = A.findStudent(s, n);
      [...(rt.short.length ? [{ unit: rt.unit, short: rt.short }] : []), ...rt.behind].forEach(x => { const col = gb.assignments.find(a => /\bixl\b/i.test(a.name) && (A.gbUnitFor(s, a) || {}).name === x.unit.name);
        const pts = A.points(s, x.unit, f.ixl); out.push(`row ${i} ${x.unit.short}: shown ${x.short.length}, pts ${pts}/${col && col.max}, own ${A.activeFor(s, x.unit, f.ixl).length}, needed ${col ? Math.min(x.short.length, col.max - pts) : '-'}`); }); });
    return out; }, S.K);
  console.log(r.join('\n')); await b.close(); })();
