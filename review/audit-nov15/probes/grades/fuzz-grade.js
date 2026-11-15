// GRD coverage harness (not a finding): an independent oracle for the Focus course grade, built from GRADES_SPEC §1 and
// NOTES "Review items 1 and 2 built (14 Nov 2026)" (0-point column = extra credit; max == null only when g.ec says so).
// Exact rational arithmetic (BigInt), half-up rounding on the exact value. Compares computeGrade, neededOn (brute force
// over every half point), withNext, classAverage and pearson on N random gradebooks.
//   TALLY_REPO=... N=5000 node probes/fuzz-grade.js
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
const N = Number(process.env.N || 5000);
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const res = await p.evaluate(N => {
    const T = window.__tally, A = window.__all;
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickA = arr => arr[Math.floor(rnd() * arr.length)];
    // ---- exact fractions ----
    const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    const F = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
    const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d), mul = (x, y) => F(x.n * y.n, x.d * y.d), div = (x, y) => F(x.n * y.d, x.d * y.n);
    const H = v => F(BigInt(Math.round(v * 2)), 2n);   // half-point numbers exactly
    const W = v => F(BigInt(Math.round(v * 1000)), 1000n);
    const roundHalfUp = x => { const q = (2n * x.n + x.d); const D = 2n * x.d; let f = q / D; if (q % D !== 0n && q < 0n) f -= 1n; return Number(f); };
    const toNum = x => Number(x.n) / Number(x.d);
    const LET = r => r == null ? '' : r >= 90 ? 'A' : r >= 80 ? 'B' : r >= 70 ? 'C' : r >= 60 ? 'D' : 'F';
    // ---- my grade, from the spec ----
    function oracle(gb, cats, map, ecNull, i, extra) {
      const acc = {}; cats.forEach(c => acc[c.name] = { E: F(0n), P: F(0n), w: c.w });
      gb.assignments.forEach(a => {
        const ec = a.max === 0 || (a.max == null && ecNull[a.name] === true);
        if (!ec && !(a.max > 0)) return;
        const cat = map[a.name]; const c = acc[cat] || (acc[cat] = { E: F(0n), P: F(0n), w: 0 });
        const st = a.status[i], v = a.values[i];
        if (ec) { if (st === 'score' && v > 0) c.E = add(c.E, H(v)); return; }
        if (st === 'score') { c.E = add(c.E, H(v)); c.P = add(c.P, H(a.max)); } else if (st === 'missing') c.P = add(c.P, H(a.max));
      });
      if (extra) { const c = acc[extra.cat] || (acc[extra.cat] = { E: F(0n), P: F(0n), w: 0 }); c.E = add(c.E, H(extra.pts)); c.P = add(c.P, H(extra.max)); }
      let tw = F(0n), tot = F(0n); const pcts = {};
      for (const k in acc) { const c = acc[k]; if (c.P.n > 0n) { const pc = mul(F(100n), div(c.E, c.P)); pcts[k] = pc; tw = add(tw, W(c.w)); tot = add(tot, mul(W(c.w), pc)); } else pcts[k] = null; }
      if (tw.n === 0n) return { pct: null, rounded: null, letter: '', pcts };
      const x = div(tot, tw); const r = roundHalfUp(x); return { x, pct: toNum(x), rounded: r, letter: LET(r), pcts };
    }
    const CATN = ['Assessments', 'Classwork', 'Participation', 'Homework'];
    const MAXES = [0, null, 1, 2, 4, 5, 10, 10, 10, 12.5, 15, 20, 20, 25, 30, 40, 50, 100];
    const out = { cases: 0, grade: 0, gradeBad: [], needed: 0, neededBad: [], withNext: 0, withNextBad: [], avgBad: [], pearsonBad: [], nearHalf: 0 };
    const g = T.gradingFor('acc');
    for (let t = 0; t < N; t++) {
      const K = ri(2, 4); const cats = CATN.slice(0, K).map(n => ({ name: n, w: rnd() < 0.7 ? ri(0, 20) * 5 : ri(0, 100) }));
      if (rnd() < 0.5) { let left = 100; cats.forEach((c, k) => { c.w = k === K - 1 ? left : ri(0, left / 5) * 5; left -= c.w; }); }
      const nS = ri(1, 12), nA = ri(1, 14);
      const students = Array.from({ length: nS }, (_, i) => 'S' + i + ', X');
      const assignments = []; const map = {}, ecNull = {};
      for (let j = 0; j < nA; j++) {
        const max = rnd() < 0.1 ? ri(1, 60) / 2 : pickA(MAXES); const name = 'A' + j;
        const values = [], status = [];
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.65 ? 'score' : r < 0.78 ? 'missing' : r < 0.88 ? 'excused' : r < 0.96 ? 'blank' : 'unread';
          status.push(st); values.push(st === 'score' ? ri(0, Math.round((max || 10) * 2 * 1.3)) / 2 : null); }
        assignments.push({ name, max, values, status, missing: status.filter(x => x === 'missing').length });
        map[name] = rnd() < 0.05 ? 'Bogus' : pickA(cats).name; if (max == null && rnd() < 0.5) ecNull[name] = rnd() < 0.6;
      }
      g.cats = cats.map(c => ({ ...c })); g.map = { ...map }; g.how = {}; g.ec = { ...ecNull }; g.codes = {};
      const sec = { key: 'fz' + t, prep: 'acc', grades: { students, assignments, overall: null } };
      out.cases++;
      const ors = [];
      for (let i = 0; i < nS; i++) {
        const r = A.computeGrade(sec, i); const o = oracle(sec.grades, cats, map, ecNull, i); ors.push(o); out.grade++;
        if (o.x && Math.abs(o.pct - Math.floor(o.pct) - 0.5) < 1e-6) out.nearHalf++;
        const catBad = Object.keys(o.pcts).some(k => { const a = r.cats[k] && r.cats[k].pct, e = o.pcts[k]; return e == null ? a != null : a == null || Math.abs(a - toNum(e)) > 1e-9; });
        if (r.rounded !== o.rounded || r.letter !== o.letter || (o.pct == null ? r.pct != null : Math.abs(r.pct - o.pct) > 1e-9) || catBad) { if (out.gradeBad.length < 6) out.gradeBad.push({ t, i, tally: [r.pct, r.rounded, r.letter], mine: [o.pct, o.rounded, o.letter], catBad, cats, asg: assignments.map(a => [a.name, a.max, map[a.name], a.status[i], a.values[i]]) }); }
      }
      // neededOn / withNext: brute force with the oracle
      if (t % 3 === 0) {
        const i = ri(0, nS - 1); const cat = rnd() < 0.9 ? pickA(cats).name : 'Nowhere'; const mx = pickA([5, 10, 20, 25, 50, 12.5, 7]);
        for (const target of [60, 70, 80, 90]) {
          const got = A.neededOn(sec, i, cat, mx, target); out.needed++;
          let want = null; for (let s2 = 0; s2 <= mx * 2; s2++) { const o = oracle(sec.grades, cats, map, ecNull, i, { cat, pts: s2 / 2, max: mx }); if (o.rounded != null && o.rounded >= target) { want = s2 / 2; break; } }
          if (got !== want && out.neededBad.length < 6) out.neededBad.push({ t, i, cat, mx, target, got, want, w: cats });
        }
        const pts = ri(0, mx * 2) / 2; const wn = A.withNext(sec, i, cat, mx, pts); const o = oracle(sec.grades, cats, map, ecNull, i, { cat, pts, max: mx }); out.withNext++;
        if ((wn ? wn.rounded : null) !== o.rounded && out.withNextBad.length < 6) out.withNextBad.push({ t, i, cat, mx, pts, got: wn && wn.rounded, want: o.rounded });
      }
      // classAverage: mean of the rounded grades of students who have one (NOTES: "Mean of the ROUNDED grades")
      { const rs = ors.map(o => o.rounded).filter(v => v != null); const want = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null; const got = A.classAverage(sec);
        if ((want == null ? got != null : Math.abs(got - want) > 1e-9) && out.avgBad.length < 4) out.avgBad.push({ t, got, want }); }
    }
    // pearson
    for (let t = 0; t < 3000; t++) {
      const n = ri(0, 30); const xs = [], ys = []; const tie = rnd() < 0.2;
      for (let k = 0; k < n; k++) { xs.push(tie ? 50 : ri(0, 200) / 2); ys.push(rnd() < 0.1 ? 77 : ri(0, 220) / 2); }
      if (rnd() < 0.1) ys.fill(77);
      const got = A.pearson(xs, ys);
      // my own: exact sums in fractions
      let want = null; if (n >= 3) { const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0); let sxy = 0, sxx = 0, syy = 0;
        for (let k = 0; k < n; k++) { sxy += n * xs[k] * ys[k]; sxx += n * xs[k] * xs[k]; syy += n * ys[k] * ys[k]; } sxy -= sx * sy; sxx -= sx * sx; syy -= sy * sy;   // integers ×4: exact in doubles here
        want = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null; }
      if ((want == null ? got != null : got == null || Math.abs(got - want) > 1e-12) && out.pearsonBad.length < 4) out.pearsonBad.push({ n, got, want, xs: xs.slice(0, 5) });
    }
    return out;
  }, N);
  console.log(JSON.stringify({ cases: res.cases, gradesCompared: res.grade, neededChecks: res.needed, withNext: res.withNext, nearHalf: res.nearHalf }));
  console.log('OBSERVED: gradeBad', res.gradeBad.length, JSON.stringify(res.gradeBad.slice(0, 2)).slice(0, 1500));
  console.log('OBSERVED: neededBad', res.neededBad.length, JSON.stringify(res.neededBad.slice(0, 4)).slice(0, 1200));
  console.log('OBSERVED: withNextBad', res.withNextBad.length, JSON.stringify(res.withNextBad.slice(0, 3)));
  console.log('OBSERVED: avgBad', res.avgBad.length, JSON.stringify(res.avgBad), 'pearsonBad', res.pearsonBad.length, JSON.stringify(res.pearsonBad));
  console.log('EXPECTED: every list empty');
  check(!res.gradeBad.length, 'computeGrade = oracle'); check(!res.neededBad.length, 'neededOn = brute force'); check(!res.withNextBad.length, 'withNext = oracle');
  check(!res.avgBad.length, 'classAverage = oracle'); check(!res.pearsonBad.length, 'pearson = mine to 1e-12'); check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
