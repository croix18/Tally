// Independent recomputation for WIF-10: class mean of skills at goal from the last history snapshot (h.pu), open units only vs all assigned.
const S = require('/home/claude/work/audit/whatif/probes/_setup.js'); const path = require('path');
(async () => { const { b, p } = await S.open();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await S.pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); T.save();
    const h = s.history[s.history.length - 1]; const pop = T.population(s).map(x => x.key).filter(k => h.per[k] != null);
    const us = A.unitsOf(s).filter(u => u.assigned); const open = us.filter(u => !A.unitClosed(s, u));
    const m = list => pop.reduce((a, k) => a + list.reduce((t, u) => t + ((h.pu[u.name] || {})[k] || 0), 0), 0) / pop.length;
    return { n: pop.length, all: m(us).toFixed(2), open: m(open).toFixed(2), openUnits: open.map(u => u.short), hasPu: !!h.pu }; }, S.K);
  console.log(JSON.stringify(r)); await b.close(); })();
