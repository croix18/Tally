// CON-02: the student page's "IXL at goal" tile sets the student's skills on THIS quarter's units ("27 of 36 skills")
// beside a class average counted over EVERY assigned unit ("class average 33.1 skills"), once the class is in Quarter 2.
const H = require('./h.js');
(async () => { const { b, p, errs } = await H.open(); await H.scenarioA(p); await H.importGb(p, 'fixtures/focus_gradebook_scrubbed_q2.csv');
  const o = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const rows = T.gbRows(s);
    const open = T.unitsOf(s).filter(u => u.assigned && u.total && !T.unitClosed(s, u)); const pop = T.population(s);
    const mine = si => open.reduce((a, u) => a + T.activeFor(s, u, si).filter(k => { const v = T.eff(s, k, si); return v != null && v >= s.threshold; }).length, 0);
    const clsOpen = pop.reduce((a, x) => a + mine(x.i), 0) / pop.length; const poss = open.reduce((a, u) => a + u.total, 0);
    const name = s.grades.students.find((n, i) => rows[i] && rows[i].ixl != null); T.openProfile(K, name);
    const tile = [...document.querySelectorAll('.profile .gcard')].find(c => /IXL at goal/i.test(c.innerText)).innerText.replace(/\s+/g, ' ');
    return { name, units: open.map(u => u.short), poss, clsOpen: Math.round(clsOpen * 10) / 10, tile }; }, H.K);
  const shown = +(/class average ([\d.]+) skills/.exec(o.tile) || [])[1];
  console.log('OBSERVED:', o.tile, '| units counted for the student:', o.units.join(', '));
  console.log('EXPECTED:', `class average on the same ${o.poss} skills (${o.units.join(', ')}): ${o.clsOpen} skills`);
  H.check(Math.abs(shown - o.clsOpen) < 0.06, 'the class average is on the same units as the student\'s count');
  H.check(!(shown > o.poss), 'a class average can\'t exceed the skills counted (' + shown + ' of ' + o.poss + ')');
  await b.close(); H.done(); })().catch(e => { console.error(e); process.exit(2); });
