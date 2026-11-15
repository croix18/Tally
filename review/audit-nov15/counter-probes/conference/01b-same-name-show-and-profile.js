// Counter-probe for CNF-01: the same-name defect also reaches the student-facing Show screen (openShow) and the
// profile's quickest path / assessments (renderProfile via studentBooks), not only the conference form.
const H = require('./_h.js');
(async () => { const { b, p, errs, L, K } = await H.open({ q2: true });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const g = gb.students.map((n, i) => ({ i, r: A.computeGrade(A.openSec(s), i) })).filter(x => x.r && x.r.rounded != null);
    const a = g[0], bb = g.find(x => x.r.rounded !== a.r.rounded);
    gb.students[a.i] = 'DOE, JANE'; gb.students[bb.i] = 'DOE, JANE'; A.uniqueNames(gb.students, gb.ids); T.save(); T.render();
    const nameB = gb.students[bb.i]; const truthA = A.computeGrade(A.openSec(s), a.i).rounded, truthB = A.computeGrade(A.openSec(s), bb.i).rounded;
    A.openShow(s, nameB); const v = document.getElementById('shIfV'); const txt = v ? 'shIfV=' + v.innerText.replace(/\s+/g, '') + ' ' + (document.querySelector('.shWho')||{}).innerText : 'NO SHOW SCREEN';
    return { nameB, truthA, truthB, showText: txt }; }, K);
  console.log('OBSERVED:', JSON.stringify(out));
  console.log('EXPECTED: the Show screen for', out.nameB, 'shows', out.truthB + '%, not', out.truthA + '%');
  L.check(out.showText.includes(out.truthB + '%') && !out.showText.includes(out.truthA + '%'), 'Show screen shows the student\'s own grade');
  await b.close(); L.done(); })().catch(e => { console.error(e); process.exit(2); });
