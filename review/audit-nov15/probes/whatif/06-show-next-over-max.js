// WIF-06: Show student starts the next-assessment slider at the student's own Assessments percent. With bonus points or
// extra credit in Assessments that percent is over 100, so the start is more than the test's points: the slider sits at
// its end, the label reads "21.5 / 20", and "Count it" computes the grade from 21.5 out of 20.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    const i = gb.students.findIndex((n, j) => A.findStudent(s, n).ixl != null && A.computeGrade(s, j).rounded >= 80);   // any linked student: every assessment is set below
    // bonus: one quiz scored 3 over its points (Focus takes a score above the max; Tally reads up to twice the points)
    const q = gb.assignments.find(a => a.name === 'Unit 1 Vocabulary Quiz'); q.status[i] = 'score'; q.values[i] = q.max + 3;
    gb.assignments.filter(a => A.catIn(s, a) === 'Assessments' && a !== q).forEach(a => { if (a.max > 0) { a.status[i] = 'score'; a.values[i] = a.max; } });
    const name = gb.students[i]; T.openProfile(K, name); await new Promise(r => setTimeout(r, 50)); A.openShow(s, name); const el = document.getElementById('show');
    const rg = el.querySelector('#shNextPts'), out = rg.nextElementSibling.textContent; const on = el.querySelector('#shNextOn'); on.checked = true; on.dispatchEvent(new Event('change'));
    const shown = parseInt(el.querySelector('#shIfV').textContent); const mx = +el.querySelector('#shNextMax').value;
    const sliderAt = +rg.value; const atMax = A.gradeWith(A.openSec(s), i, {}, { max: mx, pts: mx }).rounded; const used = /^([\d.]+)/.exec(out)[1];
    const withUsed = A.gradeWith(A.openSec(s), i, {}, { max: mx, pts: +used }).pct, withMax = A.gradeWith(A.openSec(s), i, {}, { max: mx, pts: mx }).pct;
    return { pctA: A.computeGrade(s, i).cats.Assessments.pct, out, sliderAt, mx, shown, atMax, withUsed, withMax };
  }, S.K);
  console.log('OBSERVED: Assessments', r.pctA.toFixed(1) + '%; next test out of', r.mx, '· label "' + r.out + '", slider at', r.sliderAt, '· the grade counts', r.withUsed.toFixed(2) + '% (from the label\'s score), not', r.withMax.toFixed(2) + '% (the slider\'s)');
  console.log('EXPECTED: the start never exceeds the test\'s points: label', r.mx + ' / ' + r.mx, 'at most, and the grade is the slider\'s');
  S.check(+r.out.split('/')[0] <= r.mx, 'the starting score is within the test\'s points');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
