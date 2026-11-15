// CHT-12: histTop (the shared bar height for a Data Lab bar graph) counts one bar per value when max <= 26, but
// chartFreq switches to binned bars when it has more than 26 bars, i.e. already at max = 26. For a 26-skill unit
// (Unit 10 in the fixture course) or a test out of 26 the shared scale is taken from unbinned counts while the bars are
// binned, so each row grows its own y axis and the rows are no longer drawn to one scale (the rule NOTES/labMarkup state).
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 3 });
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; T.state.settings.useBest = false; T.state.settings.labPct = false;
    T.state.order.forEach((key, c) => { const s = T.state.sections[key]; const u = T.unitsOf(s).find(u => u.short === 'Unit 10'); T.population(s).forEach((x, j) => { const want = c === 0 ? (j < 12 ? 25 + (j % 2) : 10) : (3 * j + c) % 27; u.active.forEach((k, n) => { s.scores[k][x.i] = n < want ? 100 : null; }); }); });
    const u = T.unitsOf(T.state.sections[T.state.order[0]]).find(u => u.short === 'Unit 10');
    const html = A.labMarkup('acc', 'unit:' + u.name, 0, false, false, false, 'bar'); const d = new DOMParser().parseFromString(html, 'text/html');
    const tops = [...d.querySelectorAll('.labRow')].map(r => { const t = [...r.querySelectorAll('svg text.tl')].filter(t => t.getAttribute('x') === '34').map(t => +t.textContent); return Math.max(...t); });
    const bars = [...d.querySelectorAll('.labRow')][0].querySelectorAll('rect.bar').length;
    return { total: u.total, tops, bars }; });
  console.log('OBSERVED: Unit 10 (' + out.total + ' skills) bar graph: first row has', out.bars, 'binned bars; the rows\' y axes top out at', out.tops.join(', '));
  console.log('EXPECTED: one y scale for every row (the same top), as on every other maximum');
  check(new Set(out.tops).size === 1, 'every row of the bar graph is drawn to one scale');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
