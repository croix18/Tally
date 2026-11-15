// IMP-06: the weekly drop is not order-independent when a student moves between two classes of the same course and
// Focus names them loosely (an IXL nickname). The course export carves every class first, with last week's rosters;
// each gradebook then re-carves only its own class. A class whose new student was still claimed exactly by the old
// class's roster at that moment is never carved again in the drop. Synthetic data only.
const H = require('./h.js');
const A = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'RUBY CHAN', 'SAM VOSS', 'ALEX MOORE'];
const pool = [...A, ...B];
const POOL = d => `IXL-Score-Grid_${d}_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const grid = v => 'Unit,,Skill name,Permanent Skill ID,' + pool.map(n => `"${n}"`).join(',') + '\n' + [1, 2, 3, 4].map(k => `"Unit 1 Ratios","Lesson 1.${k}","Skill ${k}",S${k}Q,` + pool.map(() => v).join(',')).join('\n') + '\n';
const fl = n => { const [f, l] = n.split(' '); return `${l}, ${f}`; };
const ids = Object.fromEntries(pool.map((n, i) => [n, String(4000100 + i)]));
const gb = list => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + list.map(([n, disp]) => `"${disp || fl(n)}","${ids[n]}","8"`).join('\n') + '\n';
const LM = Date.parse('2026-11-13T15:00:00Z');
(async () => {
  const { b, p, errs } = await H.open();
  // week 1: ALEX MOORE is in 2nd period, Focus name "MOORE, ALEX"
  await H.imp(p, [{ name: POOL('2026-11-06'), text: grid(70) }]);
  await H.imp(p, [{ name: 'p1.csv', text: gb(A.map(n => [n])), lastModified: LM - 7 * 864e5 }], { nc: { period: 1, prep: 'on' } });
  await H.imp(p, [{ name: 'p2.csv', text: gb(B.map(n => [n])), lastModified: LM - 7 * 864e5 }], { nc: { period: 2, prep: 'on' } });
  const start = await p.evaluate(() => localStorage.getItem('tally.v1'));
  // week 2: he moved to 1st period, where Focus lists him as "MOORE, ALEXANDER" (IXL still says ALEX MOORE)
  const files = [{ name: POOL('2026-11-13'), text: grid(80) }, { name: 'p1.csv', text: gb([...A.map(n => [n]), ['ALEX MOORE', 'MOORE, ALEXANDER']]), lastModified: LM }, { name: 'p2.csv', text: gb(B.filter(n => n !== 'ALEX MOORE').map(n => [n])), lastModified: LM }];
  const res = {};
  for (const order of [[0, 1, 2], [0, 2, 1]]) {
    await p.evaluate(s => { localStorage.clear(); localStorage.setItem('tally.v1', s); }, start); await p.reload(); await p.waitForTimeout(300);
    await H.imp(p, order.map(i => files[i]));
    res[order.map(i => ['course', 'p1', 'p2'][i]).join(',')] = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s1 = T.state.sections['period-1'], s2 = T.state.sections['period-2'];
      const row = A.buildRows(s1).find(r => /MOORE/.test(r.display)) || {}; return { p1Students: s1.students.length, p1HasAlex: s1.students.includes('ALEX MOORE'), alexRow: row.status + (row.sub ? ' (' + row.sub + ')' : ''), p2HasAlex: s2.students.includes('ALEX MOORE') }; });
  }
  const v = Object.values(res);
  H.report(JSON.stringify(res), 'both orders: 1st Period carries ALEX MOORE (matched to "MOORE, ALEXANDER"), 2nd Period does not',
    v.every(x => x.p1HasAlex && /^ok/.test(x.alexRow) && !x.p2HasAlex));
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
