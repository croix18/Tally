// WIF-04: Show student's "Show me on the sliders" sets only the plan's own controls: a next assessment the student
// switched on, or a retake slider they moved, stays, so the big "If you do the things you picked" grade is not the
// grade the plan card above it promises.
const S = require('./_setup.js');
(async () => { const { b, p, errs } = await S.open();
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    // a real student below an A with a plan that reaches the next letter
    const i = gb.students.findIndex((n, j) => { const q = A.quickestPath(s, A.openSec(s), j, A.findStudent(s, n).ixl); return q && !q.top && q.reached && !q.retakes.length; });
    const name = gb.students[i]; T.openProfile(K, name); await new Promise(r => setTimeout(r, 50)); A.openShow(s, name);
    const el = document.getElementById('show'); const q = A.quickestPath(s, A.openSec(s), i, A.findStudent(s, name).ixl);
    // the student tries a low next test first
    const on = el.querySelector('#shNextOn'); on.checked = true; on.dispatchEvent(new Event('change'));
    const rg = el.querySelector('#shNextPts'); rg.value = 0; rg.dispatchEvent(new Event('input'));
    const tried = parseInt(el.querySelector('#shIfV').textContent);
    el.querySelector('#shPlan').click();
    const shown = parseInt(el.querySelector('#shIfV').textContent), L = el.querySelector('#shIfL').textContent;
    const card = el.querySelector('.shQuick .qres').innerText.replace(/\s+/g, ' ');
    return { tried, shown, L, card, res: q.result.rounded, letter: q.result.letter, nextStillOn: el.querySelector('#shNextOn').checked };
  }, S.K);
  console.log('OBSERVED: after trying a 0 on the next test (' + r.tried + '%), "Show me on the sliders" shows ' + r.shown + '% ' + r.L + ' (next test still counted: ' + r.nextStillOn + '), under a plan card that reads "' + r.card + '"');
  console.log('EXPECTED: the sliders show the plan alone: ' + r.res + '% ' + r.letter);
  S.check(r.shown === r.res, 'applying the plan shows the plan\'s grade');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
