// RPT-08: "This quarter's IXL finished -> X%" fills every IXL column to its full points, also for a student whose own
// (modified) list in that unit is shorter: it promises a grade that finishing every skill cannot reach.
const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl; const col = gb.assignments.find(a => /Unit 2 IXL/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 2');
    const skip = {}; u.active.slice(0, 5).forEach(k => skip[A.skillKey(s.skills[k])] = true); s.studentSkips[A.ixlKeyAt(s, ix)] = skip;
    A.activeFor(s, u, ix).forEach(k => { s.scores[k][ix] = 90; }); col.status[i] = 'score'; col.values[i] = 12;      // all 12 own skills done and copied: 12/17 in Focus
    gb.assignments.forEach(a => { if (a !== col && a.status[i] === 'missing') { a.status[i] = 'score'; a.values[i] = a.max; } });
    T.save(); const og = A.openSec(s);
    const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html'); const tot = [...d.querySelectorAll('.tot')].map(x => x.textContent).find(x => /IXL finished/.test(x)) || '';
    // what finishing every skill on the student's own lists really gives: each IXL column at min(max, own skills)
    const real = {}; const full = {}; gb.assignments.filter(a => /\bixl\b/i.test(a.name) && a.max > 0 && (a.status[i] === 'score' || a.status[i] === 'missing')).forEach(a => { const m = a.name.match(/unit\s*(\d+)/i); const uu = m && T.unitsOf(s).find(x => x.short === 'Unit ' + m[1]); if (!uu) return; real[a.name] = Math.min(a.max, A.totalFor(s, uu, ix)); full[a.name] = a.max; });
    const gReal = A.computeGrade(og, i, real), gFull = A.computeGrade(og, i, full);
    return { row: tot, real: gReal.rounded + '% ' + gReal.letter, full: gFull.rounded + '% ' + gFull.letter, cols: real }; }, K);
  console.log('OBSERVED:', o.row || '(no row)', '| every column filled to its points gives', o.full);
  console.log('EXPECTED: the row claims what finishing the student\'s own skills gives:', o.real, JSON.stringify(o.cols));
  H.check(!o.row || o.row.includes(o.real.split(' ')[0]), 'the IXL total is reachable');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
