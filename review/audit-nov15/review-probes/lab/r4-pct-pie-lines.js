// Counter-review: CHT-03 in the circle graph; CHT-15 count-axis ticks on line charts (also used by home.js).
const path = require('path'); const REPO = process.env.TALLY_REPO;
const { chromium, exe, APP, check, done } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await b.newPage(); await p.goto('file://' + path.resolve(APP));
  const out = await p.evaluate(() => { const A = window.__all;
    const pie = A.pieParts({ kind: 'gbx', pct: true, max: 100, values: [110, 104, 80, 60, 30, 95], missing: 0 }).map(q => q.label + ' = ' + q.value);
    const ticks = span => [...new DOMParser().parseFromString(A.chartLines(['a', 'b'], [{ name: 'Missing', values: [0, span - 3] }], { min: 0 }), 'image/svg+xml').querySelectorAll('text.tl')].map(t => t.textContent).filter(t => /^[\d.]+$/.test(t));
    return { pie, t70: ticks(70), t90: ticks(90), t7: ticks(7) }; });
  console.log(JSON.stringify(out));
  check(!/75–100%[^,]*= [1-9]/.test(out.pie.join(',')) || out.pie.some(x => /110|over 100/i.test(x)), 'CHT-03: the % circle graph does not count 110% and 104% in "75–100%"');
  check([...out.t70, ...out.t90, ...out.t7].every(t => Number.isInteger(+t)), 'CHT-15: a count axis on a line chart has whole-number ticks (' + out.t70.join(',') + ' / ' + out.t90.join(',') + ' / ' + out.t7.join(',') + ')');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
