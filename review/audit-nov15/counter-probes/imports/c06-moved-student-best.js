// Counter probe (coverage gap): a student who moves between two pool classes of one course; does the "best score across
// imports" follow him? Week 1 ALEX MOORE (2nd period) has 80 on every skill; week 2 he is in 1st period and IXL shows 50
// (SmartScores fall when a student practices and misses). Synthetic data only.
const H = require('/home/claude/work/audit/imports/probes/h.js');
const A = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'RUBY CHAN', 'SAM VOSS', 'ALEX MOORE'];
const pool = [...A, ...B];
const POOL = d => `IXL-Score-Grid_${d}_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const grid = alex => 'Unit,,Skill name,Permanent Skill ID,' + pool.map(n => `"${n}"`).join(',') + '\n' + [1, 2, 3, 4].map(k => `"Unit 2 Ratios","Lesson 2.${k}","Skill ${k}",S${k}Q,` + pool.map(n => n === 'ALEX MOORE' ? alex : 70).join(',')).join('\n') + '\n';
const fl = n => { const [f, l] = n.split(' '); return `${l}, ${f}`; };
const ids = Object.fromEntries(pool.map((n, i) => [n, String(4000100 + i)]));
const gb = list => '"Student","Student ID","Unit 2 Quiz (10 pts)"\n' + list.map(n => `"${fl(n)}","${ids[n]}","8"`).join('\n') + '\n';
const LM = Date.parse('2026-11-13T15:00:00Z');
(async () => {
  const { b, p, errs } = await H.open();
  await H.imp(p, [{ name: POOL('2026-11-06'), text: grid(80) }]);
  await H.imp(p, [{ name: 'p1.csv', text: gb(A), lastModified: LM - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await H.imp(p, [{ name: 'p2.csv', text: gb(B), lastModified: LM - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  await H.imp(p, [{ name: POOL('2026-11-13'), text: grid(50) }, { name: 'p2.csv', text: gb(B.slice(0, 4)), lastModified: LM }, { name: 'p1.csv', text: gb([...A, 'ALEX MOORE']), lastModified: LM }]);
  const out = await p.evaluate(() => { const T = window.__tally, Al = window.__all, s = T.state.sections['period-1']; const si = s.students.indexOf('ALEX MOORE'); const u = T.unitsOf(s).find(x => /Unit 2/.test(x.name)) || T.unitsOf(s)[0];
    return { useBest: T.state.settings.useBest, si, raw: si >= 0 ? s.scores[0][si] : null, eff: si >= 0 ? Al.eff(s, 0, si) : null, points: si >= 0 ? Al.points(s, u, si) : null }; });
  H.report(JSON.stringify(out), 'ALEX keeps his best (80, 4 points at goal 60) after moving to 1st period', out.eff === 80);
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
