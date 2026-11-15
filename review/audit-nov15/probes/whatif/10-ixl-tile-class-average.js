// WIF-10: after Quarter 1 closes, the student page's "IXL at goal" tile counts the open units ("2 of 36 skills") but
// its "class average" and its "since the last export" change come from ixlTrend, which counts every assigned unit,
// closed ones included (33.1 of 59). The student is compared with a class figure on another basis.
const S = require('./_setup.js'); const path = require('path');
(async () => { const { b, p, errs } = await S.open();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await S.pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); T.save(); T.render();
    const name = s.grades.students.find(n => A.findStudent(s, n).ixl != null); T.openProfile(K, name); await new Promise(r => setTimeout(r, 100));
    const tile = [...document.querySelectorAll('.gcard')].find(x => /IXL at goal/.test(x.textContent)).innerText.replace(/\s+/g, ' ');
    // the class average on the tile's own basis: each counted student's ixlFor().done (open units)
    const pop = T.population(s); const same = pop.map(x => A.ixlFor(s, x.i).done); const avg = same.reduce((a, b) => a + b, 0) / same.length;
    const ix = A.ixlFor(s, A.findStudent(s, name).ixl);
    return { tile, avg: Math.round(avg * 10) / 10, units: ix.units.map(x => x.u.short + (x.closed ? ' (closed)' : '') + ' ' + x.p + '/' + x.n).join(', '), mine: A.ixlTrend(s, A.findStudent(s, name).ixl).mine.slice(-1)[0], done: ix.done };
  }, S.K);
  const m = /class average ([\d.]+) skills/.exec(r.tile); const shown = m ? +m[1] : null;
  console.log('units:', r.units);
  console.log('OBSERVED: tile "' + r.tile + '" (the sparkline\'s last point is', r.mine, 'skills, the tile\'s own count', r.done + ')');
  console.log('EXPECTED: the class average counted like the student\'s figure (open units only):', r.avg, 'skills; and the sparkline / "since the last export" on the same basis');
  S.check(shown != null && Math.abs(shown - r.avg) < 0.06, 'class average on the tile\'s basis');
  S.check(r.mine === r.done, 'the sparkline counts what the tile counts');
  S.check(errs.length === 0, 'no page errors');
  await b.close(); S.done(); })().catch(e => { console.error(e); process.exit(2); });
