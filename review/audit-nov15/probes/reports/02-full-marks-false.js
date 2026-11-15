// RPT-02: the weekly report says "Nothing missing and every assessment at full marks" while the Assessments box on the
// same page lists IXL columns (which Focus counts as Assessments) well below full marks.
const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s);
    const i = rows.findIndex(r => !r || r.ixl == null);   // a student Tally can't see in IXL (7 of 23 in the fixture class)
    gb.assignments.forEach(a => { a.status[i] = 'score'; a.values[i] = /\bixl\b/i.test(a.name) ? Math.floor(a.max / 3) : a.max; a.missing = a.status.filter(x => x === 'missing').length; });
    T.save(); const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html');
    return { who: i, doThis: d.querySelector('.panel.main .pbody').textContent.trim(), asmt: d.querySelector('.tq') ? [...d.querySelectorAll('.tq tr')].map(r => [...r.children].map(c => c.textContent).join(' ')).filter(x => /IXL/.test(x)) : [], head: (d.querySelectorAll('.panel .ph')[2] || {}).textContent }; }, K);
  console.log('OBSERVED: Do this week says', JSON.stringify(out.doThis), '| the Assessments box on the same page lists', JSON.stringify(out.asmt));
  console.log('EXPECTED: no "every assessment at full marks" while an Assessments item is below full (here the IXL columns at a third)');
  H.check(!/every assessment at full marks/.test(out.doThis), 'the report does not claim full marks over IXL assessments at a third');
  const o2 = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const rows = A.gbRows(s); const i = rows.findIndex(r => !r || r.ixl == null);
    gb.assignments.forEach(a => { if (A.catOf(s.prep, a.name) === 'Assessments') { a.status[i] = 'excused'; a.values[i] = null; } else { a.status[i] = 'score'; a.values[i] = Math.round(a.max * 0.85); } });
    T.save(); const d = new DOMParser().parseFromString(A.studentReportSection(s, i, rows[i]), 'text/html'); return { doThis: d.querySelector('.panel.main .pbody').textContent.trim(), tests: (d.querySelector('.tests') || {}).textContent }; }, K);
  console.log('OBSERVED (no assessment graded):', JSON.stringify(o2));
  H.check(!/every assessment at full marks/.test(o2.doThis), 'no full-marks claim when no assessment is graded');
  H.check(errs.length === 0, 'no page errors');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
