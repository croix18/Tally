// Counter probe for CON-03: the conference panel/form counts missing work with EVERY IXL column dropped
// (conference.js:34, retakeStatus's rule), not with owedWork. A student whose only NHI is an IXL column with
// skills still to do (Croix 31 Oct: "If ixl is missing, they have a missing assignment") reads "Missing: 0" there,
// while the weekly report (owedWork) and the page tile count it.
process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-consistency/repo';
const H = require('/home/claude/work/audit/consistency/probes/h.js');
(async () => { const { b, p } = await H.open(); await H.scenarioA(p); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const rows = T.gbRows(s); const out = [];
    os.grades.students.forEach((n, i) => { const ow = A.owedWork(s, os, i, rows[i].ixl); const owedIxl = ow.owed.filter(a => /\bixl\b/i.test(a.name)); if (!owedIxl.length) return;
      const d = A.conferenceData(s, n); const dr = A.conferenceDraft(d); out.push({ n, owed: ow.owed.length, owedIxl: owedIxl.map(a => a.name), conf: d.missing.length + d.missedTests.length, draft: JSON.stringify(dr).slice(0, 600) }); });
    return out; }, H.K);
  console.log('cases', o.length); o.slice(0, 3).forEach(x => console.log(JSON.stringify(x)));
  const bad = o.filter(x => x.conf !== x.owed);
  console.log('OBSERVED:', bad.length, 'students whose conference "Missing" leaves out an owed IXL column');
  console.log('EXPECTED: conference Missing = owedWork owed (report count): an IXL column with skills to do is missing work (NOTES 31 Oct)');
  H.check(bad.length === 0, 'conference missing equals owedWork');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
