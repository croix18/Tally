// Oracle: independent grade formula vs computeGrade, withNext and neededOn, on random gradebooks.
const { open, K } = require('./_load.js');
(async () => {
  const { b, p, errs } = await open();
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const base = T.state.sections[K];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = a => a[Math.floor(rnd() * a.length)];
    const g = A.gradingFor(base.prep); const cats = g.cats.map(c => c.name);
    const oracle = (asg, i, extra) => { const C = {}; g.cats.forEach(c => C[c.name] = { e: 0, p: 0, w: c.w });
      for (const a of asg.concat(extra || [])) { const c = C[a.category]; const st = a.status[i], v = a.values[i];
        if (a.max === 0) { if (st === 'score' && v > 0) c.e += v; continue; } if (!(a.max > 0)) continue;
        if (st === 'excused' || st === 'blank' || st === 'unread') continue; c.e += st === 'missing' ? 0 : v; c.p += a.max; }
      let tw = 0, t = 0; for (const k in C) if (C[k].p > 0) { tw += C[k].w; t += C[k].w * C[k].e / C[k].p; } if (!tw) return null; const pct = t / tw * 100;
      // exact half-up: compare with rational arithmetic via 1e-9 tolerance
      return Math.floor(pct + 0.5 + 1e-9); };
    const bad = { grade: [], withNext: [], needed: [] }; let N = 0;
    for (let trial = 0; trial < 400; trial++) {
      const s = JSON.parse(JSON.stringify(base)); s.key = 'FZ' + trial; const n = 6; s.grades.students = s.grades.students.slice(0, n);
      const nA = 1 + Math.floor(rnd() * 12); const asg = [];
      for (let a = 0; a < nA; a++) { const max = pick([0, 1, 2, 5, 7, 10, 15, 17, 20, 21, 27, 40, 100]); const values = [], status = [];
        for (let i = 0; i < n; i++) { const r = rnd(); if (r < 0.1) { status.push('missing'); values.push(null); } else if (r < 0.17) { status.push('excused'); values.push(null); } else if (r < 0.2) { status.push('blank'); values.push(null); } else { status.push('score'); values.push(Math.round(rnd() * (max || 3) * 2) / 2); } }
        asg.push({ name: 'Col ' + trial + '-' + a, category: pick(cats), categoryFromFile: false, max, values, status, missing: status.filter(x => x === 'missing').length, excused: 0, unread: 0, percent: false, assignedOn: '2026-11-02', due: '2026-11-02' }); }
      s.grades.assignments = asg; s.grades.overall = null; s._map = Object.fromEntries(asg.map(a => [a.name, a.category]));
      for (let i = 0; i < n; i++) { N++;
        const r1 = A.computeGrade(s, i); const o = oracle(asg, i); if ((r1 && r1.rounded) !== o) bad.grade.push([trial, i, r1 && r1.pct, o]);
        const cat = pick(cats), max = pick([5, 10, 20, 25, 50]), pts = Math.round(rnd() * max * 2) / 2;
        const wn = A.withNext(s, i, cat, max, pts); const col = { name: 'New', category: cat, max, values: Array(n).fill(null).map((_, j) => j === i ? pts : null), status: Array(n).fill('blank').map((_, j) => j === i ? 'score' : 'blank') };
        const o2 = oracle(asg, i, [col]); if ((wn && wn.rounded) !== o2) bad.withNext.push([trial, i, cat, max, pts, wn && wn.pct, o2]);
        const target = pick([60, 70, 80, 90]); const need = A.neededOn(s, i, cat, max, target);
        let brute = null; for (let q = 0; q <= max; q += 0.5) { const c2 = { ...col, values: col.values.map((v, j) => j === i ? q : null) }; if (oracle(asg, i, [c2]) >= target) { brute = q; break; } }
        if (need !== brute) bad.needed.push([trial, i, cat, max, target, need, brute]); } }
    return { N, grade: bad.grade.length, withNext: bad.withNext.length, needed: bad.needed.length, ex: { g: bad.grade.slice(0, 3), w: bad.withNext.slice(0, 3), n: bad.needed.slice(0, 3) } }; }, K);
  console.log(JSON.stringify(r)); console.log(errs.slice(0, 2).join('|')); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
