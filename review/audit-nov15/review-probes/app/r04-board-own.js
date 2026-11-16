// IXL-13: a skill skipped for ONE student between two imports is read as that student dropping (Race gain, What changed
// "Dropped (SmartScores fell below goal)"), though snapshot's own comment says a skip between snapshots is detected.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/ixl/repo';
const H = require(path.join(REPO, 'review/audit-nov15/probes/ixl/lib-ixl.js'))(REPO); const { check, done } = H;
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
  const bf = await p.evaluate(() => window.__all.boardFile ? JSON.stringify(window.__all.boardFile()) : null);
  const f = require('path').join(H.dir, 'board.json'); require('fs').writeFileSync(f, bf);
  const ctx2 = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const q = await ctx2.newPage(); q.on('dialog', d => d.accept()); await q.goto('file://' + require('path').resolve(H.APP)); await q.waitForTimeout(400);
  await q.setInputFiles('#file', [f]); await q.waitForTimeout(900);
  const ob = await q.evaluate(() => { const A = window.__all; const r = A.leaderboardData()[0]; const s = window.__tally.state.sections[r.key]; return { gain: r.gain, basis: r.basisChanged, own: s.history.map(h => !!h.own) }; });
  console.log('BOARD', JSON.stringify(ob), 'has own in file:', /"own"/.test(bf));
  check(ob.gain === 0 || ob.basis, 'the Board file\'s Race does not read the skip as a loss either');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
