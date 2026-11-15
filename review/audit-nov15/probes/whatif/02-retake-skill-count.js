// WIF-02: the retake line counts every skill below goal in a unit, but the rule (24 Oct and 3 Nov) is "the unit's Focus IXL
// cell at full credit, or IXL points enough for it". In a unit with more skills than its Focus column has points (the real
// class: Unit 1 has 23 skills, Unit 1 IXL is out of 15) a student is told to finish far more skills than opens the retake.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    // a linked student whose Unit 1 IXL column is not full: clear their missing work so IXL is the only thing in the way
    const col = gb.assignments.find(a => /^Unit 1 IXL$/.test(a.name)); const u = T.unitsOf(s).find(x => x.short === 'Unit 1');
    const i = gb.students.findIndex((n, j) => { const f = A.findStudent(s, n); return f.ixl != null && A.points(s, u, f.ixl) < col.max && A.activeFor(s, u, f.ixl).length - A.points(s, u, f.ixl) > col.max - A.points(s, u, f.ixl) + 1; });
    const name = gb.students[i]; const ix = A.findStudent(s, name).ixl;
    gb.assignments.forEach(a => { if (a.status[i] === 'missing') { a.status[i] = 'score'; a.values[i] = a.max; } });
    gb.assignments.filter(a => /ixl/i.test(a.name) && a !== col).forEach(a => { a.status[i] = 'score'; a.values[i] = a.max; });   // other IXL columns at full in Focus
    const before = A.retakeStatus(s, name); const words = A.retakeWhy(before), student = A.retakeWhy(before, true);
    const plan = A.quickestPath(s, A.openSec(s), i, ix);
    // do exactly (column points − points now) more skills: the closest-to-goal ones below goal
    const need = col.max - A.points(s, u, ix); const below = A.activeFor(s, u, ix).filter(k => { const v = A.eff(s, k, ix); return v == null || v < s.threshold; });
    below.slice(0, need).forEach(k => s.scores[k][ix] = 100);
    const after = A.retakeStatus(s, name);
    return { pts: A.points(s, u, ix), max: col.max, own: A.activeFor(s, u, ix).length, words, student, need, okAfter: after.ok, afterWhy: A.retakeOkWhy(after), planIxl: plan && plan.ixl.map(x => x.unit.short + ':' + x.n).join(',') };
  }, S.K);
  console.log('Unit 1: Focus column out of', r.max, '· the student\'s own skills', r.own);
  console.log('OBSERVED: retake chip "' + r.words + '"; to the student: "' + r.student + '"; after', r.need, 'more skills the retake is', r.okAfter ? 'open ("' + r.afterWhy + '")' : 'still closed');
  console.log('EXPECTED: the line asks for', r.need, 'more skill(s) in Unit 1 (enough for the column\'s', r.max, 'points), since that alone opens the retake');
  S.check(r.okAfter, 'the retake opens after the column\'s points (sanity)');
  S.check(new RegExp('\\b' + r.need + ' IXL skills? in Unit 1').test(r.words), 'the chip names the skills that open the retake (' + r.need + '), not every skill below goal');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
