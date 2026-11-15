// RPT-05 (CLEANUP): studentReportSection computes values its page never prints (nextAssessment/nextLine, rtNeed, rtShort,
// copyLine/copyPts, ids, unitWords, the report-log lookup for the removed "since" strip). Measures the cost of the dead nextAssessment call.
const H = require('./h.js');
(async () => { const { b, p, K } = await H.open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = A.gbRows(s); const og = A.openSec(s); const idx = s.grades.students.map((_, i) => i);
    let t0 = performance.now(); for (let r = 0; r < 3; r++) idx.forEach(i => A.studentReportSection(s, i, rows[i])); const all = (performance.now() - t0) / 3;
    t0 = performance.now(); for (let r = 0; r < 3; r++) idx.forEach(i => A.nextAssessment(og, i, 20, {})); const na = (performance.now() - t0) / 3;
    const html = A.studentReportSection(s, 0, rows[0]); return { all: Math.round(all), na: Math.round(na), saysNext: /for an A|keeps the|would take more than one assessment|alone won't reach/.test(html) }; }, K);
  console.log('OBSERVED: a class of 23 reports takes', o.all, 'ms; the unused nextAssessment alone', o.na, 'ms; its sentence on the page:', o.saysNext);
  console.log('EXPECTED: nothing computed for a sentence the page does not print');
  H.check(o.saysNext || o.na < 1, 'nextAssessment is only computed when its sentence is printed');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
