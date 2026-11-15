// SEA-11 (CLEANUP/FRAGILE): savedAt is never coerced. A Seating Chart backup whose chart carries a numeric savedAt
// (epoch ms) is accepted by importSeatingBackup, and the Seating bar then throws on `(savedAt || '').slice`, so the
// Seating view cannot render for that class. Same for a Tally save edited by hand (app.js line 121 keeps any savedAt).
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const names = A.seatStudents(s).slice(0, 2).map(x => x.display);
    const v8 = { v: 1, periods: [{ id: 'p1', sectionId: K, name: 'Period 1' }], students: names.map((n, i) => { const m = n.match(/^([^,]+),\s*(\S+)/); return { id: 's' + i, periodId: 'p1', raw: n, last: m[1], first: m[2], apart: [], together: [] }; }),
      layout: { w: 900, h: 600, front: 'top', desks: [{ id: 'dA', x: 100, y: 100, r: 0 }, { id: 'dB', x: 170, y: 100, r: 0 }] }, charts: { p1: { seats: { dA: 's0', dB: 's1' }, locks: {}, savedAt: 1757635200000 } } };
    const r = await A.importSeatingBackup(v8); T.save(); let err = null; try { A.renderSeatingBar(s); } catch (e) { err = e.message; }
    return { charts: r.charts, savedAt: s.seating && s.seating.savedAt, barError: err }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: an imported chart with a non-ISO savedAt is stored with a valid ISO date (or now) and the bar renders');
  check(o.barError === null, 'the Seating bar renders after the import');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
