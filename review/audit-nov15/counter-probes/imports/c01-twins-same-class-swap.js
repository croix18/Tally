// Counter probe for IMP-01: two students sharing an IXL name in the SAME pool class. The fixer stores pool keys; the carved
// class orders its students by roster, so its local "#n" keys can point at the other twin. Synthetic data only.
const H = require('/home/claude/work/audit/imports/probes/h.js');
const skills = [1, 2, 3, 4].map(n => `"Unit 1 Ratios","Lesson 1.${n}","Skill ${n}",S${n}X`);
const pool = ['AVA STONE', 'JORDAN LEE', 'MILO REED', 'JORDAN LEE', 'NIA PAGE', 'OWEN TATE'];
// pool JORDAN LEE#0 scores 60, pool JORDAN LEE#1 scores 95
const score = (n, i) => n === 'JORDAN LEE' ? (i === 1 ? 60 : 95) : 72;
const csv = 'Unit,,Skill name,Permanent Skill ID,' + pool.map(n => `"${n}"`).join(',') + '\n' + skills.map(s => s + ',' + pool.map((n, i) => score(n, i)).join(',')).join('\n') + '\n';
const POOL = 'IXL-Score-Grid_2026-11-13_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
const rows = [['STONE, AVA', 1], ['LEE, JORDAN ALEX', 2], ['LEE, JORDAN MICHAEL', 3], ['REED, MILO', 4], ['PAGE, NIA', 5], ['TATE, OWEN', 6]];
const gb = '"Student","Student ID","Unit 1 Quiz (10 pts)"\n' + rows.map(([n, i]) => `"${n}","${5000 + i}","8"`).join('\n') + '\n';
(async () => {
  const { b, p, errs } = await H.open();
  await H.imp(p, [{ name: POOL, text: csv }]);
  await H.imp(p, [{ name: 'gb.csv', text: gb }], { nc: { period: 1, prep: 'on' } });
  // ALEX is pool #1 (95s), MICHAEL is pool #0 (60s): pick each with the fixer
  const out = await p.evaluate(async () => { const T = window.__tally, A = window.__all, s = T.state.sections['period-1'];
    for (const [disp, want] of [['LEE, JORDAN ALEX', 'JORDAN LEE#1'], ['LEE, JORDAN MICHAEL', 'JORDAN LEE#0']]) {
      A.openFixer(s, disp); await new Promise(r => setTimeout(r, 100));
      const btn = document.querySelector(`#modal [data-pick="@pool:${want}"]`); if (btn) btn.click(); else document.querySelector('#mCancel') && document.querySelector('#mCancel').click();
      await new Promise(r => setTimeout(r, 100)); }
    const r = A.buildRows(s); const sc = d => { const x = r.find(y => y.display === d); return x && x.ixl != null ? s.scores[0][x.ixl] : x ? x.status : 'none'; };
    return { aliases: s.aliases, carved: s.students, alex: sc('LEE, JORDAN ALEX'), michael: sc('LEE, JORDAN MICHAEL') }; });
  H.report(JSON.stringify(out), 'ALEX (picked pool #1) reads 95, MICHAEL (picked pool #0) reads 60', out.alex === 95 && out.michael === 60);
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
