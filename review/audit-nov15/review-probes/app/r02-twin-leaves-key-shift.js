// IMP-01 poolKeys: course keys shift when a namesake leaves the course; rekeyCarved moves kept bests only when the class's
// student list is unchanged. Does the remaining JORDAN LEE keep his own kept best (90) when his class also changes that week?
const { check, done, open, imp, skillRows, grid, POOL, flip, fix, DAY } = require('./h');
async function run(extra) {
  const { b, p, errs } = await open();
  const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'KAI BOND'], B = ['PIA ROSS', 'QUINN HALE', 'JORDAN LEE', 'RUBY CHAN', 'SAM VOSS', 'TOM WELD'];
  const ids = {}; let id = 8000; const disp = (n, c) => flip(n) + (n === 'JORDAN LEE' ? (c === 1 ? ' ALEX' : ' MICHAEL') : '');
  const gb = (list, c) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(n => `"${disp(n, c)}","${ids[n + c] = ids[n + c] || id++}","8"`).join('\n') + '\n';
  await imp(p, [{ name: POOL('2026-11-06'), text: grid([...A, ...B], skillRows(4), (n, i) => n === 'JORDAN LEE' ? (i < 6 ? 60 : 90) : 70) }]);
  await imp(p, [{ name: 'p1.csv', text: gb(A, 1), lastModified: DAY - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await imp(p, [{ name: 'p2.csv', text: gb(B, 2), lastModified: DAY - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1');
  const w1 = await p.evaluate(() => { const A = window.__all, s = window.__tally.state.sections['period-2']; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return r && r.ixl != null ? A.eff(s, 0, r.ixl) : r && r.status; });
  // week 2: ALEX withdraws; MICHAEL's SmartScores fell to 40; 2nd period may also gain a student
  const A2 = A.filter(n => n !== 'JORDAN LEE'), B2 = extra ? [...B, 'ZED PARK'] : B;
  const ans = await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A2, ...B2], skillRows(4), n => n === 'JORDAN LEE' ? 40 : 70) }, { name: 'p1.csv', text: gb(A2, 1) }, { name: 'p2.csv', text: gb(B2, 2) }], { ask: 'yes' });
  const st = await p.evaluate(() => { const A = window.__all, s = window.__tally.state.sections['period-2']; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return r && r.ixl != null ? A.eff(s, 0, r.ixl) : r && r.status; });
  const re = await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#0');
  const w2 = await p.evaluate(() => { const A = window.__all, s = window.__tally.state.sections['period-2']; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return { eff: r && r.ixl != null ? A.eff(s, 0, r.ixl) : r && r.status, best: JSON.stringify(Object.values(s.best)[0]) }; });
  await b.close(); return { w1, st, re, w2, ans: ans.answers, errs };
}
(async () => {
  for (const extra of [false, true]) { const o = await run(extra); check(o.w1 === 90 && o.w2.eff === 90, `${extra ? '2nd period also gains a student' : '2nd period unchanged'}: MICHAEL keeps his kept best 90 after his namesake leaves: ${JSON.stringify(o)}`); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
