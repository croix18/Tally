// IXL-07: turning "best score" off re-snapshots only the newest snapshot; the one before it was counted with best on,
// so the Race and What changed read the setting change as students dropping.
const path = require('path'); const REPO = process.env.TALLY_REPO;
const H = require(path.join(REPO, 'review/audit-nov15/probes/ixl/lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER', 'DREW DUNNE'];
  await H.imp(p, H.grid('2026-11-02', st, [sk('AA1', [90, 90, 70, 10]), sk('AA2', [85, 10, null, null])]));
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.state.settings.useBest = true; T.save(); });
  await H.imp(p, H.grid('2026-11-09', st, [sk('AA1', [50, 90, 70, 10]), sk('AA2', [85, 10, null, null])]));   // nobody gained; ALEX's AA1 fell 90 -> 50 (best keeps 90)
  const before = await p.evaluate(() => { const r = window.__all.leaderboardData()[0]; return { gain: r.gain, basis: r.basisChanged }; });
  await p.evaluate(() => { window.__all.setUseBest ? window.__all.setUseBest(false) : null; window.__tally.save(); });
  const after = await p.evaluate(() => { const r = window.__all.leaderboardData()[0]; const d = window.__all.digestFor(window.__tally.state.sections[window.__tally.state.order[0]]); return { gain: r.gain, basis: r.basisChanged, down: d.ixl && d.ixl.down && d.ixl.down.length }; });
  console.log('OBSERVED best on', JSON.stringify(before), '| after turning best off', JSON.stringify(after));
  check(after.gain === before.gain || after.basis, 'turning best score off is not read as a student dropping in the Race');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
