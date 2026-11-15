// RPT-09: the retake notice names "the coming Wednesday and Thursday" with no school calendar. A report printed on
// Friday 20 Nov 2026 tells an eligible student to come on Wednesday Nov 25 and Thursday Nov 26: Thanksgiving week
// (Lake County Schools: "a full week off for Thanksgiving"), and Nov 26 is Thanksgiving Day.
const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open({ now: Date.parse('2026-11-20T12:00:00-05:00') });
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    // make student 0 eligible with a retake worth taking: nothing missing, every IXL skill of the open units at goal, one quiz below full
    const i = rows.findIndex(r => r && r.ixl != null); const ix = rows[i].ixl;
    gb.assignments.forEach(a => { if (a.status[i] === 'missing' || a.status[i] === 'excused') { a.status[i] = 'score'; a.values[i] = a.max; } }); s.skills.forEach((_, k) => { s.scores[k][ix] = 95; });
    const q = gb.assignments.find(a => /Squares and Cubes Quiz/.test(a.name)); q.status[i] = 'score'; q.values[i] = Math.round(q.max * 0.5);
    T.save(); const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html'); const h = d.querySelector('.howl'); return { today: new Date().toDateString(), howl: h ? h.querySelector('p').textContent.slice(0, 170) : null, ok: (A.retakeStatus(s, gb.students[i]) || {}).ok }; }, K);
  console.log('today in the page:', o.today, '| eligible:', o.ok);
  console.log('OBSERVED:', o.howl);
  console.log('EXPECTED: no HOWL day inside Thanksgiving week (Nov 23-27, 2026); at least never Thanksgiving Day, Thursday Nov 26');
  H.check(o.howl && !/Nov 2[3-7]/.test(o.howl), 'the HOWL days are school days');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
