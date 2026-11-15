// IMP-03: IXL names the Score Grid's date range in the file name ("This-School-Year" / "Last-School-Year"). Tally drops
// that word when it keys the file and never checks it, so last year's grid, exported today, silently replaces this
// year's course data (same students, newer export date: no question). Synthetic data only.
const H = require('./h.js');
const names = ['AVA STONE', 'MILO REED', 'NIA PAGE', 'OWEN TATE', 'PIA ROSS'];
const grid = v => 'Unit,,Skill name,Permanent Skill ID,' + names.map(n => `"${n}"`).join(',') + '\n' + [1, 2, 3, 4].map(k => `"Unit 1 Ratios","Lesson 1.${k}","Skill ${k}",S${k}Q,` + names.map(() => v).join(',')).join('\n') + '\n';
const THIS = 'IXL-Score-Grid_2026-11-06_This-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
const LAST = 'IXL-Score-Grid_2026-11-13_Last-School-Year_Math-Nation-FL-B.E.S.T.-7th-Grade_Math.csv';
(async () => {
  const { b, p, errs } = await H.open();
  await H.imp(p, [{ name: THIS, text: grid(85) }]);
  const r = await H.imp(p, [{ name: LAST, text: grid('') }]);
  const out = await p.evaluate(() => { const P = window.__tally.state.pools.on; return { file: P.file, date: P.date, anyScore: P.scores.some(r => r.some(v => v != null)) }; });
  out.dialogs = r.answers; out.importCard = (r.last.lines || []).map(l => l.label + ': ' + l.text); out.fails = r.last.fails;
  H.report(JSON.stringify(out), 'a "Last-School-Year" grid is refused, or at least asked about, and this year\'s course data (85s, dated 2026-11-06) stays unless the teacher says so',
    out.file === THIS || out.dialogs.some(a => /last school year|Last-School-Year/i.test(a)));
  H.check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); H.done();
})().catch(e => { console.error(e); process.exit(2); });
