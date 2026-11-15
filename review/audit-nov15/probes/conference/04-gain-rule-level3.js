// CNF-04 (DECISION): Croix's gain rule ("the threes need to get a four") against the state's: a Level 3 or Level 4
// student who stays at that level and scores at least one point higher earns a learning gain (FAST Achievement Level
// Scale Scores including Learning Gains Subcategories, cut scores approved 10 Jan 2024; Rule 6A-1.09981 F.A.C.).
// Tally's student-facing FAST report tells that student more points "are needed for a gain".
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.prep = 'on'; const gb = s.grades;
    const nm = gb.students[3], id = String(gb.ids[3]);
    // last year: Level 3 on the grade-6 test (230); this year: PM1 240 on the grade-7 test, still Level 3 (235-246)
    T.importFast({ students: [{ id, name: nm, grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 3, scale: 230, grade: 6 }, { test: 'FAST', pm: 'PM1', year: '2026-27', level: 3, scale: 240 }], info: {} }], blank: 0, windows: [{ pm: 'PM3', year: '2025-26' }, { pm: 'PM1', year: '2026-27' }] }, 'f.csv');
    const t = A.fastTargets(s, nm); const div = document.createElement('div'); div.innerHTML = A.fastReportSection(s, nm);
    return { gradeNow: t.gradeNow, prior: t.prior.scale, latest: t.latest.scale, latestBucket: t.latestBucket.label, gain: t.gain, said: div.querySelector('.gain').textContent }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: a PM3 of 231 or more on the grade-7 test while staying Level 3 (235-246) is a learning gain under the state rule; 240 already is one if held on PM3');
  L.check(!/needed for a gain/.test(out.said), 'the report does not tell a Level-3-and-higher student that more points are needed for a gain');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
