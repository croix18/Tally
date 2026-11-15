// SEA-10: lowStanding() counts any FAST level 1 student as "low" whatever "Place by" says. With Place by = Focus grade
// (or Assessments / IXL progress), two partners at standing 88 and 94 get "both low standing" and a pair cost,
// because both scored level 1 on FAST, which that basis is meant to leave out.
const { open, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    T.state.room = { w: 900, h: 600, front: 'top', desks: [{ id: 'd0', x: 40, y: 40, r: 0 }, { id: 'd1', x: 110, y: 40, r: 0 }], teacher: null, door: null }; T.state.seatWeights = {}; T.state.seatPairs = 'mix';
    const mk = (id, st) => ({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: st, level: 1, pct: 8, grade: st, gradeRank: st, apart: [], together: [], plan: '', notes: '' });
    const out = {};
    for (const basis of ['grade', 'blend']) { T.state.seatBasis = basis; const stu = [mk('A', 88), mk('B', 94)]; const G = A.geometry();
      out[basis] = { text: A.standingText(stu[0]), issues: A.explainSeats({ d0: 'A', d1: 'B' }, stu, G).map(x => x.msg), pairCost: A.pairCost(stu[0], stu[1]) }; }
    T.state.seatBasis = 'blend'; return out; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: under "Focus grade" the standings 88 / 94 are not low: no "both low standing", pair cost 0 (FAST is not part of this basis: SEAT_BASES "rank in the class by current course grade")');
  check(o.grade.pairCost === 0 && !o.grade.issues.some(m => /both low standing/.test(m)), 'Place by Focus grade: two students at 88 and 94 are not "both low standing"');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
