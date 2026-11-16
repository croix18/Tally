// Audit of 15 Nov 2026, fixer GRAD: the grade engine and the Grades screen. Synthetic classes only.
const { chromium, fs, path, exe, check, done, pick, tmp, APP } = require('./lib');
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  // a seeded random class: Focus's Grade column is the true setup; `wrong` stored categories are off
  await p.evaluate(() => {
    window.__mk = (seed, nWrong, how, dropLast) => { const T = window.__tally, A = window.__all;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pk = arr => arr[Math.floor(rnd() * arr.length)];
      const CATS = ['Assessments', 'Classwork', 'Participation']; const g = T.gradingFor('acc'); g.cats = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }];
      const nS = ri(18, 30), nA = ri(8, 25); const students = Array.from({ length: nS }, (_, i) => 'Student' + i + ', Test'); const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pk([4, 5, 10, 20, 25, 40, 50]); const ab = rnd(); const values = [], status = [];
        for (let i = 0; i < nS; i++) { const r = rnd(); const st = r < 0.86 ? 'score' : r < 0.95 ? 'missing' : 'excused'; status.push(st); values.push(st === 'score' ? Math.min(max, Math.round(max * 2 * (0.45 + 0.55 * Math.min(1, ab * 0.5 + rnd() * 0.8))) / 2) : null); }
        assignments.push({ name: 'Item ' + j, max, values, status, missing: status.filter(x => x === 'missing').length }); truth['Item ' + j] = pk(CATS); }
      const gb = { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' }; g.map = { ...truth }; g.how = {}; assignments.forEach(a => g.how[a.name] = 'fit'); g.ec = {}; g.codes = {};
      const sec = { key: 'syn' + seed, prep: 'acc', grades: gb }; gb.overall = students.map((_, i) => A.computeGrade(sec, i, dropLast ? { [assignments[nA - 1].name]: null } : null).rounded);   // dropLast: Focus doesn't count the last column
      for (let k = 0; k < nWrong; k++) { const a = assignments[k]; g.map[a.name] = pk(CATS.filter(c => c !== truth[a.name])); g.how[a.name] = how; }
      return { sec, truth };
    };
  });

  // ---- GRD-01: the category fit reaches an exact fit that exists (one wrong anywhere; a week of 2-4 wrong guesses) ----
  {
    const r = await p.evaluate(() => { const A = window.__all; let cases = 0, stalls = 0;
      for (let t = 1; t <= 160; t++) { const { sec } = window.__mk(t * 7919, t % 4 === 0 ? 1 : 2 + (t % 3), 'guess'); if (!A.gradeOff(sec).length) continue; cases++; if (!A.fitCategories(sec).exact) stalls++; }
      return { cases, stalls }; });
    check(r.cases > 60 && r.stalls === 0, `GRD-01: the fit finds an exact fit whenever one exists (${r.stalls} of ${r.cases} stalled)`);
    const ms = await p.evaluate(() => { const A = window.__all, T = window.__tally; const g = T.gradingFor('acc'); let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const students = Array.from({ length: 35 }, (_, i) => 'S' + i + ', T'); const assignments = Array.from({ length: 60 }, (_, j) => ({ name: 'W' + j, max: 10, values: students.map(() => Math.round(rnd() * 20) / 2), status: students.map(() => 'score') }));
      g.map = {}; g.how = {}; assignments.forEach(a => { g.map[a.name] = 'Classwork'; g.how[a.name] = 'guess'; });
      const sec = { key: 'tm', prep: 'acc', grades: { students, assignments, overall: students.map(() => 50 + Math.floor(rnd() * 50)), importedAt: '2026-11-13T15:00:00.000Z' } };
      const t0 = performance.now(); A.fitCategories(sec); return performance.now() - t0; });
    check(ms < 2500, `GRD-01: the worst case (35 students x 60 columns that nothing explains) stays fast (${Math.round(ms)} ms)`);
  }
  // ---- GRD-01 round 2: six categories, 35 x 60, seven unchecked guesses, a Grade column nothing reproduces: still quick ----
  {
    const r = await p.evaluate(() => { const A = window.__all, T = window.__tally; const g = T.gradingFor('on'); const C = ['Assessments', 'Classwork', 'Participation', 'Homework', 'Projects', 'Quizzes']; g.cats = C.map((name, k) => ({ name, w: [40, 20, 10, 10, 10, 10][k] })); g.codes = {}; g.ec = {};
      let seed = 9; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const students = Array.from({ length: 35 }, (_, i) => 'S' + i + ', K');
      const assignments = Array.from({ length: 60 }, (_, j) => ({ name: 'C' + j, max: 10, values: students.map(() => Math.round(rnd() * 20) / 2), status: students.map(() => 'score') }));
      g.map = {}; g.how = {}; assignments.forEach((a, j) => { g.map[a.name] = C[j % 6]; g.how[a.name] = j < 7 ? 'guess' : 'fit'; });
      const sec = { key: 'k6', prep: 'on', grades: { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' } }; sec.grades.overall = students.map((_, i) => A.computeGrade(sec, i).rounded + (i < 2 ? 3 : 0));
      const t0 = performance.now(); const f = A.fitCategories(sec); const ms = performance.now() - t0; const again = students.reduce((e, i, k) => { const x = A.computeGrade(sec, k, null, f.map).rounded; return e + Math.abs(x - sec.grades.overall[k]); }, 0);
      g.cats = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }]; return { ms, err: f.err, again }; });
    check(r.ms < 4000 && r.err === r.again, `GRD-01 round 2: six categories with seven guesses fit in ${Math.round(r.ms)} ms, and the error it reports is its map's (${r.err} = ${r.again})`);
  }

  // ---- GRD-03: with a hand-set wrong category, See why offers Tally's own weights plus that one move ----
  {
    const r = await p.evaluate(() => { const A = window.__all; let cases = 0, good = 0, ex = null;
      for (let t = 1; t <= 60; t++) { const { sec, truth } = window.__mk(t * 104729, 1, 'user'); if (!A.gradeOff(sec).length) continue; const fit = A.fitCategories(sec); const gd = A.gradeDiff(sec, fit); if (!gd) continue; cases++;
        const nm = sec.grades.assignments[0].name; const re = /^Every grade matches with Item \d+ in \w+ \(Tally has \w+\)\.$/;   /* another single move can fit the same grades by chance: any one at Tally's weights */
        const fixes = gd.whole.filter(w => w.fix); const w = fixes[0]; const html = w ? w.html.replace(/<[^>]+>/g, '') : gd.whole.map(x => x.html.replace(/<[^>]+>/g, '')).join(' / ');
        if (w && re.test(html) && w.fix.label === 'Use this category') good++; else if (!ex) ex = html; }
      return { cases, good, ex }; });
    check(r.cases > 20 && r.good === r.cases, `GRD-03: See why's first fix is one category moved at Tally's own weights ("Every grade matches with Item N in X (Tally has Y)", "Use this category") (${r.good} of ${r.cases})${r.ex ? ': ' + r.ex : ''}`);
  }

  // ---- GRD-02: a cause is said only with the categories that make it true; a needed move is named and offered ----
  {
    const r = await p.evaluate(() => { const A = window.__all; let lines = 0, bad = [], withMove = 0, fixOk = 0; const selfMove = [], unproved = [];
      for (let t = 1; t <= 120; t++) { const { sec } = window.__mk(t * 15485863, 1, 'guess', true); const gb = sec.grades;
        const fit = A.fitCategories(sec); if (!A.gradeOff(sec).length) continue; const gd = A.gradeDiff(sec, fit); if (!gd) continue;
        gd.whole.forEach(w => { const h = w.html.replace(/<[^>]+>/g, ''); const m = h.match(/^Every grade matches when (.+?) isn't counted\./); if (m) { lines++; const ok = gb.students.every((_, i) => gb.overall[i] == null || A.computeGrade(sec, i, { [m[1]]: null }).rounded === gb.overall[i]); if (!ok) bad.push(h); }
          const mm = h.match(/^Every grade matches with (.+?) in (\w+) and (.+?) not counted\./); if (mm) { withMove++; if (w.fix && /^Use th/.test(w.fix.label)) fixOk++; const moved = [...w.html.matchAll(/<b>([^<]+)<\/b> in /g)].map(x => x[1]); if (moved.includes(mm[3])) selfMove.push(h);
            const T = window.__tally, g = T.gradingFor('acc'); w.fix.run(); moved.forEach(nm => { if (g.how[nm] === 'fit' && !(fit.exact && fit.determined[nm])) unproved.push(nm); }); } }); }
      return { lines, bad: bad.slice(0, 2), withMove, fixOk, selfMove: selfMove.slice(0, 2), unproved: unproved.slice(0, 3) }; });
    check(r.bad.length === 0, `GRD-02: every "isn't counted" sentence holds with the categories in use (${r.bad.length} of ${r.lines} do not)${r.bad.length ? ': ' + r.bad.join(' / ') : ''}`);
    check(!r.selfMove.length, 'GRD-02 round 2: a combined sentence never moves the column it says is not counted ' + r.selfMove.join(' / '));
    check(!r.unproved.length, 'GRD-02 round 2: "Use this category" from a combined sentence does not mark a category proved by Focus unless the fit proved it ' + r.unproved.join(', '));
    check(r.withMove > 0 && r.fixOk === r.withMove, `GRD-02: a cause that needs a category move names it and offers it (${r.fixOk} of ${r.withMove})`);
  }

  // ---- item 9: a student with no Tally grade where Focus has one is an error everywhere; "the NHI on X wasn't counted" ----
  {
    const r = await p.evaluate(() => { const A = window.__all; const out = {};
      { const { sec } = window.__mk(4242, 0, 'fit'); const gb = sec.grades; gb.assignments.forEach(a => { a.status[0] = 'excused'; a.values[0] = null; }); gb.overall[0] = 50;
        gb.assignments[1].codes = { 2: 'LATE' }; gb.assignments[1].status[2] = 'unread'; gb.assignments[1].values[2] = null; gb.overall[2] = A.computeGrade(sec, 2).rounded;
        const f = A.fitCategories(sec); const q = A.gbQuestions(sec); const o = q.codes.find(c => c.code === 'LATE'); out.fitErr = f.err; out.exact = f.exact; out.codeErr = o ? Math.min(o.zeroErr, o.outErr) : null; }
      for (let t = 1; t < 60 && !out.would; t++) { const { sec } = window.__mk(t * 31337, 0, 'fit'); const gb = sec.grades;
        for (const a of gb.assignments) { const i = a.status.findIndex(x => x === 'score'); if (i < 0 || !(a.values[i] > 0)) continue; const keep = [a.status[i], a.values[i]];
          const want = A.computeGrade(sec, i).rounded; a.status[i] = 'missing'; a.values[i] = null; const nowG = A.computeGrade(sec, i).rounded; if (want - nowG < 2) { [a.status[i], a.values[i]] = keep; continue; }
          gb.overall[i] = want; a.missing = a.status.filter(x => x === 'missing').length; const gd = A.gradeDiff(sec, A.fitCategories(sec)); const o = gd && gd.off.find(x => x.i === i); if (o && o.would) { out.would = o.would.replace(/<[^>]+>/g, ''); } break; } }
      return out; });
    check(r.fitErr >= 1 && r.exact === false, `item 9: the fit counts a student with no Tally grade as off Focus (err ${r.fitErr}, exact ${r.exact})`);
    check(r.codeErr >= 1, `item 9: "How Focus counts these" counts that student as off too (${r.codeErr})`);
    check(/^the NHI on .+ wasn't counted$/.test(r.would || ''), 'item 9: the per-student line reads "the NHI on X wasn\'t counted": ' + r.would);
  }

  // ---- HLT-05: a previous import with nothing graded yet is no average of 0 ----
  {
    const r = await p.evaluate(() => { const A = window.__all; if (!A.snapAverage) return {}; return { none: A.snapAverage({ grade: [null, null] }), some: A.snapAverage({ grade: [80, null, 90] }), bad: A.snapAverage({}) }; });
    check(r.none === null && r.some === 85 && r.bad === null, 'HLT-05: a snapshot with nothing graded has no class average (null), not 0 ' + JSON.stringify(r));
  }

  // ---- HLT-06 and HLT-03: category percents round half up with the engine's slack ----
  {
    const r = await p.evaluate(() => { const A = window.__all, T = window.__tally; const out = { pct1: A.pct1(23 / 40 * 100) };
      let hit = null; for (let pp = 1; pp <= 400 && !hit; pp++) for (let e2 = 0; e2 <= 2 * pp && !hit; e2++) { const H = e2 * 5000 / pp; if (!Number.isInteger(H) || H % 10 !== 5) continue; const v = e2 / 2 / pp * 100; if (v.toFixed(1) !== (Math.round(v * 10 + 1e-9) / 10).toFixed(1)) hit = { max: pp, pts: e2 / 2, want: (Math.round(v * 10 + 1e-9) / 10).toFixed(1) }; }
      if (!hit) return out; const g = T.gradingFor('acc'); g.cats = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }]; g.map = { 'Only test': 'Assessments' }; g.how = { 'Only test': 'user' }; g.codes = {}; g.ec = {};
      const students = ['A, A', 'B, B', 'C, C', 'D, D']; const sec = { key: 'h3', prep: 'acc', grades: { students, importedAt: '2026-11-13T15:00:00.000Z', assignments: [{ name: 'Only test', max: hit.max, values: students.map(() => hit.pts), status: students.map(() => 'score'), missing: 0 }] } };
      sec.grades.overall = students.map((_, i) => A.computeGrade(sec, i).rounded + 9); const gd = A.gradeDiff(sec, A.fitCategories(sec)); out.hit = hit; out.cats = gd && gd.off[0].cats[0]; return out; });
    check(r.pct1 === '58%', `HLT-06: a category of 23 out of 40 shows 58%, as the course grade rounds it (${r.pct1})`);
    check(r.hit && r.cats === `Assessments ${r.hit.want}%`, `HLT-03: See why's category percent rounds half up (${JSON.stringify(r.hit)} -> ${r.cats})`);
  }

  // ---- the scrubbed real class, on a fresh page: imported a week ago and today, nothing changed in between ----
  const K = '1205050-7T1A';
  const fresh = async tz => { const q = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, ...(tz ? { timezoneId: tz } : {}) })).newPage(); q.on('pageerror', e => errs.push(e.message)); q.on('dialog', d => d.accept());
    await q.goto('file://' + path.resolve(APP)); await q.waitForTimeout(400);
    const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed')); await q.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await q.waitForTimeout(500);
    await q.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await q.click('#rpSave'); await q.waitForTimeout(300); return q; };
  const gbIn = async (q, f) => { await q.setInputFiles('#file', [path.resolve(f)]); await q.waitForTimeout(600); await pick(q); await q.waitForTimeout(700); if (await q.$('#modal:not(.hidden) #askApply')) { await q.click('#askApply'); await q.waitForTimeout(400); } };
  const twoWeeks = async q => { await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.grades.importedAt = s.grades.exportedAt = new Date(Date.now() - 7 * 864e5).toISOString(); s.gradeHistory = []; A.gradeSnapshot(s); T.save(); }, K);
    await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv'); await q.evaluate(K => { window.__tally.state.active = K; document.querySelector('#openGrades').click(); }, K); await q.waitForTimeout(300); };
  const gradesScreen = q => q.evaluate(K => { const A = window.__all, s = window.__tally.state.sections[K]; const d = A.digestFor(s);
    return { since: [...document.querySelectorAll('table.gstu tr[data-stu]')].map(tr => tr.children[2].innerText.trim()).filter(t => t && t !== '±0').length, tags: document.querySelectorAll('#gridwrap .gstu .gtag').length,
      cards: [...document.querySelectorAll('#gridwrap .gcard')].map(c => c.innerText.replace(/\s+/g, ' ').trim()).filter(t => /Class average|Sliding/i.test(t)), prev: !!A.prevGradeSnap(s), changed: A.gradeRulesChanged ? !!A.gradeRulesChanged(s) : null, digest: !!d.focus,
      digestSlid: d.focus ? d.focus.slid.length : null }; }, K);
  // ---- GRD-04: a category or weights change since the last import is not reported as students moving ----
  {
    const q = await fresh(); await twoWeeks(q);
    const pre = await gradesScreen(q);
    check(pre.prev && pre.since === 0 && pre.digest, `GRD-04 setup: two imports with nothing changed compare, and show no change (${JSON.stringify(pre)})`);
    await q.selectOption('select[data-cat="Unit 1 Notebook Check"]', 'Classwork'); await q.waitForTimeout(500);
    const mv = await gradesScreen(q);
    check(!mv.prev && mv.changed && mv.since === 0 && mv.tags === 0 && !mv.digest, `GRD-04: after moving a category, no student, Sliding or digest shows a change (${JSON.stringify(mv)})`);
    check(mv.cards.some(t => /^Class average .*grading settings changed since/i.test(t)) && mv.cards.some(t => /^Sliding — grading settings changed since .*nothing to compare/i.test(t)), 'GRD-04: the Grades cards say the grading settings changed since that import: ' + JSON.stringify(mv.cards));
    const hm = await q.evaluate(K => { const A = window.__all, s = window.__tally.state.sections[K]; const g = A.gradeSummary(s); const dm = A.digestMarkup(A.digestFor(s)).replace(/<[^>]+>/g, ' ');
      return { ruledDate: g.ruledDate, digest: /grading settings .*changed since the import of/.test(dm), needsTwo: /needs two gradebook imports/.test(dm) }; }, K);
    check(hm.ruledDate && hm.digest && !hm.needsTwo, 'GRD-04 round 2: the Overview card and the digest say the grading settings changed, not "needs two imports" ' + JSON.stringify(hm));
    await q.evaluate(K => { const T = window.__tally; T.state.settings.details = true; T.view.mode = 'home'; T.render(); }, K).catch(() => {}); await q.waitForTimeout(300);
    const ov = await q.evaluate(() => (document.body.innerText.match(/Focus average[^\n]*\n?[^\n]*\n?[^\n]*/i) || [''])[0].replace(/\s+/g, ' '));
    check(/grading settings changed since/i.test(ov) && !/first gradebook/i.test(ov), 'GRD-04 round 2: the Overview grade card says the settings changed: ' + ov);
    const r = await q.evaluate(K => { const T = window.__tally, A = window.__all, s = T.state.sections[K]; const h = s.gradeHistory; const old = h[0]; if (!A.snapsComparable) return {};
      const a = { rules: { w: [['A', 70]], codes: {}, cat: { x: 'A', y: 'B' } } }, c = { rules: { w: [['A', 70]], codes: {}, cat: { x: 'A', y: 'B', z: 'C' } } }, d = { rules: { w: [['A', 75]], codes: {}, cat: {} } };
      const newColumnOk = A.snapsComparable(a, c), weightsDiffer = !A.snapsComparable(a, d), codeDiffer = !A.snapsComparable({ rules: { ...a.rules, codes: { LATE: 'zero' } } }, { rules: { ...a.rules, codes: { LATE: '' } } });
      const saved = old.rules; delete old.rules; const legacy = !!A.prevGradeSnap(s); old.rules = saved;
      return { newColumnOk, weightsDiffer, codeDiffer, legacy }; }, K);
    check(r.newColumnOk && r.weightsDiffer && r.codeDiffer, 'GRD-04: a new column keeps two imports comparable; other weights or another text-grade rule do not ' + JSON.stringify(r));
    check(r.legacy, 'GRD-04: a snapshot saved before this fix (no rules) is still compared');
    await q.context().close();
  }

  // ---- GRD-04 round 2: a column made ahead in Focus, empty one week and graded (in its proved category) the next, still compares ----
  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    const r = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const g = T.gradingFor(s.prep); const n = gb.students.length; const at = gb.importedAt;
      gb.assignments.unshift({ name: 'Unit 3 Whiteboard', max: 5, values: gb.students.map(() => null), status: gb.students.map(() => 'blank'), missing: 0, excused: 0, due: '11/20' });
      s.gradeHistory = []; gb.importedAt = new Date(Date.parse(at) - 7 * 864e5).toISOString(); A.gradeSnapshot(s); const emptyCat = Object.prototype.hasOwnProperty.call(s.gradeHistory[0].rules.cat, 'Unit 3 Whiteboard');
      gb.importedAt = at; const a = gb.assignments[0]; a.values = a.values.map(() => 5); a.status = a.status.map(() => 'score'); g.map[a.name] = 'Classwork'; g.how[a.name] = 'fit'; A.gradeSnapshot(s);
      return { emptyCat, prev: !!A.prevGradeSnap(s), changed: !!A.gradeRulesChanged(s) }; }, K);
    check(!r.emptyCat && r.prev && !r.changed, 'GRD-04 round 2: an empty column carries no category, so the next week (graded, category proved) still compares ' + JSON.stringify(r));
    // item 3 wording: the CURRENT import is the one with nothing graded
    const card = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; gb.assignments.forEach(a => { a.values = a.values.map(() => null); a.status = a.status.map(() => 'blank'); a.missing = 0; }); A.gradeSnapshot(s); T.save();
      T.state.active = K; document.querySelector('#openGrades').click(); const c = [...document.querySelectorAll('#gridwrap .gcard')].find(x => /Class average/i.test(x.textContent)); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, K);
    check(/nothing is graded in this import yet/i.test(card) && !/nothing was graded on/i.test(card), 'round 2: with the current import empty, the card says so, not that the previous one was: ' + card);
    await q.context().close();
  }

  // ---- GRD-06: a new column that two categories fit is stored in one that fits; "Matches" only when nobody differs ----
  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    const r = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const g = T.gradingFor(s.prep); const NEW = 'Quiz Corrections';
      let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const keep = JSON.stringify({ map: g.map, how: g.how }); const base = gb.assignments.slice(); let found = 0, right = 0;
      for (let t = 0; t < 400 && found < 5; t++) { const o = JSON.parse(keep); g.map = o.map; g.how = o.how; const mx = [1, 2, 3, 5][t % 4]; const vals = gb.students.map(() => rnd() < 0.85 ? mx : Math.round(rnd() * mx * 2) / 2);
        gb.assignments = [{ name: NEW, category: 'Assessments', categoryFromFile: false, max: mx, values: vals, status: vals.map(() => 'score'), missing: 0, excused: 0, due: '11/13', assignedOn: '11/13' }, ...base];
        const grade = (cat, i) => A.computeGrade(s, i, null, { ...g.map, [NEW]: cat }).rounded; const focus = gb.students.map((_, i) => grade('Participation', i));
        if (!(focus.every((v, i) => grade('Classwork', i) === v) && focus.some((v, i) => grade('Assessments', i) !== v))) continue;
        gb.overall = focus; found++; A.applyCategories(s); if (g.map[NEW] !== 'Assessments' && !A.gradeOff(s).length) right++; }
      const o = JSON.parse(keep); g.map = o.map; g.how = o.how; gb.assignments = base; return { found, right }; }, K);
    check(r.found >= 3 && r.right === r.found, `GRD-06: a new column that Classwork and Participation both fit is not stored as its name guess, Assessments (${r.right} of ${r.found})`);
    await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; s.grades.overall = s.grades.students.map((_, i) => A.computeGrade(s, i).rounded); const g = T.gradingFor(s.prep);
      const a = s.grades.assignments.find(x => x.name === 'Unit 1 Notebook Check'); g.map[a.name] = 'Classwork'; g.how[a.name] = 'guess';
      s.grades.overall = s.grades.students.map((_, i) => A.computeGrade(s, i, null, { ...g.map, [a.name]: 'Assessments' }).rounded); T.save(); T.state.active = K; document.querySelector('#openGrades').click(); }, K); await q.waitForTimeout(400);
    const scr = await q.evaluate(() => ({ matches: [...document.querySelectorAll('#gridwrap .ghint')].some(x => /Matches the Focus Grade column/.test(x.textContent)), differs: !!document.querySelector('#gridwrap .gdiff') }));
    check(scr.differs && !scr.matches, `GRD-06: with a student off Focus, the Categories table does not say "Matches the Focus Grade column for all" (${JSON.stringify(scr)})`);
    await q.context().close();
  }

  // ---- GRD-07: the Categories table's average is labelled for what it is (NHI counts as 0); the Assignments table's stays ----
  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv'); await q.evaluate(K => { window.__tally.state.active = K; document.querySelector('#openGrades').click(); }, K); await q.waitForTimeout(400);
    const h = await q.evaluate(() => { const tabs = [...document.querySelectorAll('#gridwrap .gsec .checkTable')]; const th = t => t ? [...t.querySelectorAll('th')].map(x => [x.textContent.trim(), x.title]) : [];
      return { cat: th(tabs[0]), asg: th(document.querySelector('#gridwrap table.gasg')) }; });
    const c4 = h.cat[3] || [], a5 = h.asg[4] || [];
    check(c4[0] === 'Class avg' && /NHI\) counts as 0/.test(c4[1]) && !/left out/.test(c4[1]), 'GRD-07: the Categories column reads "Class avg" and its tooltip says NHI counts as 0: ' + JSON.stringify(c4));
    check(a5[0] === 'Avg (turned in)', 'GRD-07: the Assignments table keeps "Avg (turned in)": ' + JSON.stringify(a5));
    await q.context().close();
  }

  // ---- GRD-05: a closed quarter's tab shows the kept Focus final, with Tally's recount beside it where they differ ----
  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    const r = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; gb.overall[0] -= 6; gb.overall[1] += 4; [3, 4, 5, 6, 7].forEach(i => { if (gb.overall[i] != null) gb.overall[i] -= 10; });
      const re = [0, 1].map(i => A.computeGrade(s, i).rounded); A.closeQuarter(1, {}); T.save(); T.render(); const f = s.qArchive[1].final; const v = f.filter(x => x != null);
      return { re, kept: [f[0], f[1]], mean: v.reduce((a, b) => a + b, 0) / v.length, n: gb.students.length }; }, K);
    await q.evaluate(K => { window.__tally.state.active = K; document.querySelector('#openGrades').click(); }, K); await q.waitForTimeout(300);
    const q1 = await q.$('[data-gq="1"]'); if (q1) { await q1.click(); await q.waitForTimeout(400); }
    const scr = await q.evaluate(() => { const row = i => { const tr = document.querySelector(`#gridwrap .gstu tr[data-stu="${i}"]`); return tr ? tr.children[1].innerText.replace(/\s+/g, ' ').trim() : null; };
      return { card: document.querySelector('#gridwrap .gcard').innerText.replace(/\s+/g, ' '), r0: row(0), r1: row(1), r2: row(2) }; });
    const w = (k, rc) => new RegExp('^' + k + ' ?[A-F] Tally\'s recount ' + rc + '$');
    check(w(r.kept[0], r.re[0]).test(scr.r0) && w(r.kept[1], r.re[1]).test(scr.r1), `GRD-05: the Q1 tab's rows show the kept final with Tally's recount beside it (${JSON.stringify([scr.r0, scr.r1])}, kept ${r.kept}, recount ${r.re})`);
    check(!/recount/.test(scr.r2 || ''), 'GRD-05: a student whose recount equals the kept final shows one grade: ' + scr.r2);
    check(new RegExp('Final class average ' + Math.round(r.mean) + '%', 'i').test(scr.card), `GRD-05: "Final class average" is the mean of the kept finals (${Math.round(r.mean)}%): ${scr.card}`);
    await q.context().close();
  }

  // ---- TIM-01: a quarter closed at 9:30 pm Eastern is "closed" that day on the Grades screen, not the next UTC day ----
  {
    const q = await fresh('America/New_York'); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    await q.evaluate(K => { const T = window.__tally, A = window.__all; A.closeQuarter(1, {}); A.quarters().closed[1].at = '2026-10-10T01:30:00.000Z'; T.save(); T.state.active = K; document.querySelector('#openGrades').click(); }, K); await q.waitForTimeout(300);
    const q1 = await q.$('[data-gq="1"]'); if (q1) { await q1.click(); await q.waitForTimeout(400); }
    const t = await q.evaluate(() => ({ bar: [...document.querySelectorAll('.meta')].map(x => x.textContent).find(x => /closed /.test(x)) || '', note: (document.querySelector('#gridwrap .notice.soft') || {}).textContent || '' }));
    check(/closed Oct 9 /.test(t.bar) && /kept on Oct 9:/.test(t.note), 'TIM-01: the Grades bar and notice name the local day of the close (Oct 9): ' + JSON.stringify([t.bar.slice(0, 60), t.note.slice(0, 80)]));
    await q.context().close();
  }

  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    const card = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const keep = JSON.stringify(gb), at = gb.importedAt;
      s.gradeHistory = []; gb.importedAt = new Date(Date.parse(at) - 7 * 864e5).toISOString(); gb.assignments.forEach(a => { a.values = a.values.map(() => null); a.status = a.status.map(() => 'blank'); a.missing = 0; });
      A.gradeSnapshot(s); s.grades = JSON.parse(keep); s.grades.importedAt = at; A.gradeSnapshot(s); T.save(); T.state.active = K; document.querySelector('#openGrades').click();
      const c = [...document.querySelectorAll('#gridwrap .gcard')].find(x => /Class average/i.test(x.textContent)); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, K);
    check(!/since/i.test(card) && /nothing was graded on/i.test(card), 'HLT-05: the Grades card shows no change against an import with nothing graded: ' + card);
    await q.context().close();
  }

  // ---- HLT-04: no cost for the only graded column; a cost that rounds to zero never prints "-0.0" ----
  {
    const q = await fresh(); await gbIn(q, 'fixtures/focus_gradebook_scrubbed.csv');
    const r = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const n = gb.students.length; let found = null;
      for (let i = 0; i < n && !found; i++) for (let mx = 1; mx <= 20 && !found; mx++) { const a = { name: 'Tiny check', max: mx, values: gb.students.map(() => null), status: gb.students.map(() => 'excused'), missing: 0, excused: n - 1, due: '10/01' };
        a.values[i] = 0; a.status[i] = 'score'; gb.assignments.push(a); const g0 = A.computeGrade(s, i, { 'Tiny check': null }).rounded, g1 = A.computeGrade(s, i).rounded; if (g0 - g1 === 1) found = { i, mx, cost: A.classAverage(s) - A.classAverage(s, null, 'Tiny check') }; else gb.assignments.pop(); }
      T.gradingFor(s.prep).map['Tiny check'] = 'Classwork'; T.save(); T.state.active = K; document.querySelector('#openGrades').click();
      const tr = [...document.querySelectorAll('#gridwrap table.gasg tbody tr')].find(x => x.children[0].textContent === 'Tiny check'); return { found, cell: tr ? tr.lastElementChild.textContent : null }; }, K);
    check(r.found && r.found.cost < 0 && r.found.cost > -0.05 && r.cell === '0.0', `HLT-04: a cost of ${r.found && r.found.cost.toFixed(3)} prints "0.0", not "-0.0" (${JSON.stringify(r.cell)})`);
    const one = await q.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; gb.assignments = gb.assignments.filter(a => a.name === 'Unit 1 Assessment'); T.save(); T.render();
      const tr = [...document.querySelectorAll('#gridwrap table.gasg tbody tr')].find(x => x.children[0].textContent === 'Unit 1 Assessment'); return { n: gb.assignments.length, cell: tr ? tr.lastElementChild.textContent : null }; }, K);
    check(one.n === 1 && one.cell === '', `HLT-04: the only graded column has no cost (${JSON.stringify(one.cell)})`);
    await q.context().close();
  }

  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
