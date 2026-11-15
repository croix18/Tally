// SEA oracle (exploration, not a finding): independent standing, constraint checker, brute force on small rooms.
const { open, check, done, roomJS } = require('./h.js');
(async () => {
  const { b, p, errs, K } = await open();
  // ---- A. standing: my own percentile ranks and blend vs seatStudents, every basis, with synthetic FAST pcts ----
  const A = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K];
    const rows = A.buildRows(s).filter(r => r.status !== 'ixlOnly'); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    rows.forEach((r, k) => { const i = A.seatInfoOf(s, r.display); i.pct = k % 5 === 4 ? null : Math.floor(rnd() * 100); i.level = i.pct == null ? null : 1 + Math.min(4, Math.floor(i.pct / 20)); });
    const pr = (xs, v) => { const ys = xs.filter(x => x != null); if (v == null || ys.length < 2) return null; let lo = 0, eq = 0; for (const y of ys) { if (y < v) lo++; else if (y === v) eq++; } return Math.round(100 * (lo + eq / 2) / ys.length); };
    const out = { n: rows.length, bad: [], ixlDiff: [] }; const gb = s.grades;
    const gradeOf = r => { const gi = gb.students.indexOf(r.display); if (gi < 0) return null; const g = A.computeGrade(s, gi); return g ? g.pct : null; };
    const ixlAll = r => { if (r.ixl == null) return null; let d = 0, t = 0; A.unitsOf(s).filter(u => u.assigned && u.total).forEach(u => { d += A.points(s, u, r.ixl); t += A.totalFor(s, u, r.ixl); }); return t ? 100 * d / t : null; };
    const tests = new Map(A.ixlVsTests(s).map(x => [x.name, x.tests]));
    for (const basis of ['blend', 'fast', 'grade', 'tests', 'ixl']) { T.state.seatBasis = basis; const stu = A.seatStudents(s);
      const G = rows.map(gradeOf), I = rows.map(ixlAll), Ts = rows.map(r => tests.has(r.display) ? tests.get(r.display) : null);
      rows.forEach((r, k) => { const info = s.seatInfo[r.display]; const parts = basis === 'fast' ? [info.pct] : basis === 'grade' ? [pr(G, G[k])] : basis === 'tests' ? [pr(Ts, Ts[k])] : basis === 'ixl' ? [pr(I, I[k])] : [info.pct, pr(G, G[k]), pr(I, I[k])];
        const h = parts.filter(v => v != null); const want = h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : null;
        const got = stu.find(x => x.id === r.display); if (!got || got.standing !== want) out.bad.push([basis, k, got && got.standing, want]);
        if (basis === 'blend') { const sf = A.ixlFor(s, r.ixl); const scr = sf && sf.pct; if (got.ixlPct != null && scr != null && Math.round(got.ixlPct) !== Math.round(scr)) out.ixlDiff.push([k, Math.round(got.ixlPct), Math.round(scr)]); }
      }); }
    T.state.seatBasis = 'blend'; return out; }, K);
  console.log('A standing:', JSON.stringify(A).slice(0, 600));
  check(A.bad.length === 0, 'standing matches the oracle on every basis');
  // ---- B. constraint checker + brute force on 6-8 desk rooms ----
  const B = await p.evaluate(async ({ K, roomSrc }) => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const mk = eval(roomSrc);
    let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const res = { cases: 0, solverMissed: [], hardMismatch: 0, explainMismatch: 0, softMismatch: 0, infeasible: 0 };
    const C = (d) => ({ x: d.x + 35, y: d.y + 35 });
    for (let c = 0; c < 60; c++) { const m = 6 + (c % 3), n = m - (c % 2); mk(m, c % 2 ? 4 : 3, c % 4 === 0 ? 70 : 94, c % 3 === 0 ? 80 : 110); const G = A.geometry();
      const stu = []; for (let i = 0; i < n; i++) stu.push({ id: 'S' + String.fromCharCode(65 + ((i * 5) % n)) + i, display: 'S' + i, first: 'A', last: 'B', behavior: ['low', 'medium', 'high'][Math.floor(rnd() * 3)], front: rnd() < 0.2, nearTeacher: rnd() < 0.15, standing: rnd() < 0.2 ? null : Math.floor(rnd() * 100), level: null, apart: [], together: [], plan: '', notes: '' });
      const k = 1 + Math.floor(rnd() * (n + 2)); for (let e = 0; e < k; e++) { const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); if (i === j || stu[i].apart.includes(stu[j].id)) continue; stu[i].apart.push(stu[j].id); stu[j].apart.push(stu[i].id); }
      // my relation from centers, my hard counter
      const ds = T.state.room.desks; const rel = (a, b) => { const p = C(ds[a]), q = C(ds[b]); const d = Math.hypot(p.x - q.x, p.y - q.y); return d <= 88 ? 2 : d <= 154 ? 1 : 0; };
      const hardOf = asg => { let h = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if ((stu[i].apart.includes(stu[j].id) || stu[j].apart.includes(stu[i].id)) && rel(asg[i], asg[j]) > 0) h++; return h; };
      // brute force: min hard over all injective assignments
      let best = 1e9; const used = new Array(m).fill(false), asg = []; (function rec(i) { if (best === 0) return; if (i === n) { best = Math.min(best, hardOf(asg)); return; } for (let d = 0; d < m; d++) if (!used[d]) { used[d] = true; asg[i] = d; rec(i + 1); used[d] = false; } })(0);
      if (best > 0) res.infeasible++;
      const M = A.buildModel(s, stu, G, false); const out = await A.runSolver(M, G, { restarts: 5, budgetMs: 400 }); out.sort((a, b2) => a.total - b2.total); const top = out[0].asg;
      const seats = A.seatsFromAsg(top, stu, G); const sc = A.scoreSeats(s, seats, stu, G, M); const mine = hardOf(top);
      if (sc.hard !== mine) res.hardMismatch++;
      const ex = A.explainSeats(seats, stu, G).filter(x => x.t === 'hard' && /keep-apart/.test(x.msg)).length; if (ex !== mine) res.explainMismatch++;
      if (Math.abs(sc.soft + 0 - A.totalScore(M, G, top).soft) > 1e-6) res.softMismatch++;
      if (mine > best) res.solverMissed.push({ c, n, m, best, got: mine });
      res.cases++; }
    return res; }, { K, roomSrc: require('./h.js').roomJS });
  console.log('B constraints:', JSON.stringify(B));
  check(B.solverMissed.length === 0 && B.hardMismatch === 0 && B.explainMismatch === 0, 'solver reaches the brute-force minimum of broken keep-aparts; counts agree');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
