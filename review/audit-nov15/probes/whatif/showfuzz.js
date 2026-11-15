// WIF harness: Show student driven through its own controls, against an independent grade (not a finding probe).
const S = require('./_setup.js');
const N = +process.argv[2] || 60;
(async () => { const { b, p, errs } = await S.open();
  const res = await p.evaluate(async ([K, N]) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const orig = JSON.stringify(s.grades);
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const W = {}; A.gradingFor(s.prep).cats.forEach(c => W[c.name] = c.w);
    const og = (sec, i, over, extra) => { const C = {}; const L = sec.grades.assignments.map(a => [a, A.catIn(sec, a)]); if (extra) L.push([{ name: '\u0001', max: extra.max, values: [], status: [] }, 'Assessments', extra.pts]);
      for (const [a, cat, x] of L) { let v = x != null ? x : a.values[i], st = x != null ? 'score' : a.status[i]; if (over && over.hasOwnProperty(a.name)) { v = over[a.name]; st = v == null ? 'excused' : 'score'; }
        const c = C[cat] || (C[cat] = { e: 0, p: 0 }); if (a.max === 0) { if (st === 'score' && v > 0) c.e += +v; continue; } if (!(a.max > 0)) continue; if (st === 'missing') { c.p += a.max; continue; } if (st !== 'score') continue; c.e += +v || 0; c.p += a.max; }
      let tw = 0, tot = 0; for (const k in C) if (C[k].p > 0) { tw += W[k] || 0; tot += (W[k] || 0) * C[k].e / C[k].p * 100; } return Math.floor(tot / tw + 0.5 + 1e-9); };
    const fails = []; let n = 0, planChecks = 0; const leak = []; const dbl = [];
    for (let t = 0; t < N; t++) {
      s.grades = JSON.parse(orig); const gb = s.grades; const i = Math.floor(rnd() * gb.students.length);
      gb.assignments.forEach(a => { const r = rnd(); if (r < 0.2) { a.status[i] = 'missing'; a.values[i] = null; } else if (r < 0.25) { a.status[i] = 'excused'; a.values[i] = null; } else { a.status[i] = 'score'; a.values[i] = Math.round(rnd() * a.max * 2) / 2; } });
      const name = gb.students[i]; T.openProfile(K, name); await new Promise(r => setTimeout(r, 30));
      const o = A.openSec(s); A.openShow(s, name); const el = document.getElementById('show'); if (!el) continue; n++;
      // isolation: no other student's name anywhere in the Show screen (text, attributes)
      const html = el.outerHTML.toLowerCase(); gb.students.forEach((m, j) => { if (j === i) return; const last = m.split(',')[0].trim().toLowerCase(); const first = (m.split(',')[1] || '').trim().split(/\s+/)[0].toLowerCase(); if (last.length > 3 && html.includes(last)) leak.push(m); });
      const rows = [...el.querySelectorAll('.shRow')]; const names = rows.map(r => r.dataset.k + ':' + r.dataset.n); const seen = {}; names.forEach(x => { const nm = x.split(':').slice(1).join(':'); seen[nm] = (seen[nm] || 0) + 1; }); Object.keys(seen).forEach(k => { if (seen[k] > 1 && k !== 'undefined') dbl.push(k); });
      { const sp = el.querySelector('#shPlan'); if (sp) { sp.click(); const q = A.quickestPath(s, o, i, A.findStudent(s, name).ixl); const sh = parseInt(el.querySelector('#shIfV').textContent); if (sh !== q.result.rounded) fails.push({ t, freshPlan: true, sh, res: q.result.rounded, steps: q.plan.map(x => x.kind + ':' + x.a.name + ':' + x.to) }); }
        el.querySelector('#shReset').click(); }
      const el2 = document.getElementById('show');
      // random picks
      const over = {}; let next = null;
      [...el2.querySelectorAll('.shRow')].forEach(rw => { const k = rw.dataset.k, nm = rw.dataset.n; const rg = rw.querySelector('.shPts'), on = rw.querySelector('.shOn'); if (rnd() < 0.5) return;
        if (on) { on.checked = true; on.dispatchEvent(new Event('change')); }
        const lo = +rg.min, hi = +rg.max; const v = Math.round((lo + rnd() * (hi - lo)) * 2) / 2; rg.value = v; rg.dispatchEvent(new Event('input')); const got = +rg.value;
        if (k === 'next') next = { max: hi, pts: got }; else over[nm] = got; });
      // an IXL NHI column shown twice: the later row wins in recompute; mirror that (miss rows come first in the DOM)
      const want = og(o, i, over, next); const shown = parseInt(el2.querySelector('#shIfV').textContent);
      if (shown !== want) fails.push({ t, name: i, shown, want, over, next });
      // "Show me on the sliders"
      const sp = el2.querySelector('#shPlan'); if (sp) { sp.click(); planChecks++; const q = A.quickestPath(s, o, i, A.findStudent(s, name).ixl); const shown2 = parseInt(el2.querySelector('#shIfV').textContent); const nx = el2.querySelector('#shNextOn').checked;
        const ow = og(o, i, q.over, null); if (shown2 !== q.result.rounded || (!nx && shown2 !== ow)) fails.push({ t, plan: true, shown2, res: q.result.rounded, ow, nx }); }
      A.closeShow();
    }
    s.grades = JSON.parse(orig); return { n, planChecks, fails: fails.slice(0, 5), nf: fails.length, leak: [...new Set(leak)].slice(0, 5), dbl: [...new Set(dbl)] };
  }, [S.K, N]);
  console.log(JSON.stringify(res).slice(0, 3000));
  await b.close(); })().catch(e => { console.error(e); process.exit(2); });
