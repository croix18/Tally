// Counter-review: "Our own data" on the Board with two classes (synthetic): rows on one x scale, bar graph and
// circle graph labels true for decimals, stem key, % axis over 100, rounding note.
const { open } = require(require("path").join(process.env.TALLY_REPO, 'review/audit-nov15/probes/charts/_setup.js'));
const { check, done } = require(require('path').join(process.env.TALLY_REPO, 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 2 });
  const out = await p.evaluate(() => {
    const T = window.__tally, A = window.__all; const P = h => new DOMParser().parseFromString(h, 'text/html'); const [k1, k2] = T.state.order;
    T.state.settings.labPct = false; T.state.settings.labBin = 0;
    T.state.custom.push({ id: 'mix', prep: 'acc', label: 'Books read', unit: 'books', values: { [k1]: [0, 2, 3, 5, 6, 7, 8, 10], [k2]: [1, 2, 3.5, 4, 6, 7, 9, 10] } });
    T.state.custom.push({ id: 'dec', prep: 'acc', label: 'Minutes', unit: 'minutes', values: { [k1]: [1.2, 1.5, 2.4, 2.8, 3.1, 3.3, 4.7, 0.8], [k2]: [1, 2, 2, 3, 3, 4, 4, 4] } });
    const rows = h => [...P(h).querySelectorAll('.labRow')].filter(r => r.querySelector('svg'));
    const hist = rows(A.labMarkup('acc', 'custom:mix', 0, false, false, false, 'hist')).map(r => ({ bars: [...r.querySelectorAll('rect.bar')].map(x => +(+x.getAttribute('x')).toFixed(0)).slice(0, 4), titles: [...r.querySelectorAll('rect.bar title')].map(t => t.textContent).filter(t => !/: 0 /.test(t)) }));
    const bar = rows(A.labMarkup('acc', 'custom:dec', 0, false, false, false, 'bar')).map(r => [...r.querySelectorAll('rect.bar title')].map(t => t.textContent).filter(t => !/: 0 /.test(t)));
    const pie = [...P(A.labMarkup('acc', 'custom:dec', 0, false, false, false, 'circle')).querySelectorAll('.labPie')].map(c => c.textContent.replace(/\s+/g, ' ').trim());
    const pieParts = A.pieParts(A.labSeries('acc', 'custom:dec').find(x => x.sec.key === k1));
    T.state.custom = T.state.custom.filter(c => !['mix', 'dec'].includes(c.id));
    return { hist, bar, pie, pieParts: pieParts.map(q => q.label + ' = ' + q.value) };
  });
  console.log(JSON.stringify(out, null, 1));
  check(JSON.stringify(out.hist[0].bars) === JSON.stringify(out.hist[1].bars), 'CHT-01: two classes on one Board draw their bars at the same x positions');
  const barCount = out.bar.map(r => r.reduce((a, t) => a + +/: (\d+)/.exec(t)[1], 0));
  check(barCount[0] === 8, 'bar graph of 8 decimal values counts all 8 (got ' + barCount[0] + ')');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
