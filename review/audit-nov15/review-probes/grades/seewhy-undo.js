// Counter-review (15 Nov 2026), GRD-02/03: every See why fix, pressed as the button does (fix.run, regradeCourse), then
// Undo (gradingRestore). Checks: a sentence with no "not counted / zeros / NHI" part leaves no student off once applied;
// a compound sentence holds once its category part is applied AND its stated cell change is made; Undo restores
// weights, categories, how, text rules and extra credit exactly. Also counts compound sentences that name a move for the
// very column they say is not counted.   TALLY_REPO=<clone> N=400 node review-probes/seewhy-undo.js
const path = require('path');
const REPO = process.env.TALLY_REPO;
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
const N = Number(process.env.N || 400);
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const r = await p.evaluate(([N, process_settle]) => {
    const T = window.__tally, A = window.__all; const g = T.gradingFor('acc');
    let seed = 2024; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pk = arr => arr[Math.floor(rnd() * arr.length)];
    const CATS = ['Assessments', 'Classwork', 'Participation'];
    const out = { cases: 0, fixes: 0, plainBad: [], compound: 0, compoundBad: [], selfMove: [], undoBad: [], kinds: {} };
    for (let t = 0; t < N; t++) {
      const nS = ri(12, 28), nA = ri(5, 14); const students = Array.from({ length: nS }, (_, i) => 'S' + i + ', T'); const assignments = [], truth = {};
      for (let j = 0; j < nA; j++) { const max = pk([5, 10, 20, 25, 50]); const values = [], status = [];
        for (let i = 0; i < nS; i++) { const x = rnd(); const st = x < 0.85 ? 'score' : x < 0.95 ? 'missing' : 'excused'; status.push(st); values.push(st === 'score' ? ri(0, max * 2) / 2 : null); }
        assignments.push({ name: 'Item ' + j, max, values, status, missing: status.filter(x => x === 'missing').length }); truth['Item ' + j] = pk(CATS); }
      const W = pk([[70, 25, 5], [60, 30, 10]]); const kind = pk(['user', 'drop', 'weights', 'guess2']); out.kinds[kind] = (out.kinds[kind] || 0) + 1;
      g.cats = CATS.map((c, k) => ({ name: c, w: W[k] })); g.map = { ...truth }; g.how = {}; assignments.forEach(a => g.how[a.name] = 'fit'); g.ec = {}; g.codes = {};
      const key = 'sw' + t; const sec = { key, prep: 'acc', label: 'SW', students: [], skills: [], scores: [], grades: { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' } };
      const dropName = kind === 'drop' ? assignments[nA - 1].name : null;
      sec.grades.overall = students.map((_, i) => A.computeGrade(sec, i, dropName ? { [dropName]: null } : null).rounded);
      if (kind === 'user') { const a = pk(assignments); g.map[a.name] = pk(CATS.filter(c => c !== truth[a.name])); g.how[a.name] = 'user'; }
      if (kind === 'weights') g.cats = CATS.map((c, k) => ({ name: c, w: [65, 30, 5][k] }));
      if (kind === 'guess2' || kind === 'drop') for (let k = 0; k < 2; k++) { const a = assignments[k]; g.map[a.name] = pk(CATS); g.how[a.name] = 'guess'; }
      T.state.sections[key] = sec; T.state.order.push(key); if (process_settle) A.regradeCourse('acc');   // as the import leaves it
      try {
        if (!A.gradeOff(sec).length) continue; const fit = A.fitCategories(sec); const gd = A.gradeDiff(sec, fit); if (!gd) continue; out.cases++;
        gd.whole.forEach(w => { if (!w.fix) return; out.fixes++; const html = w.html.replace(/<[^>]+>/g, '');
          const snap = A.gradingSnap('acc'); w.fix.run(); A.regradeCourse('acc');
          const m = html.match(/ and (?:(.+?) not counted|the empty cells on (.+?) counted as zeros|the NHIs on (.+?) not counted|(every blank cell counted as a zero)|(no NHI counted))\. /);
          if (!m) { const left = A.gradeOff(sec).length; if (left && out.plainBad.length < 4) out.plainBad.push({ t, html, left }); }
          else { out.compound++; const nm = m[1] || m[2] || m[3]; const col = assignments.find(a => a.name === nm);
            const over = i => m[1] ? { [nm]: null } : m[2] ? (col.status[i] !== 'score' && col.status[i] !== 'missing' ? { [nm]: 0 } : null) : m[3] ? (col.status[i] === 'missing' ? { [nm]: null } : null)
              : m[4] ? Object.fromEntries(assignments.filter(a => a.status[i] === 'blank').map(a => [a.name, 0])) : Object.fromEntries(assignments.filter(a => a.status[i] === 'missing').map(a => [a.name, null]));
            const left = students.filter((_, i) => sec.grades.overall[i] != null && (A.computeGrade(sec, i, over(i)) || {}).rounded !== sec.grades.overall[i]).length;
            if (left && out.compoundBad.length < 4) out.compoundBad.push({ t, html, left });
            if (nm && new RegExp('with (.*, )?' + nm.replace(/ /g, ' ') + ' in ').test(html.split(' and ' + nm)[0]) && out.selfMove.length < 4) out.selfMove.push({ t, html }); }
          A.gradingRestore('acc', snap); const back = A.gradingSnap('acc'); if (back !== snap && out.undoBad.length < 4) { const x = JSON.parse(snap), y = JSON.parse(back); out.undoBad.push({ t, html, how: Object.keys(x.how).filter(k => x.how[k] !== y.how[k] || x.map[k] !== y.map[k]).map(k => `${k}: ${x.how[k]}/${x.map[k]} -> ${y.how[k]}/${y.map[k]}`) }); }
        });
      } finally { delete T.state.sections[key]; T.state.order = T.state.order.filter(k => k !== key); }
    }
    return out;
  }, [N, !!process.env.SETTLE]);
  console.log(JSON.stringify(r));
  check(!r.plainBad.length, 'a See why fix with no outside part leaves nobody off');
  check(!r.compoundBad.length, 'a compound sentence holds once both parts are applied');
  check(!r.undoBad.length, 'Undo restores the grading settings exactly');
  check(!r.selfMove.length, 'a compound sentence never moves the column it says is not counted');
  check(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
