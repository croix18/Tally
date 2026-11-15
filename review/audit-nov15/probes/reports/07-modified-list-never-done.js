// RPT-07: a student with a modified list (skills skipped for that student) who has every one of their own skills at goal
// still "owes" the unit's IXL column: the report counts it as missing work and says "the rest are below" over an empty list.
const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl; const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const key = A.ixlKeyAt(s, ix); const skip = {}; u.active.slice(0, 5).forEach(k => skip[A.skillKey(s.skills[k])] = true); s.studentSkips[key] = skip;        // 5 of the unit's skills taken off this student's list
    A.activeFor(s, u, ix).forEach(k => { s.scores[k][ix] = 90; }); col.status[i] = 'missing'; col.values[i] = 0; col.missing = col.status.filter(x => x === 'missing').length;   // every own skill at goal; Focus still NHI
    T.save(); const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html');
    const ux = [...d.querySelectorAll('.panel.ixl .u')].find(x => /Unit 2/.test(x.querySelector('.uh').textContent));
    const row = [...d.querySelectorAll('.missT tbody tr')].find(r => /Unit 2 IXL/.test(r.textContent));
    return { own: A.activeFor(s, u, ix).length, colMax: col.max, pts: A.points(s, u, ix), owed: A.owedWork(s, A.openSec(s), i, ix).owed.map(a => a.name), unitLine: ux && ux.textContent.replace(/\s+/g, ' ').trim().slice(0, 90), backRow: row && row.textContent.replace(/\s+/g, ' ').trim() }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: with all', o.own, 'of the student\'s own skills at goal, "Unit 2 IXL" is done in IXL (not owed); nothing says "the rest are below"');
  H.check(!o.owed.includes('Unit 2 IXL'), 'the column is not owed work');
  H.check(!(o.backRow && /the rest are below/.test(o.backRow)), 'the back does not point at an empty list');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
