// IXL-05: IXL student keys are "name#occurrence". When one of two same-name students leaves the class, the one who stays
// takes over the leaver's key, so the leaver's best scores (and skips) become theirs: points that go to Focus.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(__dirname, 'lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  // Week 1: two students named SAM LEE; the first has both skills at goal, the second none.
  const w1 = H.grid('2026-11-02', ['SAM LEE', 'SAM LEE', 'CASEY CARVER'], [sk('AA1', [90, 20, 70]), sk('AA2', [85, null, null])]);
  // Week 2: the first Sam Lee has withdrawn. The remaining Sam Lee still has 20 and nothing else.
  const w2 = H.grid('2026-11-09', ['SAM LEE', 'CASEY CARVER'], [sk('AA1', [20, 70]), sk('AA2', [null, null])]);
  await H.imp(p, w1);
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
  await H.imp(p, w2);
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const u = T.unitsOf(s)[0];
    return { pts: T.points(s, u, 0), cells: [0, 1].map(k => A.eff(s, k, 0)), useBest: T.state.settings.useBest, col: A.unitColumn(s, u, 'names').join(' | ') }; });
  console.log('OBSERVED:', `the remaining SAM LEE (SmartScores 20 and blank in every export) is counted ${out.pts} point(s); scores used ${JSON.stringify(out.cells)}; copy: ${out.col}`);
  console.log('EXPECTED:', 'SAM LEE = 0 points: neither of his own scores ever reached the goal (67); the 90 and 85 were the other Sam Lee\'s');
  check(out.pts === 0, "a same-name student doesn't inherit the leaver's best scores");
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
