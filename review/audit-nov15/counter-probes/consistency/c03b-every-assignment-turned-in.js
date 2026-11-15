// Counter probe for CON-03 (deeper): a B/A student whose only NHI is an IXL column with skills still to do.
// Conference panel: "Missing: 0", Strengths "Every assignment turned in", no IXL concern (only below a B);
// weekly report / owedWork: 1 missing. Croix 31 Oct (NOTES 933): "If ixl is missing, they have a missing assignment."
// State: one Focus cell turned to NHI in memory (what a re-export with that cell NHI produces).
process.env.TALLY_REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-consistency/repo';
const H = require('/home/claude/work/audit/consistency/probes/h.js');
(async () => { const { b, p } = await H.open(); await H.scenarioA(p); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const os = T.openSec(s); const rows = T.gbRows(s); const gb = os.grades;
    const col = gb.assignments.find(a => /\bixl\b/i.test(a.name) && a.max > 0);
    for (let i = 0; i < gb.students.length; i++) { const ix = rows[i].ixl; if (ix == null) continue; const u = A.gbUnitFor(s, col); const unit = A.unitsOf(s).find(x => x.name === u.name);
      if (A.points(s, unit, ix) >= col.max) continue; if (gb.assignments.some(a => a !== col && a.status[i] === 'missing')) continue;
      col.status[i] = 'missing'; col.values[i] = null; const r = A.computeGrade(os, i); if (r.rounded == null || r.rounded < 80) { col.status[i] = 'score'; continue; }
      const n = gb.students[i]; const ow = A.owedWork(s, os, i, ix); const d = A.conferenceData(s, n); const dr = A.conferenceDraft(d); const sum = A.studentSummary(s, n);
      return { n, col: col.name, grade: r.rounded, pts: A.points(s, unit, ix) + '/' + col.max, tileMissing: sum.missing, owed: ow.owed.map(a => a.name), confMissing: d.missing.length + d.missedTests.length, strengths: dr.strengths, concerns: dr.concerns }; }
    return null; }, H.K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: the conference counts the owed IXL column as missing and does not say "Every assignment turned in"');
  H.check(o && o.confMissing === o.owed.length, 'conference Missing equals owedWork');
  H.check(o && !/Every assignment turned in/.test(o.strengths), 'no "Every assignment turned in" with an owed IXL column');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
