// HLT-03: the Data Lab shows a mean, MAD or class average with toFixed(1), which rounds a value exactly halfway between
// tenths DOWN about half the time (binary floating point): a mean of 60.05 shows as "60.0". The charts' own helper fmtV
// (charts.js) shows the same number as "60.1", and 7th graders are taught to round half up.
const path = require('path'); process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/health/repo';
const { open, K, lib } = require('./_load.js'); const { check, done } = lib;
(async () => {
  const { b, p, errs } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const n = gb.students.length;
    // a quiz out of 100: 19 students scored 60, one 61, the rest excused  -> mean of 20 scores = 1201/20 = 60.05 exactly
    const values = gb.students.map((_, i) => i < 19 ? 60 : i === 19 ? 61 : null); const status = values.map(v => v == null ? 'excused' : 'score');
    gb.assignments.push({ name: 'Synthetic Quiz', category: 'Assessments', categoryFromFile: false, max: 100, values, status, missing: 0, excused: n - 20, unread: 0, percent: false, assignedOn: '2026-11-10', due: '2026-11-10' });
    T.save();
    const ser = A.labSeries(s.prep, 'gb:Synthetic Quiz').find(x => x.sec.key === K);
    const sum = values.filter(v => v != null).reduce((a, b) => a + b, 0), cnt = values.filter(v => v != null).length;
    return { n: ser.st.n, exact: sum + '/' + cnt, mean: ser.st.mean, labAverage: A.fmtAvg(ser), statsTableMean: ser.st.mean.toFixed(1), chartValue: A.fmtV(ser.st.mean), more: [0.15, 2.45, 72.35, 88.05].map(x => x + '->' + x.toFixed(1)) }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: 1201/20 = 60.05 shown to one decimal as "60.1" (round half up, as fmtV and the classroom do), on every Lab readout');
  check(out.labAverage === '60.1', 'Data Lab class average beside the name (fmtAvg) shows 60.1');
  check(out.statsTableMean === '60.1', 'stats table mean cell shows 60.1');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
