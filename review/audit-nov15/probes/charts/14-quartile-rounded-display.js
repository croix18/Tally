// CHT-14: quartiles and medians are shown to one decimal (fmtN), so a quartile of 2.25 reads "2.3" in the stats row, on
// the box plot and under the Values chips, right beside the two chips (2 and 2.5) a student averages to get 2.25.
// Happens with half-point data: gradebook scores (8.5) and "Our own data". Synthetic custom data set.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; T.state.settings.labPct = false;
    const v = [1.5, 2, 2.5, 3, 4, 4.5, 5, 6]; T.state.custom.push({ id: 'chalf', prep: 'acc', label: 'Hours of sleep over 6', unit: 'hours', values: { [K]: v } });
    const d = new DOMParser().parseFromString(A.labMarkup('acc', 'custom:chalf', 1, false, false, true, 'box'), 'text/html');
    const cells = {}; d.querySelectorAll('.labStats div').forEach(x => { const s = x.querySelector('span'); if (s) cells[s.textContent] = x.querySelector('b').textContent; });
    const under = [...d.querySelectorAll('.labHalf small')].map(s => s.textContent);
    const chipsLo = [...d.querySelectorAll('.labHalf')][0].querySelectorAll('span.q'); const st = A.stats(v);
    return { v, q1: st.q1, q3: st.q3, shownQ1: cells.Q1, shownQ3: cells.Q3, under: under[0], chips: [...chipsLo].map(c => c.textContent) }; }, K);
  console.log('OBSERVED: data', out.v.join(', '), '· Q1 is', out.q1, 'but the stats row shows Q1 =', out.shownQ1, '(Q3', out.q3, 'shown', out.shownQ3 + ') · under the chips', out.chips.join(' and ') + ':', '"' + out.under + '"');
  console.log('EXPECTED: a quartile or median shown exactly (2.25): it is the mean of two shown values, so two decimals at most; only the mean and MAD are rounded');
  check(out.shownQ1 === String(out.q1) && out.shownQ3 === String(out.q3), 'quartiles are shown exactly');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
