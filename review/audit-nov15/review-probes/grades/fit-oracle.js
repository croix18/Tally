// Counter-review (15 Nov 2026): fitCategories against a brute-force oracle (every category map of a small class).
//   TALLY_REPO=<clone> N=600 OUT=/tmp/x.json node review-probes/fit-oracle.js
// Checks per case: an exact fit reproduces every Focus grade (own oracle); when an exact map exists that keeps the
// teacher's own ('user') columns, the fit finds one (completeness, a rate); "determined" (proved) is never claimed for a
// column some other exact map puts elsewhere (global uniqueness, a rate) nor when a single alternative also fits (the
// definition); a 'user' column never moves. Writes what applyCategories did per case to OUT, to diff two builds.
const path = require('path');
const REPO = process.env.TALLY_REPO;
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
const N = Number(process.env.N || 600);
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const res = await p.evaluate(N => {
    const T = window.__tally, A = window.__all;
    let seed = 99; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickA = arr => arr[Math.floor(rnd() * arr.length)];
    const CATS = ['Assessments', 'Classwork', 'Participation'];
    // the oracle: Focus's rule (NHI 0 over full, blank/excused out, 0-point column = extra credit, empty categories re-weight)
    const grade = (gb, map, w, i) => { const E = [0, 0, 0], P = [0, 0, 0]; gb.assignments.forEach(a => { const st = a.status[i], v = a.values[i], c = CATS.indexOf(map[a.name]);
      if (a.max === 0) { if (st === 'score' && v > 0) E[c] += v; return; } if (st === 'score') { E[c] += v; P[c] += a.max; } else if (st === 'missing') P[c] += a.max; });
      let tw = 0, tot = 0; for (let k = 0; k < 3; k++) if (P[k] > 0) { tw += w[k]; tot += w[k] * E[k] / P[k] * 100; } return tw ? { v: Math.round(tot / tw + 1e-9), tie: Math.abs(tot / tw - Math.floor(tot / tw) - 0.5) < 1e-6 } : null; };
    const fits = (gb, map, w) => gb.overall.every((o, i) => { if (o == null) return true; const r = grade(gb, map, w, i); return r && r.v === o; });
    const g = T.gradingFor('acc'); const out = { cases: 0, exact: 0, exactWrong: [], oracleExact: 0, missed: [], detFalseGlobal: 0, detCols: 0, detFalseLocal: [], userMoved: [], ties: 0, applied: [] };
    for (let t = 0; t < N; t++) {
      const nS = ri(8, 26), nA = ri(3, 7); const W = pickA([[70, 25, 5], [60, 30, 10], [50, 40, 10]]);
      const students = Array.from({ length: nS }, (_, i) => 'S' + i + ', X'); const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pickA([5, 10, 10, 20, 25, 50, 0]); const values = [], status = [];
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.8 ? 'score' : r < 0.9 ? 'missing' : r < 0.95 ? 'excused' : 'blank'; status.push(st); values.push(st === 'score' ? ri(0, (max || 6) * 2) / 2 : null); }
        assignments.push({ name: 'A' + j, max, values, status, missing: status.filter(x => x === 'missing').length }); truth['A' + j] = pickA(CATS); }
      const gb = { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' };
      let tie = false; gb.overall = students.map((_, i) => { const r = grade(gb, truth, W, i); if (r && r.tie) tie = true; return r ? r.v : null; });
      if (rnd() < 0.15) { const i = ri(0, nS - 1); if (gb.overall[i] != null) gb.overall[i] += pickA([-1, 1]); }   // a grade Focus has for its own reason
      if (tie) { out.ties++; continue; }
      g.cats = CATS.map((c, k) => ({ name: c, w: W[k] })); g.map = {}; g.how = {}; g.ec = {}; g.codes = {};
      assignments.forEach(a => { const h = pickA(['guess', 'guess', 'guess', 'fit', 'ok', 'user']); g.how[a.name] = h; g.map[a.name] = rnd() < 0.6 ? truth[a.name] : pickA(CATS); });
      const sec = { key: 'or' + t, prep: 'acc', grades: gb }; out.cases++;
      const user = assignments.filter(a => g.how[a.name] === 'user');
      // every map that keeps the user columns
      const free = assignments.filter(a => g.how[a.name] !== 'user'); const exactMaps = [];
      const rec = (k, m) => { if (k === free.length) { if (fits(gb, m, W)) exactMaps.push({ ...m }); return; } for (const c of CATS) { m[free[k].name] = c; rec(k + 1, m); } };
      const base = {}; user.forEach(a => base[a.name] = g.map[a.name]); rec(0, base);
      const before = JSON.stringify({ map: g.map, how: g.how });
      const fit = A.fitCategories(sec); if (!fit) continue;
      if (exactMaps.length) out.oracleExact++;
      if (fit.exact) { out.exact++; if (!fits(gb, fit.map, W) && out.exactWrong.length < 4) out.exactWrong.push(t);
        assignments.forEach(a => { if (!fit.determined[a.name]) return; out.detCols++;
          if (exactMaps.some(m => m[a.name] !== fit.map[a.name])) out.detFalseGlobal++;
          if (CATS.some(c => c !== fit.map[a.name] && fits(gb, { ...fit.map, [a.name]: c }, W)) && out.detFalseLocal.length < 4) out.detFalseLocal.push({ t, a: a.name }); }); }
      else if (exactMaps.length && out.missed.length < 400) out.missed.push(t);
      if (user.some(a => fit.map[a.name] !== g.map[a.name]) && out.userMoved.length < 4) out.userMoved.push(t);
      const r = A.applyCategories(sec); const after = { map: g.map, how: g.how }; const was = JSON.parse(before);
      out.applied.push([t, assignments.map(a => `${was.how[a.name]}:${was.map[a.name]}>${after.how[a.name]}:${after.map[a.name]}`).join(' ')]);
      if (user.some(a => after.map[a.name] !== was.map[a.name] || after.how[a.name] !== 'user') && out.userMoved.length < 4) out.userMoved.push('apply' + t);
    }
    return out;
  }, N);
  const applied = res.applied; delete res.applied; res.missedN = res.missed.length; res.missed = res.missed.slice(0, 10);
  if (process.env.OUT) require('fs').writeFileSync(process.env.OUT, JSON.stringify({ res, applied }));
  console.log(JSON.stringify(res));
  check(!res.exactWrong.length, 'an exact fit reproduces every Focus grade');
  check(!res.detFalseLocal.length, 'determined: no single alternative also fits');
  check(!res.userMoved.length, 'a column set by hand never moves');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
