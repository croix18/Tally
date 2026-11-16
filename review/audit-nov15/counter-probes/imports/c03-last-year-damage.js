// Counter probe for IMP-03: what a "Last-School-Year" grid dropped after this year's actually changes in a carved class
// (points, shown scores, history). Synthetic data only.
const H = require('/home/claude/work/audit/imports/probes/h.js');
const names = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'PIA ROSS'];
const grid = v => 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + [1, 2, 3, 4].map(k => `"Unit 2 Ratios","Lesson 2.${k}","Skill ${k}",S${k}Q,` + names.map(() => v).join(',')).join('\n') + '\n';
const gb = '"Student","Student ID","Unit 2 Quiz (10 pts)"\n' + names.map((n, i) => `"${n.split(' ')[1]}, ${n.split(' ')[0]}","${6000 + i}","8"`).join('\n') + '\n';
(async () => {
  const { b, p, errs } = await H.open();
  await H.imp(p, [{ name: 'IXL-Score-Grid_2026-11-06_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv', text: grid(85) }]);
  await H.imp(p, [{ name: 'gb.csv', text: gb }], { nc: { period: 2, prep: 'on' } });
  const look = () => p.evaluate(() => { const T = window.__tally, A = window.__all, s = T.state.sections['period-2']; const u = T.unitsOf(s);
    return { date: s.date, raw: s.scores[0][0], eff: A.eff(s, 0, 0), points: u.map(x => s.students.map((n, i) => A.points(s, x, i)).join(',')).join(' / '), hist: (s.history || []).map(h => h.date).join(',') }; });
  const before = await look();
  const r = await H.imp(p, [{ name: 'IXL-Score-Grid_2026-11-13_Last-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv', text: grid('') }]);
  const after = await look();
  H.report(JSON.stringify({ before, after, asked: r.answers }), 'points unchanged (best kept); the question is only what else moves', before.points === after.points);
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
