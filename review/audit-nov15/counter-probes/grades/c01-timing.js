// time fitCategories on a 35 x 60 class whose Focus grades nothing explains (fit never exact): original vs the steepest-descent fix
const path = require('path'); const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-grades/repo';
const { chromium, exe, done, APP } = require(path.join(REPO, 'tests/lib.js'));
(async () => { const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext()).newPage();
  await p.goto('file://' + path.resolve(APP)); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const T = window.__tally, A = window.__all; let seed = 3; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const g = T.gradingFor('acc'); g.cats = [{ name: 'Assessments', w: 70 }, { name: 'Classwork', w: 25 }, { name: 'Participation', w: 5 }]; const out = [];
    for (let t = 0; t < 3; t++) { const nS = 35, nA = 60; const students = Array.from({ length: nS }, (_, i) => 'S' + i + ', T'); const assignments = [];
      for (let j = 0; j < nA; j++) { const max = 10; assignments.push({ name: 'Item ' + t + '-' + j, max, values: students.map(() => Math.round(rnd() * 20) / 2), status: students.map(() => 'score') }); }
      g.map = {}; g.how = {}; assignments.forEach(a => { g.map[a.name] = 'Classwork'; g.how[a.name] = 'guess'; });
      const sec = { key: 'tm' + t, prep: 'acc', grades: { students, assignments, overall: students.map(() => 50 + Math.floor(rnd() * 50)), importedAt: '2026-11-13T15:00:00.000Z' } };
      const t0 = performance.now(); const f = A.fitCategories(sec); out.push({ ms: Math.round(performance.now() - t0), err: f.err }); }
    return out; });
  console.log('OBSERVED:', JSON.stringify(r)); await b.close(); done(); })();
