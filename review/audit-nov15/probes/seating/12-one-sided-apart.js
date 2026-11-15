// SEA-12 (FRAGILE): keep-apart and seat-near are read in one direction only. buildModel checks a.apart.includes(b) for
// i < j (roster order), explainSeats for a.id < b.id (name order). A link stored on one side only (a v8 backup with a
// one-sided list, an older or hand-edited save) is a hard rule for the solver or not depending on roster order, and
// why-here can say "TOO CLOSE" while the fit and the issues list say nothing is broken.
const { open, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    T.state.room = { w: 900, h: 600, front: 'top', desks: [{ id: 'd0', x: 40, y: 40, r: 0 }, { id: 'd1', x: 110, y: 40, r: 0 }, { id: 'd2', x: 600, y: 400, r: 0 }], teacher: null, door: null }; T.state.seatWeights = {};
    const mk = (id, apart) => ({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: 50, level: null, apart, together: [], plan: '', notes: '' });
    const stu = [mk('ADAMS, A', []), mk('BAKER, B', ['ADAMS, A']), mk('COLE, C', [])];   // only Baker lists the rule
    const G = A.geometry(); const seats = { d0: 'ADAMS, A', d1: 'BAKER, B', d2: 'COLE, C' }; const M = A.buildModel(s, stu, G);
    return { modelHard: M.hard.length, fitHard: A.scoreSeats(s, seats, stu, G, M).hard, issues: A.explainSeats(seats, stu, G).filter(x => x.t === 'hard').length,
      whyBaker: A.whyHere(s, { seats }, 'BAKER, B', 'd1', stu, G).filter(l => /Keep apart/.test(l.msg)).map(l => l.msg) }; }, K);
  console.log('OBSERVED:', JSON.stringify(o));
  console.log('EXPECTED: a keep-apart stored on either student is one hard rule: model 1, fit "1 hard rule broken", issues 1, matching why-here');
  check(o.modelHard === 1 && o.fitHard === 1 && o.issues === 1, 'a one-sided keep-apart is enforced and reported');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
