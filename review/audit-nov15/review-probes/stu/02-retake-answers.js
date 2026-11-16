// usage: node 02-retake-answers.js <repo dir> <out.json> [brute]
// Loads the scrubbed class (IXL, roster, Q1 then Q2 gradebook) and, for every student of the open gradebook, records the
// retake answer on every surface and quickestPath's plan. With "brute", checks the plan's step count against an exhaustive
// search over missing work and IXL skills (plans with no retake).
const path = require('path'); const repo = path.resolve(process.argv[2]); process.chdir(repo);
const { chromium, fs, exe, pick, APP } = require(path.join(repo, 'tests/lib'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'America/New_York' }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto('file://' + path.resolve(APP));
  await p.setInputFiles('#file', [path.resolve('fixtures', fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')))]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  for (const f of (process.env.GB || 'focus_gradebook_scrubbed.csv,focus_gradebook_scrubbed_q2.csv').split(',')) { await p.setInputFiles('#file', [path.resolve('fixtures', f)]); await p.waitForTimeout(600); await pick(p); await p.waitForTimeout(600); }
  const res = await p.evaluate(([K, brute]) => { const T = window.__tally, A = window.__all, sec = T.state.sections[K]; const s = A.openSec(sec); const gb = s.grades; const rows = A.gbRows(s);
    const txt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.innerText || d.textContent; };
    const out = [];
    gb.students.forEach((name, i) => { const f = A.findStudent(sec, name); const rt = A.retakeStatus(sec, name);
      // my own recount of "need": per unit the open gradebook's IXL column for it, max - points, no more than the skills below goal
      const mine = []; if (f.ixl != null) { const seen = new Set(); gb.assignments.forEach(a => { if (!/\bixl\b/i.test(a.name) || A.aClosed(a, gb)) return; if (a.status && a.status[i] === 'excused') return; const u = A.gbUnitFor(sec, a); if (!u || seen.has(u.name) || A.unitClosed(sec, u)) return; seen.add(u.name);
        const unit = A.unitsOf(sec).find(x => x.name === u.name); const pts = A.points(sec, unit, f.ixl); const below = A.activeFor(sec, unit, f.ixl).filter(k => { const v = A.eff(sec, k, f.ixl); return v == null || v < sec.threshold; }).length;
        const cell = a.status && a.status[i] === 'score' ? Number(a.values[i]) : 0; if (a.max > 0 && (cell >= a.max || pts >= a.max)) return; if (!below) return; mine.push(u.short + ':' + (a.max > 0 ? Math.min(below, a.max - pts) : below)); }); }
      const tally = [...(rt.short.length ? [rt.unit.short + ':' + (rt.need || rt.short.length)] : []), ...(rt.behind || []).map(x => x.unit.short + ':' + (x.need || x.short.length))];
      let weekly = ''; try { weekly = txt(A.studentReportSection(s, i, rows[i])); } catch (e) { weekly = 'ERR ' + e.message; }
      const wk = ((weekly.match(/[^.\n]*IXL skill[^.\n]*/g)) || []).join(' | ');
      let conf = ''; try { conf = A.conferenceWork(A.conferenceData(sec, name)); } catch (e) { conf = 'ERR ' + e.message; }
      const qp = A.quickestPath(sec, s, i, f.ixl); const plan = qp && qp.plan ? qp.plan.map(x => [x.kind, x.a.name, x.n, x.to, x.after]) : qp && qp.top ? 'top' : null;
      const o = { i, ok: rt.ok, missing: rt.missing, tally: tally.join(' '), mine: mine.join(' '), why: A.retakeWhy(rt, true), whyT: A.retakeWhy(rt), wk, confIxl: (conf.match(/Unit[^\n]*skills? left/g) || []).join(' | '), plan, steps: qp && qp.steps, reached: qp && qp.reached, blocked: qp && qp.retakeBlocked };
      if (brute && qp && qp.plan && qp.reached && !qp.plan.some(x => x.kind === 'retake' || x.kind === 'ixlreq' || x.kind === 'copy') && qp.steps > 1) {
        // exhaustive: can steps-1 pieces of work (one NHI turned in = 1, one IXL skill = 1) reach the target?
        const nhi = gb.assignments.filter(a => a.max > 0 && a.status && a.status[i] === 'missing' && (!/\bixl\b/i.test(a.name) || f.ixl == null) && !(A.gbUnitFor(sec, a) && f.ixl != null));
        const ix = gb.assignments.filter(a => qp.ixl.some(x => x.a.name === a.name) || (f.ixl != null && /\bixl\b/i.test(a.name) && A.catIn(s, a) && qp.plan.some(x => x.a.name === a.name)));
        const allIx = gb.assignments.filter(a => f.ixl != null && /\bixl\b/i.test(a.name) && A.gbUnitFor(sec, a));
        const now = a => a.status[i] === 'score' ? Number(a.values[i]) || 0 : 0; const unitOf = a => A.unitsOf(sec).find(x => x.name === A.gbUnitFor(sec, a).name);
        const cap = a => { const u = unitOf(a); const n = u ? A.activeFor(sec, u, f.ixl).length : 0; return Math.min(a.max, Math.max(n, now(a))); };
        const room = allIx.map(a => Math.max(0, cap(a) - now(a))); const k = qp.steps - 1; let found = null, tries = 0;
        for (let m = 0; m < (1 << nhi.length) && !found; m++) { const over = {}; let used = 0; nhi.forEach((a, j) => { if (m >> j & 1) { over[a.name] = a.max; used++; } }); if (used > k) continue;
          const rec = (j, left) => { if (found) return; if (j === allIx.length) { tries++; const g = A.computeGrade(s, i, over).rounded; if (g >= qp.target) found = { m, over: JSON.stringify(over) }; return; }
            for (let d = Math.min(left, room[j]); d >= 0; d--) { if (d) over[allIx[j].name] = now(allIx[j]) + d; else delete over[allIx[j].name]; rec(j + 1, left - d); if (found) return; } delete over[allIx[j].name]; };
          rec(0, k - used); }
        o.brute = found ? 'FEWER ' + found.over : 'min ok (' + tries + ')'; }
      out.push(o); });
    return out; }, [K, process.argv[4] === 'brute']);
  fs.writeFileSync(process.argv[3], JSON.stringify({ errs, res }, null, 1)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });
