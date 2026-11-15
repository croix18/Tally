// CHT-13: the Board's "as of" is the NEWEST class's export date (labAsOf and lbMarkup take .sort().pop()), so when one
// class's IXL is two weeks old the Race and the Data Lab still say "as of Nov 13" over that class's numbers.
// Synthetic: three copies of the fixture class; 2nd Period's IXL export dated Oct 30, the others Nov 13.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs } = await open({ classes: 3 });
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; T.state.order.forEach(k => { const s = T.state.sections[k]; s.date = k === 'p2-acc' ? '2026-10-30' : '2026-11-13'; });
    const P = h => new DOMParser().parseFromString(h, 'text/html');
    const race = P(A.lbMarkup(A.leaderboardData(), 'acc')).querySelector('.lbSub').textContent;
    const lab = P(A.labMarkup('acc', 'unit:__all__', 0, false, false, false, 'box')).querySelector('.lbSub').textContent;
    return { race, lab, dates: T.state.order.map(k => T.state.sections[k].date) }; });
  console.log('OBSERVED: class exports', out.dates.join(', '), '· Race:', out.race, '· Data Lab:', out.lab);
  console.log('EXPECTED: the line says when the data are from for every class drawn ("as of Oct 30 to Nov 13", or the stale class named), not the newest date alone');
  check(/Oct 30/.test(out.race) && /Oct 30/.test(out.lab), 'the oldest export date drawn is shown');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
