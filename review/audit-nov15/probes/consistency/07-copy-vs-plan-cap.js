// CON-07: a unit whose Focus IXL column is worth fewer points than the unit has skills ("Focus: points differ").
// The plan, the weekly report and Show student count the copy as min(column points, skills at goal) (pendingCopies);
// the Copy column and the Focus check's "Tally" number paste the uncapped skill count. Two numbers for one copy.
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const rows = T.gbRows(s);
    const out = []; const units = T.unitsOf(s).filter(u => u.assigned && u.total); const rc = T.reconcile(s);
    os.grades.students.forEach((n, i) => { const r = rows[i]; if (!r || r.ixl == null) return; A.pendingCopies(s, os, i, r.ixl).forEach(c => { const u = units.find(x => x.name === c.unit.name); const col = T.unitColumn(s, u, 'points'); const list = Array.isArray(col) ? col : String(col).split('\n');
      const ci = A.copyRows(s).findIndex(x => x.display === r.display); const check = (rc.find(x => x.unit.name === u.name) || { rows: [] }).rows.find(x => x.display === r.display);
      const gPlan = A.computeGrade(os, i, { [c.a.name]: c.to }).rounded, gCopy = A.computeGrade(os, i, { [c.a.name]: +list[ci] }).rounded;
      if (+list[ci] !== c.to) out.push({ n, col: c.a.name, colMax: c.a.max, unitSkills: u.total, plan: c.to, copyText: list[ci], focusCheckTally: check && check.tally, gradeIfPlan: gPlan, gradeIfCopied: gCopy }); }); });
    return out; }, H.K);
  o.forEach(x => console.log('OBSERVED:', JSON.stringify(x)));
  console.log('EXPECTED: the Copy column pastes the number the plan and report count (or the plan counts what Copy pastes)');
  H.check(o.length === 0, `${o.length} students whose Copy number differs from the plan's`);
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
