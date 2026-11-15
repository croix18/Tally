// CHT-15 (Low): axis labels that do not match the data's range. Dot plot of a test out of 21: the last labelled tick is
// 20, so dots at 21 sit past the last number; histogram of a 25-point set in bins of 2: the axis ends at 26 (the last bar
// is labelled 24–25 but drawn 24 to 26); a points line graph up to 30: ticks 0, 7.5, 15, 22.5, 30.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(APP));
  const o = await p.evaluate(() => { const A = window.__all; const P = s => new DOMParser().parseFromString(s, 'image/svg+xml'); const tl = s => [...P(s).querySelectorAll('text.tl')].map(t => t.textContent);
    const dots = tl(A.chartDots([12, 15, 18, 21, 21, 20, 19], 21, {}));
    const hist = tl(A.chartHist([3, 9, 14, 20, 24, 25, 25], 25, 2, {}));
    const line = [...P(A.chartLines(['Sep 5', 'Sep 12'], [{ name: 'A', values: [12, 26] }], {})).querySelectorAll('text.tl')].filter(t => t.getAttribute('text-anchor') === 'end').map(t => t.textContent);
    return { dotsLast: dots[dots.length - 1], histLast: hist[hist.length - 1], line }; });
  console.log('OBSERVED: dot plot (max 21) last tick', o.dotsLast, '· histogram (max 25, bins of 2) axis ends at', o.histLast, '· line ticks', o.line.join(', '));
  console.log('EXPECTED: the maximum labelled on the dot plot (21), the histogram axis ending at the top of its last bin as labelled (25), whole-number ticks');
  check(o.dotsLast === '21', 'the dot plot labels its maximum');
  check(o.histLast === '25', 'the histogram axis ends where its last bin ends');
  check(o.line.every(t => /^\d+$/.test(t)), 'line-graph ticks are whole numbers');
  check(errs.length === 0, 'no page errors');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
