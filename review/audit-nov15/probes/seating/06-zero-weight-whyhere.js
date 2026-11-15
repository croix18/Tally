// SEA-06: with a priority turned to 0 the solver ignores it and the issues list is silent (ROUND4 #12: "a factor at
// 0 raises no issues"), but the why-here panel still marks the student as failing it (warn line, no tick) and claims
// "High behavior: the solver keeps other H students away".
const { open, check, done } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    // a 2-row room: desks side by side (70 apart = partners)
    const desks = []; for (let i = 0; i < 8; i++) desks.push({ id: 'd' + i, x: 40 + (i % 4) * 70, y: 40 + Math.floor(i / 4) * 300, r: 0 });
    T.state.room = { w: 900, h: 600, front: 'top', desks, teacher: { x: 740, y: 20, w: 130, h: 64 }, door: null };
    T.state.seatWeights = { behavior: 0, fast: 0, front: 0, teacher: 0 };
    const mk = (id, o) => Object.assign({ id, display: id, first: id, last: 'X', behavior: 'low', front: false, nearTeacher: false, standing: 60, level: null, apart: [], together: [], plan: '', notes: '' }, o);
    const stu = [mk('A', { behavior: 'high', front: true, nearTeacher: true, standing: 10 }), mk('B', { behavior: 'high' }), mk('C'), mk('D')];
    const G = A.geometry(); const seats = { d4: 'A', d5: 'B', d0: 'C', d1: 'D' };   // A (front flag, near-teacher, standing 10) in the back row beside B (high)
    const iss = A.explainSeats(seats, stu, G).map(x => x.msg);
    const why = A.whyHere(s, { seats }, 'A', 'd4', stu, G).map(l => (l.ok ? 'ok   ' : 'WARN ') + l.msg);
    return { issues: iss, why }; }, K);
  console.log('OBSERVED:', JSON.stringify(o, null, 1));
  const warns = o.why.filter(l => l.startsWith('WARN'));
  console.log('EXPECTED: behavior, standing, front and near-teacher weights at 0: no issue (as the issues list shows: ' + o.issues.length + ') and no failing line in why-here; no claim that the solver keeps H students away');
  check(o.issues.length === 0, 'the issues list raises nothing for zero-weight factors');
  check(warns.length === 0, `why-here marks no line as failing for a factor the teacher turned off (${warns.length}: ${warns.join(' | ')})`);
  check(!o.why.some(l => /solver keeps other H students away/.test(l)), 'why-here does not say the solver separates H students when "Separate talkers" is 0');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
