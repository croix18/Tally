// IXL-07: turning "Grade on each student's best score" off (or on) changes every count, but no snapshot is re-taken:
// the newest history snapshot (Race movement, IXL trend, What changed) keeps the old basis.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(__dirname, 'lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  const w1 = H.grid('2026-11-02', ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER'], [sk('AA1', [90, 80, 10]), sk('AA2', [80, 75, null])]);
  const w2 = H.grid('2026-11-09', ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER'], [sk('AA1', [50, 40, 10]), sk('AA2', [80, 30, null])]);   // SmartScores fell
  await H.imp(p, w1);
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
  await H.imp(p, w2);
  // Settings → (Tally) → untick "Grade on each student's best score across imports" → Save
  await p.click('#btnSettings'); await p.waitForTimeout(300); await global.seeTab(p, '#useBest'); await p.uncheck('#useBest'); await p.click('#mSave'); await p.waitForTimeout(400);
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]]; const u = T.unitsOf(s)[0];
    const h = s.history[s.history.length - 1]; return { useBest: T.state.settings.useBest, snap: h.per, now: Object.fromEntries(A.ixlList(s).map(x => [x.key, T.points(s, u, x.i)])) }; });
  console.log('OBSERVED:', `useBest=${out.useBest}; newest snapshot ${JSON.stringify(out.snap)}; grid now ${JSON.stringify(out.now)}`);
  console.log('EXPECTED:', 'the newest snapshot equals the grid once the basis changes (snapshot comment: "re-taken whenever the basis changes (skips, goal), so the newest one always reflects the grid")');
  check(out.useBest === false, 'the setting was saved');
  check(JSON.stringify(out.snap) === JSON.stringify(out.now), 'newest snapshot = grid after the best-score switch');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
