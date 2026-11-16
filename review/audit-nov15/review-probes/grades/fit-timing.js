// Counter-review (15 Nov 2026), GRD-01 speed: fitCategories on 35 students x 60 columns with 7 unchecked guesses and a
// Grade column no map reproduces (two students off by Focus's own reasons), for 3 to 6 categories; then six such classes
// fitted on one render (cold cache), and the time of one more render (warm cache).   TALLY_REPO=<clone> node review-probes/fit-timing.js
const path = require('path');
const REPO = process.env.TALLY_REPO;
const { chromium, exe, check, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const T = window.__tally, A = window.__all; const g = T.gradingFor('acc'); const out = {};
    const mk = (K, seed, guesses, user) => { const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const names = ['Assessments', 'Classwork', 'Participation', 'Homework', 'Projects', 'Labs'].slice(0, K); const ws = [50, 20, 10, 10, 5, 5].slice(0, K);
      g.cats = names.map((n, k) => ({ name: n, w: ws[k] })); g.map = {}; g.how = {}; g.ec = {}; g.codes = {};
      const students = Array.from({ length: 35 }, (_, i) => 'S' + i + ', T'); const truth = {};
      const assignments = Array.from({ length: 60 }, (_, j) => { const max = [5, 10, 20, 25][j % 4]; const status = students.map(() => { const x = rnd(); return x < 0.88 ? 'score' : x < 0.96 ? 'missing' : 'excused'; });
        truth['W' + j] = names[Math.floor(rnd() * K)]; return { name: 'W' + j, max, status, values: status.map(st => st === 'score' ? Math.round(rnd() * max * 2) / 2 : null) }; });
      assignments.forEach((a, j) => { g.map[a.name] = truth[a.name]; g.how[a.name] = j < guesses ? 'guess' : j < guesses + user ? 'user' : 'fit'; if (j < guesses) g.map[a.name] = names[(names.indexOf(truth[a.name]) + 1) % K]; });
      const sec = { key: 'tm' + seed, prep: 'acc', grades: { students, assignments, importedAt: '2026-11-13T15:00:00.000Z' } };
      sec.grades.overall = students.map((_, i) => A.computeGrade(sec, i, null, truth).rounded); sec.grades.overall[0] += 2; sec.grades.overall[1] -= 2;
      return sec; };
    for (const K of [3, 4, 5, 6]) { const sec = mk(K, 11 + K, 7, 0); A.fitCache.clear && A.fitCache.clear(); const t0 = performance.now(); const f = A.fitCategories(sec); out['K' + K] = { ms: Math.round(performance.now() - t0), err: f.err }; }
    { const sec = mk(3, 77, 7, 2); A.fitCache.clear && A.fitCache.clear(); const t0 = performance.now(); A.fitCategories(sec); out.withUserCols = Math.round(performance.now() - t0); }
    // six classes on one Overview render: each its own gradebook (same course, its own students)
    { const secs = [1, 2, 3, 4, 5, 6].map(k => mk(3, 1000 + k, 7, 0)); const gm = JSON.parse(JSON.stringify(g.map)), gh = JSON.parse(JSON.stringify(g.how)); A.fitCache.clear && A.fitCache.clear();
      const t0 = performance.now(); secs.forEach(s => { g.map = gm; g.how = gh; A.fitCategories(s); }); out.sixCold = Math.round(performance.now() - t0);
      const t1 = performance.now(); secs.forEach(s => { g.map = gm; g.how = gh; A.fitCategories(s); }); out.sixWarm = Math.round(performance.now() - t1); }
    return out; });
  console.log(JSON.stringify(r));
  check(r.K3.ms < 1500 && r.K4.ms < 1500, 'one full class, 3 or 4 categories, under 1.5 s');
  check(r.K5.ms < 3000 && r.K6.ms < 3000, 'one full class, 5 or 6 categories, under 3 s');
  check(r.sixCold < 4000, 'six classes on one render under 4 s');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
