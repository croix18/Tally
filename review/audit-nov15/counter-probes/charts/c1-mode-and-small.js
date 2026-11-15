// Counter probe: what stats() reports as the mode when every value is equally frequent, and a half-point quartile.
const path = require('path'); const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  await p.goto('file://' + path.resolve(APP));
  const out = await p.evaluate(() => { const A = window.__all; const s1 = A.stats([1, 2, 3, 4, 5, 6]); const s2 = A.stats([4, 4, 7, 7, 9, 9]);
    const s3 = A.stats([15, 16, 17.5, 18, 19, 20, 20.5, 21]);
    return { m1: s1.mode, m2: s2.mode, keys: Object.keys(s1).join(','), q: [s3.q1, s3.q3, A.fmtN ? A.fmtN(s3.q1) : '?'] }; });
  console.log(JSON.stringify(out)); await b.close();
})();
