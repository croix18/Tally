// CHT-06: "Our own data" accepts any number (parseNums keeps decimals and negatives), but the stem-and-leaf rounds every
// value to a whole number under a key that says "1 | 3 means 13", the bar graph counts rounded values, and a negative
// value falls off the dot plot's axis and out of the circle graph. Synthetic data set: "Minutes to get to school"
// with decimals (one class), and a "Change in score" set with a negative (another class).
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const st = T.state.settings;
    const dec = A.parseNums('1.2 1.5 2.4 2.8 3.1 3.3 4.7 0.8');           // what the editor stores for this textarea
    const neg = A.parseNums('-4 -1 0 2 3 5 6 8');
    T.state.custom.push({ id: 'cdec', prep: 'acc', label: 'Minutes to get to school', unit: 'minutes', values: { [K]: dec } });
    T.state.custom.push({ id: 'cneg', prep: 'acc', label: 'Change in score', unit: 'points', values: { [K]: neg } });
    st.labPct = false; const P = h => new DOMParser().parseFromString(h, 'text/html');
    const stem = P(A.labMarkup('acc', 'custom:cdec', 0, false, false, false, 'stem'));
    const rows = [...stem.querySelectorAll('table.stem tr')].map(r => r.querySelector('th').textContent + ' | ' + r.querySelector('td').textContent);
    const key = (stem.querySelector('.ghint') || {}).textContent;
    const dots = P(A.labMarkup('acc', 'custom:cneg', 0, false, false, false, 'dots')); const svg = dots.querySelector('.labRow svg');
    const ax = [...svg.querySelectorAll('text.tl')].map(t => +t.textContent); const X0 = Math.min(...[...svg.querySelectorAll('text.tl')].map(t => +t.getAttribute('x')));
    const negDots = [...svg.querySelectorAll('circle.dot')].filter(c => +c.getAttribute('cx') < X0 - 0.5).map(c => c.querySelector('title').textContent);
    const pie = P(A.labMarkup('acc', 'custom:cneg', 0, false, false, false, 'circle'));
    const pieTotal = [...pie.querySelectorAll('.labPieKey b')].reduce((a, x) => a + +x.textContent, 0);
    return { dec, rows, key, axis: ax[0] + '…' + ax[ax.length - 1], negDots, pieTotal, n: neg.length }; }, K);
  console.log('OBSERVED: stem-and-leaf of', out.dec.join(', '), '->', out.rows.join(' / '), '·', out.key);
  console.log('OBSERVED: dot plot axis', out.axis, 'with dots left of 0:', out.negDots.join(', ') || 'none', '· circle graph counts', out.pieTotal, 'of', out.n, 'values');
  console.log('EXPECTED: a stem-and-leaf whose key is true for the data shown (ones as stems, tenths as leaves: "1 | 2 means 1.2"), or rounding disclosed; an axis that starts at the smallest value; every value in some slice');
  check(!out.rows.some(r => /^0 \| /.test(r) && r.split('|')[1].trim().split(' ').length > 2) || !/means 13/.test(out.key), 'the stem-and-leaf of decimals is not collapsed onto one stem under a tens key');
  check(out.negDots.length === 0, 'no dot is drawn left of the axis');
  check(out.pieTotal === out.n, 'the circle graph counts every value');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
