// Heavy reports in the real print window: is anything clipped, does each student start on a front, is every owed item printed?
const H = require('./h.js');
const MODE = process.argv[2] || 'heavy';
(async () => { const { b, ctx, p, errs, K } = await H.open();
  const exp = await p.evaluate(({ K, MODE }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades;
    if (MODE === 'heavy' || MODE === 'steps' || MODE === 'start') { // 40 extra assignments, long titles, all missing for student 0 and 2; scores all low
      for (let n = 0; n < 40; n++) { const name = `Homework ${n + 1}: ${'a very long assignment title that keeps going and going '.repeat(MODE === 'heavy' ? 2 : 0)}`.trim(); gb.assignments.push({ name, max: 10, due: '11/0' + (1 + n % 9) + '/2026', values: gb.students.map((_, i) => i % 2 ? 9 : 0), status: gb.students.map((_, i) => i % 2 ? 'score' : 'missing'), missing: Math.ceil(gb.students.length / 2) }); }
      s.scores.forEach(r => r.forEach((v, j) => { if (j % 2 === 0) r[j] = j % 4 ? (MODE === 'start' ? 60 : 50) : null; }));
    }
    if (MODE === 'many') { const k3 = s.skills.findIndex(sk => /^Unit 3\b/.test(sk.unit)); for (let n = 0; n < 150; n++) { s.skills.push({ ...s.skills[k3], id: '', name: 'Extra practice skill number ' + (n + 1) + ' with a longer name' }); s.scores.push(s.students.map((_, j) => j % 3 ? 60 : null)); } T.save(); }
    if (MODE === 'long') gb.students[0] = 'WOLFESCHLEGELSTEINHAUSENBERGERDORFF-MONTGOMERY-ALEXANDRIA, MARIA-JOSEFINA ANASTASIA GUADALUPE BARTHOLOMEW';
    T.save(); const rows = A.gbRows(s); const og = A.openSec(s);
    return gb.students.map((nm, i) => { const ix = rows[i] && rows[i].ixl; const units = T.unitsOf(s).filter(u => u.assigned && u.total && !A.unitClosed(og, u)); const sk = ix == null ? 0 : units.reduce((n, u) => n + A.activeFor(s, u, ix).filter(k => { const v = A.eff(s, k, ix); return v == null || v < s.threshold; }).length, 0);
      const miss = A.owedWork(s, og, i, ix).owed.length; return { nm, sk, miss }; }); }, { K, MODE });
  const [w] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(K => { const T = window.__tally; const s = T.state.sections[K]; T.printStudentReports(s, s.grades.students.map((_, i) => i), 'All'); }, K)]);
  await w.waitForLoadState(); await w.waitForFunction(() => document.body.getAttribute('data-paged') === '1', null, { timeout: 60000 });
  const lay = await w.evaluate(() => { const secs = [...document.querySelectorAll('body>section')];
    return { fallback: !document.body.classList.contains('paged'), secs: secs.map(s => { const pages = [...s.querySelectorAll('.page')];
      const clipped = pages.map((pg, k) => { const r = pg.getBoundingClientRect(); const pad = parseFloat(getComputedStyle(pg).paddingTop) || 0; const bottom = r.top + pad + pg.clientHeight - pad - (parseFloat(getComputedStyle(pg).paddingBottom) || 0); return { k, over: pg.scrollHeight > pg.clientHeight + 1, cut: [...pg.querySelectorAll('tr, .sk, .tot, p, .sr, h1')].filter(e => e.getBoundingClientRect().bottom > r.top + pg.clientHeight - (parseFloat(getComputedStyle(pg).paddingBottom) || 0) + 1).length }; }).filter(x => x.over || x.cut);
      return { h1: (s.querySelector('h1') || {}).textContent, teach: s.classList.contains('teach'), pages: pages.length, blank: s.querySelectorAll('.page.blank').length, sk: s.querySelectorAll('.sk').length, start: s.querySelectorAll('.start').length, cont: s.querySelectorAll('.cont').length, heads: [...s.querySelectorAll('.page')].map(pg => [...pg.querySelectorAll('.ph')].map(x => x.textContent.slice(0, 18)).join('/')).join(' || '), miss: s.querySelectorAll('.missT tbody tr:not(.done)').length, clipped, h1W: (() => { const h = s.querySelector('h1'); return h ? h.scrollWidth > h.clientWidth + 1 : false; })() }; }) }; });
  const pdf = await w.pdf({ format: 'Letter', preferCSSPageSize: true }); const pdfN = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; const boxes = lay.secs.reduce((n, s) => n + s.pages, 0);
  let at = 0; const bad = []; if (pdfN !== boxes) bad.push(`PDF has ${pdfN} pages for ${boxes} laid-out pages`);
  lay.secs.forEach((s, k) => { if (at % 2) bad.push(`section ${k} (${s.h1}) starts on a back (page ${at + 1})`); at += s.pages; if (s.clipped.length) bad.push(`section ${k} (${s.h1}) has clipped content on page(s) ${s.clipped.map(c => c.k + 1 + ':' + c.cut).join(',')}`); if (s.h1W) bad.push(`section ${k} name overflows its line`); if (s.start > 1) bad.push(`section ${k} prints Start here ${s.start} times`);
    const e = exp[k]; if (e && !s.teach) { if (e.nm !== s.h1) bad.push(`section ${k} is ${s.h1}, expected ${e.nm}`); if (e.sk !== s.sk) bad.push(`${e.nm}: ${s.sk} skills printed, ${e.sk} owed`); if (e.miss !== s.miss) bad.push(`${e.nm}: ${s.miss} missing rows printed, ${e.miss} owed`); } });
  if (process.env.V) console.log(lay.secs.slice(0, 3).map(s => s.start + ' ' + s.cont + ' ' + s.heads).join('\n')); console.log('MODE', MODE, 'fallback', lay.fallback, 'sections', lay.secs.length, 'pages', lay.secs.map(s => s.pages).join(','));
  console.log('OBSERVED:', bad.length ? bad.slice(0, 8).join(' | ') : 'every section starts on a front, nothing clipped, every owed item printed');
  console.log('EXPECTED: every section starts on a front, nothing clipped, every owed item printed');
  console.log('errs', errs.slice(0, 2)); await b.close(); process.exitCode = bad.length ? 1 : 0; })().catch(e => { console.error(e); process.exit(2); });
