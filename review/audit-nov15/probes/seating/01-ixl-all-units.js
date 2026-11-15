// SEA-01: Seating's "IXL completion" counts every assigned unit (closed Quarter 1 units too); the Students screen,
// the Grades table and the assessments comparison all use ixlFor(sec, si).pct (the open quarter's units). After the
// Q2 gradebook arrives, the seating sheet says "IXL 17%" for a student the Students screen shows at 6%, and the IXL
// rank that feeds standing (placement) is built on the other figure.
const path = require('path');
const { open, pick, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; T.state.seatBasis = 'blend';
    const closed = A.unitsOf(s).filter(u => u.assigned && u.total && A.unitClosed(s, u)).map(u => u.short);
    const stu = A.seatStudents(s).filter(x => x.ixl != null); const diff = stu.map(x => ({ seat: Math.round(x.ixlPct), students: Math.round(A.ixlFor(s, x.ixl).pct) })).filter(d => d.seat !== d.students);
    const one = stu.find(x => Math.round(x.ixlPct) !== Math.round(A.ixlFor(s, x.ixl).pct));
    return { q: T.liveQuarter(s), closed, n: stu.length, differ: diff.length, sample: diff.slice(0, 4), text: one ? A.standingText(one).replace(/^.*?(IXL \d+%)/, '$1') : '' }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: in Quarter 2 with Unit 1 closed, the seating IXL figure equals the Students screen figure (ixlFor(sec, si).pct, open-quarter units) for every student (NOTES "7. IXL at goal", 14 Nov)');
  check(o.closed.length > 0, 'fixture reaches a closed unit (Q2 gradebook imported)');
  check(o.differ === 0, `seating IXL % equals the Students screen's for every student (${o.differ} of ${o.n} differ)`);
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
