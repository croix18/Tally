// CHT-07 (DECISION): Tally's quartiles are the medians of the lower and upper halves (the middle value left out when n is
// odd). Florida's B.E.S.T. glossary (Appendix C) defines them as "the median of the data values less than M" and "greater
// than M". The two agree unless values tie the median, and IXL points pile up on ties: then they differ by whole skills.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(APP));
  const out = await p.evaluate(() => { const A = window.__all; const med = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    const glossary = v => { v = v.slice().sort((a, b) => a - b); const M = med(v); const lo = v.filter(x => x < M), hi = v.filter(x => x > M); return { q1: lo.length ? med(lo) : null, q3: hi.length ? med(hi) : null }; };
    const v = [3, 6, 9, 9, 9, 9, 9, 9, 10, 12];   // skills at goal on a 12-skill unit: a pile-up at 9
    const s = A.stats(v); return { v, tally: { q1: s.q1, q3: s.q3, iqr: s.iqr, bunched: s.bunched }, best: glossary(v) }; });
  console.log('OBSERVED: data', out.v.join(', '), '-> Tally Q1 =', out.tally.q1, ', Q3 =', out.tally.q3, ', IQR =', out.tally.iqr, out.tally.bunched ? '(outlier rule switched off: IQR <= 1)' : '');
  console.log('EXPECTED (B.E.S.T. glossary, literal): Q1 = median of values < 9 =', out.best.q1, ', Q3 = median of values > 9 =', out.best.q3, ', IQR =', out.best.q3 - out.best.q1);
  check(out.tally.q1 === out.best.q1 && out.tally.q3 === out.best.q3, 'quartiles follow the B.E.S.T. glossary definition');
  check(errs.length === 0, 'no page errors');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
