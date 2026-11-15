// CHT-05: the Data Lab's line graph (and every chartLines date axis) places imports at equal steps whatever the days
// between them, and nothing on the axis says so: imports on Sep 2, Sep 3 and Sep 26 are drawn equally far apart, so the
// one-day change looks as long as the 23-day one. Synthetic: two earlier snapshots added to the fixture class's history.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const cur = s.history[s.history.length - 1]; const u = T.unitsOf(s).find(u => u.short === 'Unit 1');
    const older = (date, f) => { const h = JSON.parse(JSON.stringify(cur)); h.date = date; Object.keys(h.pu[u.name]).forEach(k => h.pu[u.name][k] = Math.floor(h.pu[u.name][k] * f)); return h; };
    s.history = [older('2026-09-02', 0.3), older('2026-09-03', 0.35), cur];
    const html = A.labMarkup('acc', 'unit:' + u.name, 0, false, false, false, 'line');
    const d = new DOMParser().parseFromString(html, 'text/html'); const svg = d.querySelector('.labRow.one svg');
    const xs = [...svg.querySelectorAll('circle')].map(c => +c.getAttribute('cx')); const labels = [...svg.querySelectorAll('text.tl')].map(t => t.textContent).filter(t => /[A-Z][a-z]{2} \d/.test(t));
    return { dates: s.history.map(h => h.date), xs, labels, sub: d.querySelector('.lbSub').textContent }; }, K);
  const g1 = out.xs[1] - out.xs[0], g2 = out.xs[2] - out.xs[1];
  console.log('OBSERVED: imports', out.dates.join(', '), 'drawn at x =', out.xs.map(x => x.toFixed(0)).join(', '), '(gaps', g1.toFixed(0), 'and', g2.toFixed(0) + ') · axis:', out.labels.join(', '), '· line:', out.sub);
  console.log('EXPECTED: gaps in proportion to the days between imports (1 : 23), or the axis saying the steps are imports, not equal time');
  check(Math.abs(g2 / g1 - 23) < 0.5 || /each import|imports, not/.test(out.sub + out.labels.join(' ')) && false, 'a date axis spaces dates by time');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
