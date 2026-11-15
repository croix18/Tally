// CNF-02: FAST results are also stored under 'n:<norm(name)>', and testHistory reads that key after the ID key, so a
// student who lacks a window gets a same-name student's window (last year's PM3, and with it the gain target).
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    gb.students[0] = 'DOE, JANE'; gb.students[1] = 'DOE, JANE'; A.uniqueNames(gb.students, gb.ids); T.save(); T.render();
    const nA = gb.students[0], nB = gb.students[1]; const idA = A.findStudent(s, nA).id, idB = A.findStudent(s, nB).id;
    // the Focus FAST report: A has last year's PM3 and this year's PM1; B is new to Florida (PM1 only)
    T.importFast({ students: [
      { id: idA, name: 'DOE, JANE', grade: 7, tests: [{ test: 'FAST', pm: 'PM3', year: '2025-26', level: 1, scale: 170, grade: 6 }, { test: 'FAST', pm: 'PM1', year: '2026-27', level: 1, scale: 200 }], info: { L30: 'Y' } },
      { id: idB, name: 'DOE, JANE', grade: 7, tests: [{ test: 'FAST', pm: 'PM1', year: '2026-27', level: 3, scale: 250 }], info: { L30: '' } } ],
      blank: 0, windows: [{ pm: 'PM3', year: '2025-26' }, { pm: 'PM1', year: '2026-27' }] }, 'fast.csv');
    const hB = A.testHistory(s, nB).map(h => `${h.pm} ${h.year} ${h.scale}`); const tB = A.fastTargets(s, nB);
    return { nA, nB, idA, idB, keys: Object.keys(T.state.tests), histB: hB, priorB: tB && tB.prior ? tB.prior.scale : null, gainB: tB && tB.gain ? tB.gain.score : null, formLineB: A.conferenceTests(A.conferenceData(s, nB)) }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: B (' + out.nB + ') has only her own PM1 2026-27 250, no last-year PM3 and no gain target');
  L.check(out.histB.length === 1 && out.histB[0] === 'PM1 2026-27 250', 'B\'s FAST history is her own: ' + out.histB.join(', '));
  L.check(out.priorB == null && out.gainB == null, 'no gain target from another student\'s PM3 (prior ' + out.priorB + ', gain ' + out.gainB + ')');
  L.check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
