// CHT-09: the Race's shared baseline is the earliest "previous import" in the league. When one class has gone weeks
// without an import, that date is earlier than another class's FIRST import, so that class (four imports, students
// moving every week) reads "first week in the race" and is ranked below every class with movement.
// Synthetic histories on three copies of the fixture class.
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
(async () => {
  const { b, p, errs, K } = await open({ classes: 3 });
  const out = await p.evaluate(K => { const T = window.__tally, A = window.__all; const keys3 = [K, 'p2-acc', 'p3-acc'];
    const mk = (s, dates, step) => { const keys = A.ixlList(s).map(x => x.key); const units = T.unitsOf(s); const u = units.find(u => u.assigned);
      s.history = dates.map((date, di) => { const per = {}, pu = {}, ua = {}; units.forEach(v => { ua[v.name] = v.active.length; pu[v.name] = {}; });
        keys.forEach((k, i) => { const n = Math.min(u.active.length, 1 + di * step + (i % 2)); pu[u.name][k] = n; per[k] = n; }); return { date, thr: s.threshold, students: keys.length, per, pu, ua }; }); };
    const [a, bb, c] = keys3.map(k => T.state.sections[k]);
    mk(a, ['2026-10-12', '2026-11-13'], 1);                               // 1st Period: not imported between Oct 12 and Nov 13
    mk(bb, ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-13'], 2);  // 2nd Period: first import Oct 26, weekly since, everyone moving
    mk(c, ['2026-10-12', '2026-11-09', '2026-11-13'], 1);
    const L = A.leaderboardData().filter(r => r.prep === 'acc');
    const html = A.lbMarkup(L, 'acc'); const d = new DOMParser().parseFromString(html, 'text/html');
    const cards = [...d.querySelectorAll('.lbCard')].map(cd => ({ rank: cd.querySelector('.lbRank').textContent.trim() || '1', name: cd.querySelector('.lbName').textContent.trim(), line: cd.querySelector('.lbLine').textContent.trim() }));
    return { cards, hist2: bb.history.map(h => h.date) }; }, K);
  const two = out.cards.find(c => /^2nd Period/.test(c.name));
  console.log('OBSERVED: 2nd Period (imports', out.hist2.join(', ') + ') shows "' + two.line + '", rank', two.rank, '· all:', out.cards.map(c => c.rank + ' ' + c.name.replace(/ ·.*/, '') + ': ' + c.line).join(' | '));
  console.log('EXPECTED: a class with four imports is not told it is in its first week; it is measured (from its own first import, said as "since Oct 26") or the line says why it is not');
  check(!/first week/.test(two.line), 'a class with weeks of history is not "first week in the race"');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
