// IXL-02: the import's history snapshot reads best scores and student skips through the PREVIOUS export's key cache
// (sec._keys, spread from the old section) when the new export has the same number of students in a different line-up.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(__dirname, 'lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  // Week 1: Alex has two skills at goal. Week 2: Alex has withdrawn, Andy has enrolled (same class size, Andy listed first).
  const w1 = H.grid('2026-11-02', ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER'], [sk('AA1', [90, 50, null]), sk('AA2', [80, null, null])]);
  const w2 = H.grid('2026-11-09', ['ANDY ADAMS', 'BLAKE BRISCOE', 'CASEY CARVER'], [sk('AA1', [null, 50, null]), sk('AA2', [null, null, null])]);
  await H.imp(p, w1);
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
  await H.imp(p, w2);
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const u = T.unitsOf(s)[0];
    const h = s.history[s.history.length - 1]; const now = s.students.map((n, i) => n + '=' + T.points(s, u, i));
    return { date: h.date, snap: h.per, now, keys: A.ixlList(s).map(x => x.key), useBest: T.state.settings.useBest }; });
  console.log('OBSERVED:', `snapshot of ${out.date}: ${JSON.stringify(out.snap)}; points() now: ${out.now.join(', ')}`);
  console.log('EXPECTED:', `the snapshot of ${out.date} equals points() for each student: ANDY ADAMS#0 = 0 (he has no scores; the 2 at goal were Alex's)`);
  check(out.snap['ANDY ADAMS#0'] === 0, "the new student's snapshot doesn't carry the withdrawn student's best scores");
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
