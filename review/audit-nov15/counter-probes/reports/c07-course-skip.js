// Counter probe for RPT-07/08: the same "never done" happens to EVERY student when a skill is skipped course-wide
// (tap the skill) and the Focus column keeps its original points. Also prints what the Focus copy would write.
process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-reports/repo';
const H = require('/home/claude/work/audit/reports/probes/h.js');
(async () => { const { b, p, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); let u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const before = u.active.length;
    u.active.slice(0, 2).forEach(k => s.excluded[A.skillKey(s.skills[k])] = true); T.save(); T.render();
    u = T.unitsOf(s).find(x => x.short === 'Unit 2'); const after = u.active.length;
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl;
    u.active.forEach(k => { s.scores[k][ix] = 90; }); col.status[i] = 'missing'; col.values[i] = 0; T.save();
    const copy = A.pendingCopies(s, A.openSec(s), i, ix).map(c => c.a.name + ' ' + c.from + '->' + c.to);
    return { colMax: col.max, before, after, pts: A.points(s, u, ix), owed: A.owedWork(s, A.openSec(s), i, ix).owed.map(a => a.name), copy }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: with every course skill at goal and the copy pending, Unit 2 IXL is not owed');
  H.check(!o.owed.includes('Unit 2 IXL'), 'course-wide skip: column not owed');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
