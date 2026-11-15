// GRD coverage harness (not a finding): fitCategories and gradeDiff ("See why") against a hidden truth.
// Each case: a hidden Focus setup (categories per assignment + weights) makes the Grade column (exact oracle, half up);
// Tally holds a perturbed setup (wrong guesses, other weights, a column Focus doesn't count, ±1 noise).
// Checks: an exact fit reproduces every grade; "determined" means every single alternative breaks; every class-wide
// sentence in gradeDiff is literally true once applied (fix run, then gradeOff empty; or the stated change made with the
// categories IN USE); every per-student "would match if" is true.
//   TALLY_REPO=... N=1500 node probes/fuzz-fit.js
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
const N = Number(process.env.N || 1500);
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const res = await p.evaluate(N => {
    const T = window.__tally, A = window.__all;
    let seed = Number(42); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pickA = arr => arr[Math.floor(rnd() * arr.length)];
    const CATS = ['Assessments', 'Classwork', 'Participation'];
    // plain-float oracle with exact-ish half-up (the grade oracle in fuzz-grade.js agrees with computeGrade everywhere)
    const grade = (gb, map, w, i, drop) => { const E = {}, P = {}; gb.assignments.forEach(a => { if (drop && drop(a, i)) return; const st = a.status[i], v = a.values[i]; const c = map[a.name];
      if (a.max === 0) { if (st === 'score' && v > 0) E[c] = (E[c] || 0) + v; return; } if (!(a.max > 0)) return;
      if (st === 'score') { E[c] = (E[c] || 0) + v; P[c] = (P[c] || 0) + a.max; } else if (st === 'missing') { P[c] = (P[c] || 0) + a.max; } });
      let tw = 0, tot = 0; CATS.forEach((c, k) => { if (P[c] > 0) { tw += w[k]; tot += w[k] * (E[c] || 0) / P[c] * 100; } }); return tw ? Math.round(tot / tw + 1e-9) : null; };
    const out = { cases: 0, exact: 0, exactWrong: [], detBad: [], detButWrong: 0, detButWrongMatters: [], notExactButTruth: 0, claims: 0, claimBad: [], would: 0, wouldBad: [], kinds: {} };
    const g = T.gradingFor('acc');
    for (let t = 0; t < N; t++) {
      const nS = ri(6, 24), nA = ri(3, 12);
      const W = pickA([[70, 25, 5], [60, 30, 10], [50, 40, 10], [80, 15, 5]]);
      const students = Array.from({ length: nS }, (_, i) => 'S' + i + ', X');
      const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pickA([5, 10, 10, 20, 25, 50, 0]); const values = [], status = []; const allSame = rnd() < 0.15;
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.8 ? 'score' : r < 0.9 ? 'missing' : r < 0.95 ? 'excused' : 'blank'; status.push(st);
          values.push(st === 'score' ? (allSame ? (max || 3) : ri(0, (max || 6) * 2) / 2) : null); }
        const name = 'A' + j; assignments.push({ name, max, values, status, missing: status.filter(x => x === 'missing').length }); truth[name] = pickA(CATS); }
      const gb = { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' };
      // which perturbation Tally has
      const kind = pickA(['cats', 'cats', 'weights', 'drop', 'noise', 'none']); out.kinds[kind] = (out.kinds[kind] || 0) + 1;
      const dropName = kind === 'drop' ? pickA(assignments.filter(a => a.max > 0)).name : null;
      gb.overall = students.map((_, i) => grade(gb, truth, W, i, dropName ? a => a.name === dropName : null));
      if (kind === 'noise') gb.overall = gb.overall.map(v => v == null ? v : v + pickA([-1, 0, 1]));
      const stored = { ...truth }; if (kind === 'cats' || rnd() < 0.3) { const a = pickA(assignments); stored[a.name] = pickA(CATS); }
      const Wt = kind === 'weights' ? pickA([[70, 25, 5], [60, 30, 10], [65, 30, 5], [75, 20, 5]]) : W;
      g.cats = CATS.map((c, k) => ({ name: c, w: Wt[k] })); g.map = { ...stored }; g.how = {}; assignments.forEach(a => g.how[a.name] = 'guess'); g.ec = {}; g.codes = {};
      const sec = { key: 'ff' + t, prep: 'acc', grades: gb };
      out.cases++;
      const fit = A.fitCategories(sec); if (!fit) continue;
      const wNow = g.cats.map(c => c.w);
      if (fit.exact) { out.exact++;
        const bad = gb.overall.map((v, i) => v == null ? null : grade(gb, fit.map, wNow, i) === v ? null : i).filter(x => x != null);
        if (bad.length && out.exactWrong.length < 4) out.exactWrong.push({ t, bad });
        assignments.forEach(a => { if (!fit.determined[a.name]) return; const alt = CATS.filter(c => c !== fit.map[a.name]).find(c => gb.overall.every((v, i) => v == null || grade(gb, { ...fit.map, [a.name]: c }, wNow, i) === v));
          if (alt && out.detBad.length < 4) out.detBad.push({ t, a: a.name, alt });
          if (kind !== 'weights' && kind !== 'noise' && kind !== 'drop' && fit.map[a.name] !== truth[a.name]) { out.detButWrong++;
            // does it matter? the same assignment retaken at full by everyone: Focus (truth) vs Tally (fit map)
            const full = (m, i) => { const gb2 = { ...gb, assignments: gb.assignments.map(x => x.name === a.name && x.max > 0 ? { ...x, values: x.values.map(() => x.max), status: x.status.map(() => 'score') } : x) }; return grade(gb2, m, W, i); };
            const diff = students.map((_, i) => i).filter(i => full(truth, i) !== full(fit.map, i));
            if (diff.length && out.detButWrongMatters.length < 3) out.detButWrongMatters.push({ t, a: a.name, fitSays: fit.map[a.name], truth: truth[a.name], studentsWhoseWhatIfDiffers: diff.length, of: nS }); } });
      } else if (kind === 'cats' || kind === 'none') { out.notExactButTruth++; if ((out.diag = out.diag || []).length < 5) { const wrong = assignments.filter(a => stored[a.name] !== truth[a.name]).map(a => a.name + ':' + stored[a.name] + '>' + truth[a.name]); const fm = assignments.filter(a => fit.map[a.name] !== truth[a.name]).map(a => a.name + ':' + fit.map[a.name] + '>' + truth[a.name]); const gd0 = A.gradeDiff(sec, fit); out.diag.push({ t, kind, wrong, fitErr: fit.err, fitWrong: fm, nS, nA, whole: gd0 ? gd0.whole.map(w => w.html.replace(/<[^>]+>/g, '').slice(0, 120)) : null, off: gd0 && gd0.off.length }); } }
      // ---- See why ----
      const gd = A.gradeDiff(sec, fit); if (!gd) continue;
      const snap = JSON.stringify(g);
      const restore = () => { const o = JSON.parse(snap); Object.keys(o).forEach(k => g[k] = o[k]); };
      gd.whole.forEach(w => { if (w.note) return; out.claims++;
        if (w.fix) { w.fix.run(); const left = A.gradeOff(sec); restore(); if (left.length && out.claimBad.length < 6) out.claimBad.push({ t, kind, html: w.html.replace(/<[^>]+>/g, ''), stillOff: left.length }); return; }
        const m = w.html.match(/<b>([^<]+)<\/b>/); const nm = m && m[1]; let over = null;
        if (/isn't counted\./.test(w.html)) over = i => ({ [nm]: null });
        else if (/empty cells on/.test(w.html)) over = i => { const a = gb.assignments.find(x => x.name === nm); return ['blank', 'excused', 'unread'].includes(a.status[i]) ? { [nm]: 0 } : null; };
        else if (/the NHIs on/.test(w.html)) over = i => { const a = gb.assignments.find(x => x.name === nm); return a.status[i] === 'missing' ? { [nm]: null } : null; };
        else if (/every blank cell/.test(w.html)) over = i => { const o = {}; gb.assignments.forEach(a => { if (a.max > 0 && a.status[i] === 'blank') o[a.name] = 0; }); return o; };
        else if (/no NHI is counted/.test(w.html)) over = i => { const o = {}; gb.assignments.forEach(a => { if (a.status[i] === 'missing') o[a.name] = null; }); return o; };
        if (!over) return;
        const left = gb.overall.map((v, i) => v == null ? null : (A.computeGrade(sec, i, over(i)) || {}).rounded === v ? null : i).filter(x => x != null);
        if (left.length && out.claimBad.length < 6) out.claimBad.push({ t, kind, html: w.html.replace(/<[^>]+>/g, ''), stillOffWithCategoriesInUse: left.length, of: nS, truthDrop: dropName, storedVsTruth: assignments.filter(a => stored[a.name] !== truth[a.name]).map(a => a.name + ':' + stored[a.name] + '→' + truth[a.name]) });
      });
      gd.off.forEach(o => { if (!o.would) return; out.would++; const m = o.would.match(/<b>([^<]+)<\/b>/); const nm = m[1]; const v = /counted as a 0/.test(o.would) ? 0 : null;
        const r = A.computeGrade(sec, o.i, { [nm]: v }); if ((r && r.rounded) !== o.focus && out.wouldBad.length < 4) out.wouldBad.push({ t, would: o.would, got: r && r.rounded, focus: o.focus }); });
    }
    return out;
  }, N);
  console.log(JSON.stringify({ cases: res.cases, exact: res.exact, kinds: res.kinds, claims: res.claims, would: res.would, detButWrong: res.detButWrong, notExactButTruth: res.notExactButTruth }));
  console.log('OBSERVED: exactWrong', JSON.stringify(res.exactWrong), 'detBad', JSON.stringify(res.detBad));
  console.log('OBSERVED: detButWrongMatters', JSON.stringify(res.detButWrongMatters));
  console.log('OBSERVED: claimBad', res.claimBad.length, JSON.stringify(res.claimBad).slice(0, 2500));
  if (process.env.DIAG) console.log('DIAG', JSON.stringify(res.diag, null, 0)); console.log('OBSERVED: wouldBad', JSON.stringify(res.wouldBad));
  console.log('EXPECTED: every list empty');
  check(!res.exactWrong.length, 'an exact fit reproduces every grade'); check(!res.detBad.length, 'determined = every alternative breaks');
  check(!res.claimBad.length, 'every See-why class-wide sentence is true as stated'); check(!res.wouldBad.length, 'every would-match line is true');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
