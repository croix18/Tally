// IMP-01 poolKeys vs a class's own IXL export: a carved class's kept data is under course keys ("JORDAN LEE#1"); its own
// section export keys the class "Name#n" in its own order, ignoring poolKeys. Does MICHAEL keep his pick and his kept best?
const { check, done, open, imp, skillRows, grid, POOL, flip, fix, DAY } = require('./h');
(async () => {
  const { b, p, errs } = await open();
  const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'KAI BOND'], B = ['PIA ROSS', 'QUINN HALE', 'JORDAN LEE', 'RUBY CHAN', 'SAM VOSS', 'TOM WELD'];
  const ids = {}; let id = 8000; const disp = (n, c) => flip(n) + (n === 'JORDAN LEE' ? (c === 1 ? ' ALEX' : ' MICHAEL') : '');
  const gb = (list, c) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(n => `"${disp(n, c)}","${ids[n + c] = ids[n + c] || id++}","8"`).join('\n') + '\n';
  await imp(p, [{ name: POOL('2026-11-06'), text: grid([...A, ...B], skillRows(4), (n, i) => n === 'JORDAN LEE' ? (i < 6 ? 60 : 90) : 70) }]);
  await imp(p, [{ name: 'p1.csv', text: gb(A, 1), lastModified: DAY - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await imp(p, [{ name: 'p2.csv', text: gb(B, 2), lastModified: DAY - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  await fix(p, 'period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1');
  const look = () => p.evaluate(() => { const A = window.__all, T = window.__tally; const k = T.state.order.find(k => T.state.sections[k].period === 2); const s = T.state.sections[k]; const r = A.buildRows(s).find(x => x.display === 'LEE, JORDAN MICHAEL'); return { key: k, from: !!s.fromSection, status: r && r.status, eff: r && r.ixl != null ? A.eff(s, 0, r.ixl) : null }; });
  const w1 = await look();
  // his class's own IXL export (2nd period only), a week newer: MICHAEL's SmartScores fell to 40
  const sec = 'IXL-Score-Grid_2026-11-13_This-School-Year_1205050-7T2A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
  const r = await imp(p, [{ name: sec, text: grid(B, skillRows(4), n => n === 'JORDAN LEE' ? 40 : 70) }], { ask: 'yes' });
  const w2 = await look(); await fix(p, 'period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#0'); w2.afterRepick = await look();
  check(w1.eff === 90 && w2.status === 'ok' && w2.eff === 90 && w2.afterRepick.eff === 90, `after his class's own export MICHAEL is still matched and keeps his kept best 90: ${JSON.stringify({ w1, w2, ans: r.answers })}`);
  check(!errs.length, 'no page errors ' + errs.join('|')); await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
