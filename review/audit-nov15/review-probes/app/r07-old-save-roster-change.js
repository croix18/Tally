// IMP-01 upgrade: a class saved by the old code keys its students "Name#n" in class order. rekeyCarved moves its kept
// data to the course keys only when the next carve has exactly the same students. If the class gains a student that
// same week, a student whose course key differs from his old class key (a namesake earlier in the course) loses his best.
const { check, done, open, imp, skillRows, grid, POOL, flip, fix, DAY } = require('./h');
(async () => {
  const { b, p, errs } = await open();
  const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'KAI BOND'], B = ['PIA ROSS', 'QUINN HALE', 'JORDAN LEE', 'RUBY CHAN', 'SAM VOSS', 'TOM WELD'];
  const ids = {}; let id = 8000; const disp = (n, c) => flip(n) + (n === 'JORDAN LEE' ? (c === 1 ? ' ALEX' : ' MICHAEL') : '');
  const gb = (list, c) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(n => `"${disp(n, c)}","${ids[n + c] = ids[n + c] || id++}","8"`).join('\n') + '\n';
  await imp(p, [{ name: POOL('2026-11-06'), text: grid([...A, ...B, 'ZED PARK'], skillRows(4), (n, i) => n === 'JORDAN LEE' ? (i < 6 ? 60 : 90) : 70) }]);
  await imp(p, [{ name: 'p1.csv', text: gb(A, 1), lastModified: DAY - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await imp(p, [{ name: 'p2.csv', text: gb(B, 2), lastModified: DAY - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1');
  // as the old code saved 2nd period: no poolKeys, kept bests under its own "Name#n" keys (MICHAEL = JORDAN LEE#0 there)
  await p.evaluate(() => { const A = window.__all, T = window.__tally; ['period-1', 'period-2'].forEach(k => { const s = T.state.sections[k]; delete s.poolKeys; s._keys = null; s.best = {}; A.mergeBest(s); }); T.save(); });
  await p.reload(); await p.waitForTimeout(400);
  const old = await p.evaluate(() => JSON.stringify(Object.values(window.__tally.state.sections['period-2'].best)[0]));
  // the next weekly drop: MICHAEL's SmartScores fell to 40; 2nd period also gains ZED PARK
  await imp(p, [{ name: 'p2.csv', text: gb([...B, 'ZED PARK'], 2) }], { ask: 'yes' }); await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A, ...B, 'ZED PARK'], skillRows(4), (n, i) => n === 'JORDAN LEE' ? (i < 6 ? 60 : 40) : 70) }], { ask: 'yes' });
  const o = await p.evaluate(() => { const A = window.__all, s = window.__tally.state.sections['period-2']; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return { status: r && r.status, eff: r && r.ixl != null ? A.eff(s, 0, r.ixl) : null, best: JSON.stringify(Object.values(s.best)[0]) }; });
  console.log('OBSERVED old-style best', old, '->', JSON.stringify(o));
  check(o.status === 'ok' && o.eff === 90, 'MICHAEL keeps his kept best 90 after the first carve on the new code');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
