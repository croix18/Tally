// CHT-01: a histogram in bins of 1 (auto for any data set whose maximum is 10 or less) folds the maximum into the bar
// below it and labels that bar with the lower value only: 5 students with 10 of 10 and 4 with 9 of 10 read "9: 9 students".
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const u = T.unitsOf(s).find(u => u.short === 'Unit 5'); const pop = T.population(s);
    // synthetic: 5 students with all 10 skills at goal, 4 with 9 of 10, the rest none
    pop.forEach((x, j) => { const want = j < 5 ? 10 : j < 9 ? 9 : 0; u.active.forEach((k, n) => { s.scores[k][x.i] = n < want ? 100 : null; }); if (s.best) u.active.forEach(k => { const b = s.best[A.skillKey(s.skills[k])]; if (b) Object.keys(b).forEach(kk => b[kk] = null); }); });
    const truth = pop.map(x => T.points ? T.points(s, u, x.i) : A.points(s, u, x.i));
    T.state.settings.labPct = false; T.state.settings.labBin = 0;
    const html = A.labMarkup('acc', 'unit:' + u.name, 0, false, false, false, 'hist');
    const d = new DOMParser().parseFromString(html, 'text/html');
    const bars = [...d.querySelectorAll('.labRow rect.bar')].map(r => r.querySelector('title').textContent);
    return { total: u.total, truth: [10, 9].map(v => v + ': ' + truth.filter(t => t === v).length), bars: bars.filter(t => !/: 0 students/.test(t)) }; }, K);
  console.log('OBSERVED: unit of', out.total, 'skills, histogram bars with students:', out.bars.join(' | '));
  console.log('EXPECTED: a bar for 10 (5 students) and a bar for 9 (4 students): true counts', out.truth.join(', '));
  check(out.bars.some(t => /^10: 5 students/.test(t)) && out.bars.some(t => /^9: 4 students/.test(t)), 'the maximum has its own bar, and 9 counts only the 9s');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
