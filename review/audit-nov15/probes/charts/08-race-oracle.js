// CHT Race oracle (harness): random synthetic histories for five accelerated and two on-level classes (different import
// days, skipped weeks, students who joined later, goal changes, a unit whose counted skills changed), ranked by my own
// reading of NOTES "Race ranks on movement" and compared field by field with leaderboardData().
const { open, path } = require('./_setup');
const { check, done } = require(path.join(process.env.TALLY_REPO || path.resolve(__dirname, '../repo'), 'tests/lib.js'));
const N = +process.argv[2] || 300;
(async () => {
  const { b, p, errs } = await open({ classes: 5 });
  const res = await p.evaluate(N => { const T = window.__tally, A = window.__all; const bad = {}; const note = (k, ex) => { bad[k] = bad[k] || { n: 0, ex }; bad[k].n++; };
    let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    ['p4-acc', 'p5-acc'].forEach((k, j) => { const s = JSON.parse(JSON.stringify(T.state.sections[k])); s.key = 'on' + j; s.prep = 'on'; s.threshold = 60; s.period = 6 + j; s.label = (6 + j) + 'th Period · On-level'; T.state.sections[s.key] = s; T.state.order.push(s.key); });
    const DATES = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-13'];
    const secs = T.state.order.map(k => T.state.sections[k]);
    const counts = { cases: 0, measured: 0, nobase: 0, fresh: 0 };
    for (let t = 0; t < N; t++) {
      secs.forEach(s => { const keys = A.ixlList(s).map(x => x.key); const units = T.unitsOf(s); const ds = DATES.filter(() => rnd() < 0.7); if (!ds.length) ds.push(DATES[5]);
        let level = {}; keys.forEach(k => level[k] = ri(0, 5)); const thr0 = s.threshold;
        s.history = ds.map((date, di) => { const per = {}, pu = {}, ua = {}; keys.forEach(k => { if (rnd() < 0.5) level[k] += ri(0, 2); });
          units.forEach(u => { ua[u.name] = u.active.length; pu[u.name] = {}; });
          keys.forEach((k, ki) => { if (di === 0 && ki === 0 && rnd() < 0.3) return; const a = units.filter(u => u.assigned); let left = level[k]; a.forEach(u => { const v = Math.min(u.active.length, left); pu[u.name][k] = v; left -= v; }); per[k] = level[k] - left; });   // a student who joined later
          const h = { date, thr: thr0, students: keys.length, per, pu, ua };
          if (di === 0 && rnd() < 0.05) h.thr = thr0 + 5;   // goal changed since
          if (di === 0 && rnd() < 0.05) { const u = units.find(u => u.assigned); h.ua[u.name] = u.active.length + 1; }   // counted skills changed
          return h; }); });
      const L = A.leaderboardData(); counts.cases++;
      // ---- oracle ----
      ['acc', 'on'].forEach(prep => { const cl = secs.filter(s => s.prep === prep);
        const prevs = cl.filter(s => s.history.length > 1).map(s => { const cur = s.history[s.history.length - 1]; const pr = s.history.filter(h => h.date < cur.date); return pr.length ? pr[pr.length - 1].date : null; }).filter(Boolean);
        const base = prevs.length ? prevs.slice().sort()[0] : null;
        const rows = cl.map(s => { const pop = T.population(s); const cur = s.history[s.history.length - 1]; const pv = base ? s.history.filter(h => h.date <= base && h.date < cur.date) : []; const prev = pv[pv.length - 1] || null;
          const au = T.unitsOf(s).filter(u => u.assigned); let done = 0, poss = 0; au.forEach(u => pop.forEach(x => { const own = A.activeFor(s, u, x.i); poss += own.length; own.forEach(k => { const v = A.eff(s, k, x.i); if (v != null && v >= s.threshold) done++; }); }));
          let active = null, gain = null, why = null;
          if (prev) { if (prev.thr !== cur.thr) why = 'thr'; else if (au.some(u => prev.ua[u.name] !== cur.ua[u.name])) why = 'basis';
            else { let m = 0, a = 0, g = 0; pop.forEach(x => { if (prev.per[x.key] == null || cur.per[x.key] == null) return; const d = au.reduce((z, u) => z + (cur.pu[u.name][x.key] || 0) - (prev.pu[u.name][x.key] || 0), 0); m++; g += d; if (d > 0) a++; }); if (m) { active = a / m; gain = g / m; } } }
          else counts.nobase++;
          return { key: s.key, active, gain, completion: poss ? done / poss : 0, prevDate: prev ? prev.date : null, why }; });
        const kf = r => r.active == null ? [-1, 0, Math.round(r.completion * 100)] : [Math.round(r.active * 100), Math.round(r.gain * 10), Math.round(r.completion * 100)];
        const better = (x, y) => { const a = kf(x), c = kf(y); for (let i = 0; i < 3; i++) if (a[i] !== c[i]) return a[i] > c[i]; return false; };
        rows.forEach(r => { r.rank = 1 + rows.filter(x => better(x, r)).length; });
        const topC = Math.max(...rows.map(r => Math.round(r.completion * 100)));
        rows.forEach(r => { const t = L.find(x => x.key === r.key); if (!t) { note('missing-row', { key: r.key }); return; }
          if (r.active != null) counts.measured++; if (r.why) counts.fresh++;
          const eq = (a, c) => a == null ? c == null : c != null && Math.abs(a - c) < 1e-9;
          if (!eq(r.active, t.active)) note('active', { key: r.key, oracle: r.active, tally: t.active, why: r.why, thr: t.thrChanged, basis: t.basisChanged });
          if (!eq(r.gain, t.gain)) note('gain', { key: r.key, oracle: r.gain, tally: t.gain });
          if (r.prevDate !== t.prevDate) note('prevDate', { key: r.key, oracle: r.prevDate, tally: t.prevDate });
          if (!eq(r.completion, t.completion)) note('completion', { key: r.key, oracle: r.completion, tally: t.completion });
          if (r.rank !== t.rank) note('rank', { key: r.key, oracle: r.rank, tally: t.rank });
          if ((rows.length > 1 && topC > 0 && Math.round(r.completion * 100) === topC) !== t.lead) note('lead', { key: r.key });
          if ((r.why === 'thr') !== t.thrChanged || (r.why === 'basis') !== t.basisChanged) note('fresh-start-reason', { key: r.key, oracle: r.why, thr: t.thrChanged, basis: t.basisChanged });
          // a class with two or more imports that is still "first week in the race" because the league's baseline predates its first import
          const s = T.state.sections[r.key]; if (s.history.length > 1 && r.active == null && !r.why) note('INFO-measured-none-despite-history', { key: r.key, dates: s.history.map(h => h.date).join(','), base: prevs.slice().sort()[0] });
        }); });
    }
    return { bad, counts };
  }, N);
  console.log(JSON.stringify(res.counts));
  Object.entries(res.bad).forEach(([k, x]) => console.log(String(x.n).padStart(6), k, JSON.stringify(x.ex).slice(0, 300)));
  check(!Object.keys(res.bad).some(k => !/^INFO/.test(k)), 'leaderboardData agrees with the oracle');
  check(errs.length === 0, 'no page errors ' + errs.join('|').slice(0, 300));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
