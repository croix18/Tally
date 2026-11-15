// CHT-10 (DECISION): a student with skills skipped just for him (per-student skips) who has every one of his own skills
// at goal reads 80% in the Data Lab's "%" view (points over the unit's total), but 100% in "IXL and a test" (corrPairs,
// own list), the Race's "% complete" (done / possible on own lists) and the line graph's snapshots count him on the
// unit total again. One student, two answers, on the same Board.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open();
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; T.state.settings.useBest = false;
    const u = T.unitsOf(s).find(u => u.short === 'Unit 1'); const x = T.population(s)[0]; const key = A.ixlKeyAt(s, x.i);
    const skip = u.active.slice(0, 4); s.studentSkips[key] = Object.fromEntries(skip.map(k => [A.skillKey(s.skills[k]), true]));
    u.active.forEach(k => { s.scores[k][x.i] = skip.includes(k) ? null : 100; });
    const own = A.activeFor(s, u, x.i).length, pts = A.points(s, u, x.i);
    const ser = A.labSeries('acc', 'unit:' + u.name, true)[0]; const j = T.population(s).findIndex(y => y.i === x.i);
    const L = A.leaderboardData().find(r => r.key === K);   // the Race: done / possible over own lists
    return { total: u.total, own, pts, pct: ser.values[j], ownPct: Math.round(pts / own * 100), racePossible: L.possible }; }, K);
  console.log('OBSERVED: a student with', out.own, 'of', out.total, 'Unit 1 skills on his list, all', out.pts, 'at goal, reads', out.pct + '% in the Data Lab "%" view');
  console.log('EXPECTED: one basis on the Board. IXL and a test and the Race count his own list (' + out.ownPct + '%); the "%" view says "percent of the maximum" and counts', out.pct + '%');
  check(out.pct === out.ownPct, 'the % view and the rest of the Board agree on a student with skips');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
