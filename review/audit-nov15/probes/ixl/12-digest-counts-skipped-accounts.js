// IXL-12: "What changed this week" measures movement over every IXL account in the snapshot, including accounts the
// teacher skipped ("they leave the grid, copies, and the race") and accounts not on the roster.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(__dirname, 'lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'DUPE ACCOUNT'];   // the third is a duplicate IXL account the teacher skips
  const w1 = H.grid('2026-11-02', st, [sk('AA1', [90, 10, null]), sk('AA2', [null, null, null]), sk('AA3', [null, null, null])]);
  const w2 = H.grid('2026-11-09', st, [sk('AA1', [90, 10, 90]), sk('AA2', [null, null, 90]), sk('AA3', [null, null, 90])]);
  await H.imp(p, w1);
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.roster = 'Abbott, Alex\nBriscoe, Blake'; s.ignored = { 'DUPE ACCOUNT#0': true }; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
  await H.imp(p, w2);
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]];
    const d = A.digestFor(s); const lb = A.leaderboardData().find(r => r.key === s.key);
    return { pop: T.population(s).length, measured: d.ixl.measured, up: d.ixl.up, total: d.ixl.total, movers: d.ixl.movers.map(m => m.name), race: lb && [lb.movers, lb.measured] }; });
  console.log('OBSERVED:', `What changed: ${out.up} of ${out.measured} moved up, ${out.total >= 0 ? '+' : ''}${out.total} skills, movers ${JSON.stringify(out.movers)}; the Race for the same class: ${out.race[0]} of ${out.race[1]}; counted class ${out.pop}`);
  console.log('EXPECTED:', `the counted class only (${out.pop} students): 0 of ${out.pop} moved up, +0 skills, no movers; the skipped duplicate account is out ("Skip them: they leave the grid, copies, and the race")`);
  check(out.measured === out.pop && out.up === 0, 'What changed measures the counted class');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
