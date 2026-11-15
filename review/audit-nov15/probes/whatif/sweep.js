// WIF harness: render the student page, the Students list and Show student for randomized and edge-case students and
// look for NaN / undefined / Infinity / "null" reaching the screen, and page errors (not a finding probe).
const S = require('./_setup.js'); const path = require('path');
(async () => { const { b, p, errs } = await S.open();
  if (process.env.Q2) { await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await S.pick(p); await p.waitForTimeout(600);
    await p.evaluate(K => { const A = window.__all, s = window.__tally.state.sections[K]; A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); window.__tally.save(); }, S.K); }
  const r = await p.evaluate(async K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const orig = JSON.stringify(s.grades);
    let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const bad = []; const scan = (where, txt) => { const m = /NaN|undefined|Infinity|null%|\bnull\b|\[object/.exec(txt); if (m) bad.push(where + ': …' + txt.slice(Math.max(0, m.index - 60), m.index + 30).replace(/\s+/g, ' ')); };
    const modes = ['random', 'allExcused', 'noAssess', 'noIxlCols', 'allMissing', 'perfect', 'zeroes'];
    for (let t = 0; t < 70; t++) { s.grades = JSON.parse(orig); const gb = s.grades; const o0 = A.openSec(s); const i = Math.floor(rnd() * gb.students.length); const mode = modes[t % modes.length];
      if (mode === 'noIxlCols') gb.assignments = gb.assignments.filter(a => !/ixl/i.test(a.name));
      gb.assignments.forEach(a => { const isA = A.catIn(s, a) === 'Assessments';
        if (mode === 'allExcused') { a.status[i] = 'excused'; a.values[i] = null; }
        else if (mode === 'noAssess' && isA) { a.status[i] = 'excused'; a.values[i] = null; }
        else if (mode === 'allMissing') { a.status[i] = 'missing'; a.values[i] = null; }
        else if (mode === 'perfect') { a.status[i] = 'score'; a.values[i] = a.max; }
        else if (mode === 'zeroes') { a.status[i] = 'score'; a.values[i] = 0; }
        else if (mode === 'random') { const x = rnd(); if (x < 0.2) { a.status[i] = 'missing'; a.values[i] = null; } else { a.status[i] = 'score'; a.values[i] = Math.round(rnd() * a.max * 2) / 2; } } });
      const name = gb.students[i];
      T.openProfile(K, name); await new Promise(r => setTimeout(r, 20)); scan(mode + ' page', document.querySelector('#gridwrap').innerText + document.querySelector('#bar').innerText);
      document.querySelectorAll('#gridwrap [title], #gridwrap [aria-label]').forEach(e => scan(mode + ' attr', (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')));
      const sh = document.querySelector('#pShow'); if (sh) { sh.click(); const el = document.getElementById('show'); if (el) { scan(mode + ' show', el.innerText); const on = el.querySelector('#shNextOn'); on.checked = true; on.dispatchEvent(new Event('change')); const mx = el.querySelector('#shNextMax'); mx.value = ''; mx.dispatchEvent(new Event('input')); scan(mode + ' show next', el.innerText); const pl = el.querySelector('#shPlan'); if (pl) pl.click(); scan(mode + ' show plan', el.innerText); A.closeShow(); } }
      const wm = document.querySelector('#pWhat .wiMax'); if (wm) { wm.value = '0'; wm.dispatchEvent(new Event('input')); scan(mode + ' slider 0', document.querySelector('#pWhat').innerText); wm.value = '500'; wm.dispatchEvent(new Event('input')); scan(mode + ' slider 500', document.querySelector('#pWhat').innerText); }
    }
    T.state.settings && (window.__tally.view = undefined); s.grades = JSON.parse(orig);
    return { bad: [...new Set(bad)].slice(0, 12), n: bad.length };
  }, S.K);
  await p.evaluate(() => { const T = window.__tally; T.openProfile && 0; });
  await p.click('#btnStudents').catch(() => {}); await p.waitForTimeout(300);
  const list = await p.evaluate(() => document.querySelector('#gridwrap').innerText);
  const m = /NaN|undefined|Infinity/.exec(list);
  console.log(JSON.stringify(r, null, 1), 'list:', m ? list.slice(m.index - 60, m.index + 20) : 'clean', 'errors:', errs);
  await b.close(); })().catch(e => { console.error(e); process.exit(2); });
