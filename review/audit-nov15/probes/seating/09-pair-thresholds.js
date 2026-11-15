// SEA-09: for one partner pair, why-here and the issues list use different cut-offs. Tutor pairs: why-here warns
// "too close to be a tutor pair" at a gap of 25 or less (pairCost >= 0.5); the issues list only below 15. Similar
// level: why-here warns "far apart" from a gap of 25; the issues list only above 50. A pair at gap 20 (tutor) or 40
// (similar) is "failing" on the student's panel and absent from "N issues" / "Every priority is satisfied".
const { open, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const desks = [{ id: 'd0', x: 40, y: 40, r: 0 }, { id: 'd1', x: 110, y: 40, r: 0 }];
    T.state.room = { w: 900, h: 600, front: 'top', desks, teacher: null, door: null }; T.state.seatWeights = {};
    const mk = (id, st) => ({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: st, level: null, apart: [], together: [], plan: '', notes: '' });
    const G = A.geometry(); const res = {};
    for (const [mode, a, c] of [['tutor', 60, 80], ['similar', 40, 80]]) { T.state.seatPairs = mode; const stu = [mk('A', a), mk('B', c)]; const seats = { d0: 'A', d1: 'B' };
      const why = A.whyHere(s, { seats }, 'A', 'd0', stu, G).filter(l => /Tutor pairs|Similar level/.test(l.msg)).map(l => (l.ok ? 'ok ' : 'WARN ') + l.msg);
      res[mode] = { gap: Math.abs(a - c), why, issues: A.explainSeats(seats, stu, G).map(x => x.msg) }; }
    T.state.seatPairs = 'mix'; return res; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: the panel and the issues list agree on whether this pair breaks the partner rule');
  for (const m of ['tutor', 'similar']) { const warn = o[m].why.some(l => l.startsWith('WARN')); check(warn === (o[m].issues.length > 0), `${m} gap ${o[m].gap}: why-here ${warn ? 'warns' : 'is ok'}, issues list has ${o[m].issues.length}`); }
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
