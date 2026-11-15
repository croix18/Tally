// WIF-07: a unit IXL column Focus marks excused (NG) for one student. The retake still requires that unit's IXL, and
// the plan explains the requirement with "Unit 2 IXL isn't in Focus yet", which is false: the column is in Focus,
// excused for this student.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const u2 = T.unitsOf(s).find(u => u.short === 'Unit 2'); const col = gb.assignments.find(a => a.name === 'Unit 2 IXL');
    const i = gb.students.findIndex(n => { const f = A.findStudent(s, n); return f.ixl != null && A.points(s, u2, f.ixl) < col.max - 2; });
    const name = gb.students[i]; const ix = A.findStudent(s, name).ixl;
    gb.assignments.forEach(a => { if (a === col) { a.status[i] = 'excused'; a.values[i] = null; return; }
      if (/ixl/i.test(a.name)) { a.status[i] = 'score'; a.values[i] = a.max; return; }
      a.status[i] = 'score'; a.values[i] = A.isAssess(s, a) ? Math.round(a.max * 0.55) : a.max; });   // nothing missing, tests low: a retake is the way up
    const rt = A.retakeStatus(s, name); const q = A.quickestPath(s, A.openSec(s), i, ix);
    const line = q.plan.find(x => x.kind === 'ixlreq'); const div = document.createElement('div'); div.innerHTML = A.quickestList(q);
    const li = [...div.querySelectorAll('li')].find(x => /Finish .* in Unit 2/.test(x.textContent));
    return { ok: rt.ok, why: A.retakeWhy(rt), li: li ? li.innerText.replace(/\s+/g, ' ') : null, retakes: q.retakes.map(x => x.a.name), status: col.status[i] };
  }, S.K);
  console.log('OBSERVED: Unit 2 IXL is', r.status, 'for the student; retake:', r.ok ? 'eligible' : '"' + r.why + '"', '; plan line: "' + r.li + '"; then', r.retakes.join(', '));
  console.log('EXPECTED: the plan never says a column that is in Focus "isn\'t in Focus yet"; and (decision) an excused column is not graded for this student, so by the 24 Oct rule ("everything Focus grades") it should not stand between them and a retake');
  S.check(!r.li || !/isn't in Focus yet/.test(r.li), 'no "isn\'t in Focus yet" for a column that is in Focus');
  S.check(r.ok, 'an IXL column excused for the student does not close the retake (the 24 Oct rule)');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
