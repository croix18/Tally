// WIF-03: an extra-credit column (0 points, Focus's rule since 14 Nov) marked NHI for a student. Nothing is owed on it
// (Focus counts it 0 of 0), yet it closes the retake, counts as missing work, and is offered as "turned in, 0/0 → no
// change"; the quickest plan, which skips 0-point columns, meanwhile plans a retake "allowed once everything above is done".
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    // a linked student with nothing in the way of a retake except what we stage, below an A
    const i = gb.students.findIndex(n => { const f = A.findStudent(s, n); const rt = A.retakeStatus(s, n); return f.ixl != null && !rt.short.length && !rt.behind.length && A.computeGrade(s, gb.students.indexOf(n)).rounded < 88; });
    const name = gb.students[i];
    gb.assignments.forEach(a => { if (a.status[i] === 'missing') { a.status[i] = 'score'; a.values[i] = Math.round(a.max * 0.6); } });
    const okBefore = A.retakeStatus(s, name).ok; const g0 = A.computeGrade(s, i).rounded;
    const n = gb.students.length; const st = gb.students.map(() => 'blank'); st[i] = 'missing';
    gb.assignments.push({ name: 'Puzzle Extra Credit', max: 0, values: gb.students.map(() => null), status: st, due: '09/24' });
    const rt = A.retakeStatus(s, name); const g1 = A.computeGrade(s, i).rounded;
    const div = document.createElement('div'); div.innerHTML = A.whatIfMarkup(A.openSec(s), i, rt);
    const row = [...div.querySelectorAll('tr')].find(tr => /Puzzle Extra Credit/.test(tr.textContent));
    const q = A.quickestPath(s, A.openSec(s), i, A.findStudent(s, name).ixl);
    return { g0, g1, okBefore, ok: rt.ok, why: A.retakeWhy(rt), row: row ? row.innerText.replace(/\s+/g, ' ') : null, missingTile: A.studentSummary(s, name).missing, planRetake: q && q.retakes.length > 0, planLine: q && q.plan.filter(x => x.kind === 'retake').map(x => x.a.name).join() };
  }, S.K);
  console.log('OBSERVED: grade', r.g0 + '% before and', r.g1 + '% after the 0-point column (no effect); retake eligible before:', r.okBefore, '· after:', r.ok, '("' + r.why + '"); what-if row: "' + r.row + '"; Missing now tile:', r.missingTile, '; quickest plan lists a retake:', r.planRetake, r.planLine ? '(' + r.planLine + ')' : '');
  console.log('EXPECTED: a 0-point (extra-credit) column owes nothing: retake still eligible, no "turned in, 0/0" row, not counted as missing; the plan and the chip agree');
  S.check(r.okBefore && r.ok, 'an NHI on an extra-credit column does not close the retake');
  S.check(!r.row, 'no "turned in, 0/0" what-if row');
  S.check(r.missingTile === 0, 'not counted as missing work');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
