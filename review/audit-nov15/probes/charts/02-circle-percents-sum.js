// CHT-02: a circle graph's percent labels are each rounded on their own, so a pie can read 19% + 19% + 63% = 101%.
// Synthetic: one IXL skill in the fixture class (16 counted students): 3 at goal, 3 below goal, 10 not started.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; T.state.settings.useBest = false;
    const u = T.unitsOf(s).find(u => u.short === 'Unit 3'); const k = u.active[0]; const pop = T.population(s);
    pop.forEach((x, j) => { s.scores[k][x.i] = j < 3 ? 90 : j < 6 ? 40 : null; });
    const id = 'skill:' + A.skillKey(s.skills[k]);
    const html = A.labMarkup('acc', id, 0, false, false, false, 'circle');
    const d = new DOMParser().parseFromString(html, 'text/html');
    const labs = [...d.querySelectorAll('.labPie svg text.val')].map(t => t.textContent.trim());
    const key = [...d.querySelectorAll('.labPieKey span')].map(t => t.textContent.trim());
    return { labs, key }; }, K);
  const sum = out.labs.reduce((a, t) => a + +/(\d+)%/.exec(t)[1], 0);
  console.log('OBSERVED: slices', out.key.join(', '), '-> labels', out.labs.join(' + '), '=', sum + '%');
  console.log('EXPECTED: labels that add to 100% (e.g. largest-remainder rounding: 19% + 19% + 62%), each within 1 point of its true share (18.75%, 18.75%, 62.5%)');
  check(sum === 100, 'the percent labels of one circle graph add to 100');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
