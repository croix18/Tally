// RPT-01: "Remove a print" of a mid-week reprint also erases the earlier print of the same week for the reprinted students.
// Monday: the whole class is printed (23 reports). Wednesday: two students' reports are printed again (lost copies).
// Removing Wednesday's print should leave Monday's print of all 23 on record, as Remove a print promises ("Nothing else changes").
const H = require('./h.js');
(async () => { const { b, p, errs, K } = await H.open({ now: Date.parse('2026-11-16T08:00:00-05:00') });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = A.gbRows(s); s.reportLog = {};
    const all = s.grades.students.map((_, i) => i);
    window.__setNow(Date.parse('2026-11-16T08:00:00-05:00')); all.forEach(i => A.logReport(s, i, rows[i]));                 // Monday: every student
    const before = A.printsOf(s).map(x => `${x.date}:${x.n}`);
    A.markReportBack(s, s.grades.students[0], '2026-11-16', true);                                                              // student 0's Monday report came back signed Tuesday
    window.__setNow(Date.parse('2026-11-18T08:00:00-05:00')); [0, 1].forEach(i => A.logReport(s, i, rows[i]));                // Wednesday: two reprints
    const listed = A.printsOf(s).map(x => `${x.date}:${x.n}`);
    A.removePrint(s, '2026-11-18');                                                                                             // the teacher removes Wednesday's print
    const after = A.printsOf(s).map(x => `${x.date}:${x.n}`); const s0 = A.reportsOf(s, s.grades.students[0]);
    return { before, listed, after, stu0: s0.map(e => e.date + (e.back ? ' back' : '')) }; }, K);
  console.log('Monday print on record:', out.before.join(' '), '| after the Wednesday reprint:', out.listed.join(' '));
  console.log('OBSERVED: after removing the Wednesday print:', out.after.join(' ') || '(nothing)', '| student 0 reports:', JSON.stringify(out.stu0));
  console.log('EXPECTED: 2026-11-16:23 | student 0 reports: ["2026-11-16 back"]');
  H.check(out.after.join(' ') === '2026-11-16:23', 'Monday\'s print keeps all 23 reports');
  H.check(JSON.stringify(out.stu0) === '["2026-11-16 back"]', 'student 0 keeps the Monday report and its back-signed tick');
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
