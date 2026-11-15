// WIF fuzz harness (not a finding probe): independent oracle for computeGrade, the what-if table, neededOn /
// nextAssessment, quickestPath (brute force) and retakeStatus, over randomized students of the scrubbed class.
// Run: TALLY_REPO=... node probes/fuzz.js [trials] [seed]
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/whatif/repo';
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
const N = +process.argv[2] || 300, SEED = +process.argv[3] || 1;
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  if (process.env.Q2) { await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600);
    await p.evaluate(K => { const A = window.__all, s = window.__tally.state.sections[K]; A.closeQuarter(1, { [s.prep]: ['Unit 1 Equations and Inequalities', 'Unit 2 Rational and Irrational Numbers'] }); window.__tally.save(); }, K); }
  const res = await p.evaluate(([K, N, SEED]) => {
    const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const orig = JSON.stringify(s.grades);
    let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const isIxl = a => /\bixl\b/i.test(a.name);
    // ---------- oracle: the Focus grade, from GRADES_SPEC §1 ----------
    const W = {}; A.gradingFor(s.prep).cats.forEach(c => W[c.name] = c.w);
    function og(sec, i, over, extra) {
      const C = {}; const add = (cat) => C[cat] || (C[cat] = { e: 0, p: 0 });
      const list = sec.grades.assignments.map(a => ({ a, cat: A.catIn(sec, a) })); if (extra) list.push({ a: { name: '\u0001x', max: extra.max, values: [], status: [] }, cat: 'Assessments', x: extra.pts });
      for (const { a, cat, x } of list) {
        let v = x != null ? x : a.values[i], st = x != null ? 'score' : (a.status ? a.status[i] : (v == null ? 'blank' : 'score'));
        if (over && Object.prototype.hasOwnProperty.call(over, a.name)) { v = over[a.name]; st = v == null ? 'excused' : 'score'; }
        if (a.max === 0) { if (st === 'score' && +v > 0) add(cat).e += +v; continue; }
        if (!(a.max > 0)) continue;
        if (st === 'missing') { add(cat).p += a.max; continue; }
        if (st !== 'score') continue;
        const c = add(cat); c.e += +v || 0; c.p += a.max;
      }
      let tw = 0, tot = 0; for (const k in C) if (C[k].p > 0) { const w = W[k] || 0; tw += w; tot += w * C[k].e / C[k].p * 100; }
      if (!tw) return null; const pct = tot / tw; return { pct, r: Math.floor(pct + 0.5 + 1e-9) };
    }
    const letter = r => r >= 90 ? 'A' : r >= 80 ? 'B' : r >= 70 ? 'C' : r >= 60 ? 'D' : 'F';
    const t = s.threshold;
    // own IXL facts
    const unitOfCol = a => { const u = A.gbUnitFor(s, a); return u ? T.unitsOf(s).find(x => x.name === u.name) : null; };
    const ptsOwn = (u, si) => A.activeFor(s, u, si).filter(k => { const v = A.eff(s, k, si); return v != null && v >= t; }).length;
    // ---------- randomize one student's open gradebook row ----------
    function randomize(i) {
      s.grades = JSON.parse(orig); const gb = s.grades;
      const mode = rnd();
      gb.assignments.forEach(a => {
        const r = rnd();
        if (isIxl(a)) { if (r < 0.2) { a.status[i] = 'missing'; a.values[i] = null; } else { a.status[i] = 'score'; a.values[i] = mode > 0.85 ? a.max - ri(0, 1) : ri(0, a.max); } return; }
        const pm = mode < 0.3 ? 0.35 : 0.12;   // some students miss a lot
        if (r < pm) { a.status[i] = 'missing'; a.values[i] = null; }
        else if (r < pm + 0.06) { a.status[i] = 'excused'; a.values[i] = null; }
        else { a.status[i] = 'score'; const lo = mode < 0.3 ? 0 : mode < 0.6 ? 0.4 : mode < 0.85 ? 0.7 : 0.93; a.values[i] = Math.round((lo + rnd() * (1 - lo)) * a.max * 2) / 2; if (rnd() < 0.04) a.values[i] = a.max + ri(1, 3); }
      });
      const blank = () => gb.students.map(() => null);
      if (rnd() < 0.15) { const v = blank(), st = gb.students.map(() => 'blank'); v[i] = ri(1, 5); st[i] = 'score'; gb.assignments.push({ name: 'Bonus Puzzle ' + ri(1, 9), max: 0, values: v, status: st, due: '09/20' }); }
      if (rnd() < 0.08) { const v = blank(), st = gb.students.map(() => 'blank'); st[i] = 'missing'; gb.assignments.push({ name: 'Extra Credit Poster', max: 0, values: v, status: st, due: '09/21' }); }
      return gb;
    }
    const fails = { belowPct: [], grade: [], whatif: [], need: [], quick: [], quickOpt: [], retake: [], skills: [] }; let nQuick = 0, nP2 = 0, nTop = 0, nWi = 0, nNeed = 0;
    const pop = T.population(s); const gbIdx = new Map(); s.grades.students.forEach((n, j) => gbIdx.set(n, j));
    const stu = s.grades.students.map((n, gi) => ({ n, gi, ix: A.findStudent(s, n).ixl }));
    for (let trial = 0; trial < N; trial++) {
      const S = stu[ri(0, stu.length - 1)]; const i = S.gi, ix = S.ix; randomize(i);
      const o = A.openSec(s); const gb = o.grades;
      const tg = A.computeGrade(o, i), mg = og(o, i);
      if (!tg || tg.rounded == null || !mg) continue;
      if (Math.abs(tg.pct - mg.pct) > 1e-9 || tg.rounded !== mg.r) fails.grade.push({ trial, t: tg.pct, m: mg.pct });
      // ---------- what-if table, read from its own markup ----------
      const rt = A.retakeStatus(s, S.n); const div = document.createElement('div'); div.innerHTML = A.whatIfMarkup(o, i, rt); nWi++;
      const num = el => { const m = /→\s*(\d+)/.exec(el.textContent); return m ? +m[1] : null; };
      const tabs = [...div.querySelectorAll('table.whatif')]; const missing = gb.assignments.filter(a => a.status[i] === 'missing');
      let ti = 0;
      if (missing.length) { const rows = [...tabs[ti++].querySelectorAll('tr')]; rows.forEach(tr => { const nm = tr.querySelector('b').textContent; const got = num(tr.lastElementChild);
        const over = {}; if (/^All \d+ turned in$/.test(nm)) missing.forEach(a => over[a.name] = a.max); else { const a = missing.find(x => x.name === nm); over[a.name] = a.max; }
        const want = og(o, i, over).r; if (got !== want) fails.whatif.push({ trial, row: nm, got, want }); }); }
      const tests = gb.assignments.filter(a => A.catIn(o, a) === 'Assessments' && a.max > 0 && !isIxl(a) && a.status[i] === 'score' && a.values[i] != null && a.values[i] < a.max);
      if (tests.length) { const rows = [...tabs[ti++].querySelectorAll('tbody tr')]; rows.forEach(tr => { const nm = tr.querySelector('b').textContent; const a = tests.find(x => x.name === nm); const tds = [...tr.children].slice(2);
        tds.forEach((td, k) => { const pc = [70, 80, 90, 100][k]; const m = /([\d.]+)\/(\d+)/.exec(td.textContent); if (!m) { if (!(a.values[i] >= a.max * pc / 100)) fails.whatif.push({ trial, row: nm, pc, dash: true }); return; }
          const shown = +m[1]; const want = og(o, i, { [a.name]: shown }).r; const got = num(td);
          if (got !== want) fails.whatif.push({ trial, row: nm, pc, got, want });
          if (shown / a.max * 100 < pc - 1e-9) (fails.belowPct = fails.belowPct || []).push({ trial, kind: 'below-percent', row: nm, pc, shown, max: a.max }); }); }); }
      const ixc = gb.assignments.filter(a => A.catIn(o, a) === 'Assessments' && a.max > 0 && isIxl(a) && (a.status[i] === 'score' || a.status[i] === 'missing') && (a.values[i] == null || a.values[i] < a.max));
      if (ixc.length) { const rows = [...tabs[ti++].querySelectorAll('tr')]; rows.forEach(tr => { const nm = tr.querySelector('b').textContent; const a = ixc.find(x => x.name === nm); const got = num(tr.lastElementChild); const want = og(o, i, { [a.name]: a.max }).r; if (got !== want) fails.whatif.push({ trial, row: nm, ixl: true, got, want }); }); }
      // ---------- the next assessment: brute force every half point ----------
      for (const mx of [A.nextSize(o), ri(1, 60)]) {
        nNeed++; const na = A.nextAssessment(o, i, mx); const cur = mg.r;
        const minFor = tgt => { for (let q = 0; q <= mx + 1e-9; q += 0.5) if (og(o, i, null, { max: mx, pts: q }).r >= tgt) return q; return null; };
        const wantCan = [[90, 'an A'], [80, 'a B'], [70, 'a C'], [60, 'a D']].filter(([x]) => cur < x).map(([x, w]) => ({ w, n: minFor(x) }));
        const gotS = JSON.stringify({ can: na.can.map(x => [x.w, x.n]), cant: na.cant }), wantS = JSON.stringify({ can: wantCan.filter(x => x.n != null).map(x => [x.w, x.n]), cant: wantCan.filter(x => x.n == null).map(x => x.w) });
        const fl = cur >= 90 ? 90 : cur >= 80 ? 80 : cur >= 70 ? 70 : cur >= 60 ? 60 : null; const wk = fl == null ? null : minFor(fl);
        if (gotS !== wantS || (na.keep ? na.keep.n : null) !== wk) fails.need.push({ trial, mx, cur, gotS, wantS, keep: na.keep, wk });
        // the slider: withNext at a random point
        const q = Math.round(rnd() * mx * 2) / 2; const wn = A.withNext(o, i, 'Assessments', mx, q); const wo = og(o, i, null, { max: mx, pts: q });
        if (wn.rounded !== wo.r) fails.need.push({ trial, slider: true, mx, q, got: wn.rounded, want: wo.r });
        const gw = A.gradeWith(o, i, {}, { max: mx, pts: q }); if (gw.rounded !== wo.r) fails.need.push({ trial, gradeWith: true, got: gw.rounded, want: wo.r });
      }
      // ---------- retake eligibility ----------
      { const miss = gb.assignments.filter(a => a.status[i] === 'missing' && !isIxl(a)).map(a => a.name); const block = []; const seen = new Set();
        if (ix != null) gb.assignments.forEach(a => { if (!isIxl(a)) return; const u = unitOfCol(a); if (!u || seen.has(u.name) || A.unitClosed(s, u)) return; seen.add(u.name);
          const full = a.max > 0 && ((a.status[i] === 'score' && +a.values[i] >= a.max) || ptsOwn(u, ix) >= a.max); if (full) return;
          const sh = A.activeFor(s, u, ix).filter(k => { const v = A.eff(s, k, ix); return v == null || v < t; }); if (sh.length) block.push(u.short + ':' + sh.length); });
        const ok = !miss.length && ix != null && !block.length;
        const got = [...(rt.short.length ? [rt.unit.short + ':' + rt.short.length] : []), ...rt.behind.map(x => x.unit.short + ':' + x.short.length)].sort().join(',');
        if (rt.ok !== ok || got !== block.sort().join(',') || rt.missing.length !== miss.length) fails.retake.push({ trial, ok, got: rt.ok, gotB: got, wantB: block.join(',') });
      }
      // ---------- quickest way: brute force under the documented rules ----------
      const q = A.quickestPath(s, o, i, ix); if (!q) continue; nQuick++;
      if (q.top) { nTop++; if (mg.r < 90) fails.quick.push({ trial, top: true, r: mg.r }); continue; }
      const target = [60, 70, 80, 90].find(x => mg.r < x);
      const nhi = gb.assignments.filter(a => a.max > 0 && a.status[i] === 'missing' && (ix == null || !(isIxl(a) && a.max > 0)));
      const base = {}; const cols = [];
      if (ix != null) gb.assignments.filter(a => isIxl(a) && a.max > 0 && (a.status[i] === 'score' || a.status[i] === 'missing')).forEach(a => { const u = unitOfCol(a); if (!u) return;
        const focus = a.status[i] === 'missing' ? 0 : +a.values[i] || 0; const pts = ptsOwn(u, ix); const to = Math.min(a.max, pts); const now = to > focus ? to : focus;
        if (to > focus) base[a.name] = to; const cap = Math.min(a.max, Math.max(A.activeFor(s, u, ix).length, focus)); if (now < cap) cols.push({ a, now, room: cap - now, u }); });
      // phase 1: fewest pieces (each missing assignment = 1, each IXL point = 1)
      const M = nhi.length; if (M > 9) continue;
      const bf = tgt => { let best = null;
        const rec = (ci, over, k) => { if (ci === cols.length) { const g = og(o, i, over); if (g && g.r >= tgt && (best == null || k < best)) best = k; return; }
          const c = cols[ci]; for (let d = 0; d <= c.room; d++) { const ov = { ...over }; if (d || base[c.a.name] != null) ov[c.a.name] = c.now + d; rec(ci + 1, ov, k + d); } };
        for (let mask = 0; mask < (1 << M); mask++) { const over = { ...base }; let k = 0; nhi.forEach((a, j) => { if (mask & (1 << j)) { over[a.name] = a.max; k++; } }); if (best != null && k >= best) continue; rec(0, over, k); }
        return best; };
      { const qc = A.quickestPath(s, o, i, ix, { fromCopies: true }); const b0 = og(o, i, base).r; const t2 = [60, 70, 80, 90].find(x => b0 < x);
        if (qc && !qc.top && t2 != null) { const bc = bf(t2); if (qc.plan.some(x => x.kind === 'copy') || qc.target !== t2 || (bc != null && (!qc.reached || qc.steps !== bc))) fails.quickOpt.push({ trial, t2, bc, steps: qc.steps, reached: qc.reached, tgt: qc.target }); }
        else if (qc && qc.top !== (t2 == null)) fails.quickOpt.push({ trial, top: qc.top, b0 }); }
      let best = null;
      if (true) {
        const rec = (ci, over, k) => { if (ci === cols.length) { const g = og(o, i, over); if (g && g.r >= target && (best == null || k < best)) best = k; return; }
          const c = cols[ci]; for (let d = 0; d <= c.room; d++) { const ov = { ...over }; if (d || base[c.a.name] != null) ov[c.a.name] = c.now + d; rec(ci + 1, ov, k + d); } };
        for (let mask = 0; mask < (1 << M); mask++) { const over = { ...base }; let k = 0; nhi.forEach((a, j) => { if (mask & (1 << j)) { over[a.name] = a.max; k++; } }); if (best != null && k >= best) continue; rec(0, over, k); }
      } else continue;
      const listed = q.plan.filter(x => x.kind !== 'copy').reduce((a, x) => a + x.n, 0);
      const applied = og(o, i, q.over);
      const last = q.plan.length ? q.plan[q.plan.length - 1].after : null;
      if (best != null) {
        if (!q.reached || q.steps !== best || listed !== q.steps || q.retakes.length || applied.r < target || applied.r !== q.result.rounded || (q.plan.length && last !== q.result.rounded))
          fails.quick.push({ trial, phase: 1, target, best, steps: q.steps, listed, reached: q.reached, applied: applied.r, res: q.result.rounded, last, retakes: q.retakes.length });
      } else {
        nP2++;
        // phase 2: every missing assignment and all IXL that can move, then the fewest retakes (only with an IXL link)
        const over = { ...base }; nhi.forEach(a => over[a.name] = a.max); let k = nhi.length; cols.forEach(c => { over[c.a.name] = c.now + c.room; k += c.room; });
        let need = 0; const rtUnits = [...(rt.short.length ? [{ unit: rt.unit, short: rt.short }] : []), ...rt.behind];
        rtUnits.forEach(x => { const col = gb.assignments.find(a => isIxl(a) && a.max > 0 && (a.status[i] === 'score' || a.status[i] === 'missing') && (A.gbUnitFor(s, a) || {}).name === x.unit.name); if (!col) need += x.short.length; });
        const tst = gb.assignments.filter(a => A.isAssess(o, a) && a.status[i] === 'score' && (+a.values[i] || 0) < a.max);
        let kr = null; if (ix != null) for (let mask = 0; mask < (1 << tst.length); mask++) { const ov = { ...over }; let c = 0; tst.forEach((a, j) => { if (mask & (1 << j)) { ov[a.name] = a.max; c++; } }); if ((kr == null || c < kr) && og(o, i, ov).r >= target) kr = c; }
        const wantReached = kr != null; const wantSteps = wantReached ? k + kr + (kr ? need : 0) : null;
        if (q.reached !== wantReached || (wantReached && (q.steps !== wantSteps || applied.r < target || listed !== q.steps || last !== q.result.rounded)))
          fails.quick.push({ trial, phase: 2, target, wantReached, wantSteps, steps: q.steps, listed, reached: q.reached, applied: applied.r, res: q.result.rounded, last, k, kr, need });
        if (q.retakes.length) { const lr = q.retakes[q.retakes.length - 1]; const a = lr.a; if (lr.pts - 0.5 >= (+a.values[i] || 0)) { const ov = { ...q.over, [a.name]: lr.pts - 0.5 }; if (og(o, i, ov).r >= target) fails.quick.push({ trial, lastRetakeNotLeast: true, pts: lr.pts }); } }
      }
      // the IXL skills it names: the student's own below goal, closest first
      q.ixl.forEach(x => { const u = T.unitsOf(s).find(y => y.name === x.unit.name); const vals = A.activeFor(s, u, ix).map(k => A.eff(s, k, ix)).filter(v => v == null || v < t).map(v => v == null ? -1 : v).sort((a, b) => b - a).slice(0, x.n);
        const got = x.skills.map(k => k.v == null ? -1 : k.v); if (JSON.stringify(got) !== JSON.stringify(vals) || x.skills.length !== x.n) fails.skills.push({ trial, unit: x.unit.short, n: x.n, got, want: vals }); });
    }
    s.grades = JSON.parse(orig);
    const sum = {}; for (const k in fails) sum[k] = { n: fails[k].length, ex: fails[k].slice(0, 3) };
    return { N, nQuick, nP2, nTop, nWi, nNeed, asg: A.openSec(s).grades.assignments.map(a => a.name).slice(0, 3).join('|'), lq: T.liveQuarter(s), sum };
  }, [K, N, SEED]);
  console.log(JSON.stringify(res, null, 1).slice(0, 6000));
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  for (const k in res.sum) check(res.sum[k].n === 0, k + ' agrees with the oracle (' + res.sum[k].n + ' disagreements)');
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
