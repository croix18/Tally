// IXL-13: a skill skipped for ONE student between two imports is read as that student dropping (Race gain, What changed
// "Dropped (SmartScores fell below goal)"), though snapshot's own comment says a skip between snapshots is detected.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(__dirname, 'lib-ixl.js'))(REPO); const { check, done } = H;
(async () => {
  const { b, p, errs } = await H.open();
  const sk = (id, sc) => ({ unit: 'Unit 1 Synthetic Unit', name: 'Synthetic skill ' + id, id, scores: sc });
  const st = ['ALEX ABBOTT', 'BLAKE BRISCOE', 'CASEY CARVER', 'DREW DUNNE'];
  const w1 = H.grid('2026-11-02', st, [sk('AA1', [90, 10, 70, null]), sk('AA2', [80, null, null, null]), sk('AA3', [null, null, null, null])]);
  const w2 = H.grid('2026-11-09', st, [sk('AA1', [90, 10, 70, null]), sk('AA2', [80, null, null, null]), sk('AA3', [null, null, null, null])]);   // nobody practiced
  await H.imp(p, w1);
  await p.evaluate(() => { const T = window.__tally; const s = T.state.sections[T.state.order[0]]; s.skipRoster = true; T.state.settings.currentUnit = { acc: 1, on: null }; T.save(); T.render(); });
  await H.imp(p, w2);
  // Alex's list is modified: AA2 (which he had at goal) doesn't count for him. Tapping his cell does exactly this.
  await p.evaluate(() => { const T = window.__tally; T.state.view = undefined; });
  await p.click('[data-u]'); await p.waitForTimeout(300);
  await p.click('[data-cell="1|0"]'); await p.waitForTimeout(300);
  const out = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections[T.state.order[0]];
    const d = A.digestFor(s); const lb = A.leaderboardData().find(r => r.key === s.key);
    return { skips: s.studentSkips, down: d.ixl && d.ixl.down, gain: lb.gain, basis: lb.basisChanged, line: A.digestMarkup(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/Dropped[^)]*\)[^A-Z]*[A-Z, ]+[−-]?\d/) }; });
  console.log('OBSERVED:', `student skips ${JSON.stringify(out.skips)}; What changed "${out.line && out.line[0]}"; Race gain per student ${out.gain}`);
  console.log('EXPECTED:', 'nobody practiced and no SmartScore fell: no one "Dropped", Race gain 0 (or Alex left out of the comparison as a changed basis, as a course skip is)');
  check(!(out.down && out.down.length), 'no student is reported as dropped');
  check(out.gain === 0 || out.basis, 'the Race does not read the skip as a loss');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
