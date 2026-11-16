// CTR-01 carryBest: a student who LEFT keeps his bests in his old class; a different student of the same name who joins
// another class later (the only one of that name in the course) is handed the leaver's bests.
const { check, done, open, imp, skillRows, grid, POOL, flip, DAY } = require('./h');
(async () => {
  const { b, p, errs } = await open();
  const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'KAI BOND', 'LUZ MORA'], B = ['PIA ROSS', 'RUBY CHAN', 'SAM VOSS', 'TOM WELD', 'UMA YATES', 'VIC ZANE'];
  let id = 7000; const ids = {}; const gb = (list, tag) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(n => `"${flip(n)}","${ids[n + tag] = ids[n + tag] || id++}","8"`).join('\n') + '\n';
  await imp(p, [{ name: POOL('2026-10-30'), text: grid([...A, ...B], skillRows(4), n => n === 'JORDAN LEE' ? 95 : 70) }]);
  await imp(p, [{ name: 'p1.csv', text: gb(A, 'a'), lastModified: DAY - 14 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await imp(p, [{ name: 'p2.csv', text: gb(B, 'a'), lastModified: DAY - 14 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  // week 2: JORDAN LEE (the first one) withdraws
  const A2 = A.filter(n => n !== 'JORDAN LEE');
  console.log("ANS", JSON.stringify((await imp(p, [{ name: POOL('2026-11-06'), text: grid([...A2, ...B], skillRows(4), () => 70) }, { name: 'p1.csv', text: gb(A2, 'a'), lastModified: DAY - 7 * 864e5 }], { ask: "yes" })).answers).slice(0,600));
  // week 3: a different JORDAN LEE enrols in 2nd period; his SmartScores are 30
  console.log("ANS", JSON.stringify((await imp(p, [{ name: POOL('2026-11-13'), text: grid([...A2, ...B, 'JORDAN LEE'], skillRows(4), n => n === 'JORDAN LEE' ? 30 : 70) }, { name: 'p2.csv', text: gb([...B, 'JORDAN LEE'], 'b') }], { ask: "yes" })).answers).slice(0,600));
  const o = await p.evaluate(() => { const T = window.__tally, Al = window.__all, s = T.state.sections['period-2']; const si = s.students.indexOf('JORDAN LEE'); const u = T.unitsOf(s)[0];
    return { si, raw: si >= 0 ? s.scores[0][si] : null, eff: si >= 0 ? Al.eff(s, 0, si) : null, pts: si >= 0 ? Al.points(s, u, si) : null, p1best: JSON.stringify(T.state.sections['period-1'].best[Object.keys(T.state.sections['period-1'].best)[0]]) }; });
  console.log(JSON.stringify(await p.evaluate(() => { const T = window.__tally; return { r1: T.state.sections["period-1"].roster, r2: T.state.sections["period-2"].roster, s1: T.state.sections["period-1"].students, s2: T.state.sections["period-2"].students, li: T.state.lastImport }; })));
  check(o.si >= 0 && o.eff === 30, `the new JORDAN LEE in 2nd period counts his own scores, not the withdrawn JORDAN LEE's kept 95s: ${JSON.stringify(o)}`);
  check(!errs.length, 'no page errors ' + errs.join('|')); await b.close(); done();
})().catch(e => { console.error(e); process.exit(1); });
