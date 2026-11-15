// WIF-08: Focus's IXL cell ahead of Tally's points (the Focus check's "N off" case). The plan counts each new skill as
// one more Focus point on top of the Focus cell, but a skill only moves Focus when Tally's points pass the cell (the copy
// is min(points, column) and only when it is more than Focus has): "Pass 1 more IXL skill → full" is not true.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const u2 = T.unitsOf(s).find(u => u.short === 'Unit 2'); const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
    const i = gb.students.findIndex(n => { const f = A.findStudent(s, n); return f.ixl != null && A.points(s, u2, f.ixl) <= col.max - 5; });
    const name = gb.students[i]; const ix = A.findStudent(s, name).ixl; const pts = A.points(s, u2, ix);
    gb.assignments.forEach(a => { if (a === col) { a.status[i] = 'score'; a.values[i] = col.max - 1; return; } if (/ixl/i.test(a.name)) { a.status[i] = 'score'; a.values[i] = a.max; return; } a.status[i] = 'score'; a.values[i] = A.isAssess(s, a) ? Math.round(a.max * 0.7) : a.max; });
    const q = A.quickestPath(s, A.openSec(s), i, ix); const step = q.plan.find(x => x.kind === 'ixl' && x.a === col);
    const rt = A.retakeStatus(s, name);
    // do the one skill the plan asks for, then ask Tally what Focus would get
    const below = A.activeFor(s, u2, ix).filter(k => { const v = A.eff(s, k, ix); return v == null || v < s.threshold; }); below.slice(0, step ? step.n : 1).forEach(k => s.scores[k][ix] = 100);
    const copies = A.pendingCopies(s, A.openSec(s), i, ix).filter(c => c.a === col); const rt2 = A.retakeStatus(s, name);
    return { pts, focus: col.max - 1, max: col.max, step: step ? `Pass ${step.n} more → ${step.after}%` : null, rtWhy: A.retakeWhy(rt), copyAfter: copies.length ? copies[0].to : 'none', okAfter: rt2.ok, why2: A.retakeWhy(rt2), retakes: q.retakes.map(x => x.a.name) };
  }, S.K);
  console.log('OBSERVED: Unit 2: Tally', r.pts, 'points, Focus', r.focus + '/' + r.max, '· plan step "' + r.step + '"' + (r.retakes.length ? ', then retake ' + r.retakes.join(', ') : '') + ' · retake line "' + r.rtWhy + '" · after doing that step: copy to Focus', r.copyAfter, ', retake', r.okAfter ? 'open' : '"' + r.why2 + '"');
  console.log('EXPECTED: a step the plan lists moves the grade it says once done: with Focus ahead of Tally, one skill moves nothing; the plan should count from Tally\'s points (or say the Focus cell is ahead)');
  S.check(!r.step || r.copyAfter !== 'none', 'doing the plan\'s IXL step changes what Focus gets');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
