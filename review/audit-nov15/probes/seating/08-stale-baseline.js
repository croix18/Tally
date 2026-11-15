// SEA-08: the fit baseline is cached under class|basis|pairs|weights|n|m only. A change to the students' standings
// (the weekly Focus gradebook or IXL import), the room geometry or flags set outside the sheet keeps the old
// baseline, so the same chart shows one fit now and another after a reload (or after viewing another class).
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  await p.evaluate(`(${roomJS})(30, 6)`);
  const FN = `(K, mode) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const fitNow = () => { const stu = A.seatStudents(s), G = A.geometry(); const M = A.buildModel(s, stu, G); return A.scoreSeats(s, s.seating.seats, stu, G, M).fit; };
    if (mode === 'seat') { const stu = A.seatStudents(s), G = A.geometry(); const seats = {}; stu.forEach((x, i) => seats[G.ds[i].id] = x.id); s.seating = { seats, locks: {}, savedAt: new Date().toISOString() }; T.save(); return fitNow(); }
    if (mode === 'cached') return fitNow();
    const stu = A.seatStudents(s), G = A.geometry(); A.seatBaseline({ key: '__other__' }, A.buildModel(s, stu, G), G); return fitNow(); }`;   // 'fresh': the cache holds one key, so this forces a recompute (as a reload does)
  const before = await p.evaluate(`(${FN})('${K}', 'seat')`);
  // CLEANUP hazard demo: standings change by a path that does not reset seatBase (here set directly: every FAST pct moves)
  await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; A.seatStudents(s).forEach((x, i) => { s.seatInfo[x.id].pct = (i * 37) % 100; }); }, K);
  const cached = await p.evaluate(`(${FN})('${K}', 'cached')`); const recomputed = await p.evaluate(`(${FN})('${K}', 'fresh')`);
  const o = { before, afterStandingsChange: { shownNow: cached, afterReload: recomputed } };
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: the fit shown right after the change equals the fit the same chart gets after a reload');
  check(cached === recomputed, `after standings change the same chart shows fit ${cached} now and ${recomputed} after a reload`);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
