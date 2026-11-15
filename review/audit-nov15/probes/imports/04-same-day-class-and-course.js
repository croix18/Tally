// IMP-04: order dependence. Exploration turned probe: a class made from its OWN IXL export (section-keyed) plus the course export, week 2 dropped in both orders.
const H = require('./h.js');
const A = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'PIA ROSS'], X = ['ZED ONE', 'ZED TWO', 'ZED THREE'];
const grid = (names, v, extra) => 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + [1, 2, 3, 4].map(k => `"Unit 1 Ratios","Lesson 1.${k}","Skill ${k}",S${k}Q,` + names.map((n, i) => v + i + (extra || 0)).join(',')).join('\n') + '\n';
const SEC = d => `IXL-Score-Grid_${d}_This-School-Year_1205050-7T1A-M_J-GR7_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const POOL = d => `IXL-Score-Grid_${d}_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv`;
const gb = '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + A.map((n, i) => `"${n.split(' ')[1]}, ${n.split(' ')[0]}","${3000 + i}","8"`).join('\n') + '\n';
(async () => {
  const { b, p, errs } = await H.open();
  const mode = process.argv[2] || 'same';
  await H.imp(p, [{ name: SEC('2026-11-06'), text: grid(A, 60) }]);
  await H.imp(p, [{ name: 'gb.csv', text: gb }]);
  await H.imp(p, [{ name: POOL('2026-11-06'), text: grid([...A, ...X], 60) }]);
  const start = await p.evaluate(() => localStorage.getItem('tally.v1'));
  const d2s = mode === 'same' ? '2026-11-13' : '2026-11-14', d2p = '2026-11-13';
  const files = [{ name: SEC(d2s), text: grid(A, 70) }, { name: POOL(d2p), text: grid([...A, ...X], 70, mode === 'same' ? 0 : -5) }];
  const res = [];
  for (const order of [[0, 1], [1, 0], 'both']) {
    await p.evaluate(s => { localStorage.clear(); localStorage.setItem('tally.v1', s); }, start); await p.reload(); await p.waitForTimeout(300);
    const r = await H.imp(p, order === 'both' ? files : order.map(i => files[i]));
    const c = await H.canon(p); res.push([String(order), JSON.stringify(c.secs), r.answers.join(';'), (r.last.lines || []).map(l => l.label + ':' + l.text).join(' / ').slice(0, 300)]);
  }
  const obs = res.map(x => x[0] + ' => pool=' + JSON.parse(x[1])['1205050-7T1A'].pool + ' | card: ' + x[3]).join('\n   ');
  H.report(obs, 'the same class state whichever order the two files are dropped in, and no card line saying "no class uses it yet: import a Focus gradebook" while 1st Period has its gradebook',
    res[0][1] === res[1][1] && res.every(x => !/no class uses it yet/.test(x[3])));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
