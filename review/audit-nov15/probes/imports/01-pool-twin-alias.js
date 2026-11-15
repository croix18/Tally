// IMP-01: two students with the same IXL name in one course export, in two different classes. The roster fixer stores the
// pool class's choice under the POOL key ("JORDAN LEE#1"); the carved class then reads its own students with
// section-local keys ("JORDAN LEE#0"), so the alias never resolves and the student drops out of the class.
// Synthetic data only.
const H = require('./h.js');
const skills = [1, 2, 3, 4, 5, 6].map(n => `"Unit 1 Ratios","Lesson 1.${n}","Skill ${n}",S${n}X`);
const A = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'NIA PAGE', 'OWEN TATE'], B = ['PIA ROSS', 'QUINN HALE', 'JORDAN LEE', 'RUBY CHAN', 'SAM VOSS'];
const pool = [...A, ...B];
// class A's Jordan has 60 on every skill; class B's Jordan has 95 on every skill (so whose row is whose is visible)
const score = (n, i, k) => n === 'JORDAN LEE' ? (i < 5 ? 60 : 95) : 70 + k;
const csv = 'Unit,,Skill name,Permanent Skill ID,' + pool.map(n => `"${n}"`).join(',') + '\n' + skills.map((s, k) => s + ',' + pool.map((n, i) => score(n, i, k)).join(',')).join('\n') + '\n';
const POOL = 'IXL-Score-Grid_2026-11-13_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
const last = n => n.split(' ')[1], first = n => n.split(' ')[0];
const gb = (names, mid, id0) => '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + names.map((n, i) => `"${last(n)}, ${first(n)}${n === 'JORDAN LEE' ? ' ' + mid : ''}","${id0 + i}","8"`).join('\n') + '\n';
(async () => {
  const { b, p, errs } = await H.open();
  await H.imp(p, [{ name: POOL, text: csv }]);
  await H.imp(p, [{ name: 'gradebook_p1.csv', text: gb(A, 'ALEX', 2000100) }], { nc: { period: 1, prep: 'on' } });
  await H.imp(p, [{ name: 'gradebook_p2.csv', text: gb(B, 'MICHAEL', 2000200) }], { nc: { period: 2, prep: 'on' } });
  // The two "Lee, Jordan …" rows are ambiguous (two IXL JORDAN LEEs): resolve each with the roster fixer, choosing the right pool entry
  const res = await p.evaluate(async () => { const T = window.__tally, A = window.__all, st = T.state;
    const out = {};
    for (const [k, disp, want] of [['period-1', 'LEE, JORDAN ALEX', 'JORDAN LEE#0'], ['period-2', 'LEE, JORDAN MICHAEL', 'JORDAN LEE#1']]) {
      const s = st.sections[k]; const before = (A.buildRows(s).find(r => r.display === disp) || {}).status;
      A.openFixer(s, disp); await new Promise(r => setTimeout(r, 100));
      const btn = document.querySelector(`#modal [data-pick="@pool:${want}"]`); const chips = [...document.querySelectorAll('#modal [data-pick]')].map(x => x.dataset.pick);
      if (btn) btn.click(); await new Promise(r => setTimeout(r, 100));
      const row = A.buildRows(s).find(r => r.display === disp) || {}; const pop = T.population(s).map(x => x.name);
      const si = s.students.indexOf('JORDAN LEE'); const u = T.unitsOf(s)[0];
      out[k] = { before, chips: chips.length, clicked: !!btn, alias: s.aliases[disp], status: row.status, sub: row.sub, inPopulation: pop.includes('JORDAN LEE'), popN: pop.length, carved: s.students.join('|'), jordanScore: si >= 0 ? s.scores[0][si] : null, points: si >= 0 ? A.points(s, u, si) : null };
    }
    return out; });
  await p.reload(); await p.waitForTimeout(400); res.afterReload = await p.evaluate(() => { const T = window.__tally, A = window.__all; const s = T.state.sections['period-2']; return { status: (A.buildRows(s).find(r => r.display === 'LEE, JORDAN MICHAEL') || {}).status, popN: T.population(s).length }; });
  const p2 = res['period-2'], p1 = res['period-1'];
  H.report(JSON.stringify(res), 'after the fixer pick, each class counts its own JORDAN LEE (status ok, in the population: 5 students each; period 2 carries the 95s)',
    p1.status === 'ok' && p2.status === 'ok' && res.afterReload.status === 'ok' && p1.inPopulation && p2.inPopulation && p2.jordanScore === 95);
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
