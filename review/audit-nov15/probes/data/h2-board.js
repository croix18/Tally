// Exploration harness: every student-linked string vs the Board save's text; then the Board save on a clean Tally.
const D = require('./dat-lib.js'); const path = require('path');
(async () => {
  const { b, p, errs } = await D.open(); await D.loadClass(p); await D.populate(p);
  const r = await p.evaluate(K => { const A = window.__all, st = A.state, s = st.sections[K];
    const toks = new Set(); const add = v => { if (typeof v === 'string' && v.trim().length >= 3) toks.add(v.trim().toUpperCase()); };
    const parts = v => String(v || '').split(/[\s,]+/).filter(x => x.length >= 4).forEach(add);
    s.students.forEach(n => { add(n); parts(n); }); (s.grades.students || []).forEach(n => { add(n); parts(n); }); (s.grades.ids || []).forEach(add);
    s.roster.split('\n').forEach(l => { add(l); parts(l); }); add(s.file); add(s.grades.file);
    Object.keys(s.practice || {}).forEach(add); Object.values((s.practice || {})['__names'] || {}).forEach(x => 0);
    Object.values(s.qArchive || {}).forEach(q => { add(q.file); q.gb.students.forEach(parts); q.gb.ids.forEach(add); });
    const file = A.boardFile(); const txt = JSON.stringify(file).toUpperCase();
    const hits = [...toks].filter(t => txt.includes(t) && !/^(TOK)?(UNIT|CLASS|TEST|MATH|ACCELERATED|GRADE|FOCUS|PRACTICE|SCORE|WEEK)/.test(t));
    const tokHits = (txt.match(/TOK[A-Z0-9]+/g) || []);
    return { ntok: toks.size, hits: hits.slice(0, 30), tokHits, len: txt.length, file: JSON.stringify(file) };
  }, D.K);
  console.log('tokens', r.ntok, 'board bytes', r.len); console.log('HITS', JSON.stringify(r.hits)); console.log('TOK hits', JSON.stringify(r.tokHits));
  require('fs').writeFileSync('/tmp/dat/board.json', r.file);
  // clean Tally opens it
  const q = await (await b.newContext({ timezoneId: 'America/New_York' })).newPage(); q.on('pageerror', e => errs.push('q ' + e.message)); q.on('dialog', d => d.accept());
  await q.goto('file://' + path.resolve(D.L.APP));
  const r2 = await q.evaluate(async f => { const A = window.__all; await A.loadTallyFile({ name: 'tally-board-x.json' }, JSON.parse(f)); await new Promise(r => setTimeout(r, 600));
    return { board: !!A.state.board, lb: document.body.classList.contains('lbMode'), names: A.state.settings.hideNames, finder: (() => { A.finderShow(); return document.querySelector('#finder') ? document.querySelector('#finder').innerHTML.length : -1; })() }; }, r.file);
  console.log('BOARD LOAD', JSON.stringify(r2)); console.log('errors', errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
