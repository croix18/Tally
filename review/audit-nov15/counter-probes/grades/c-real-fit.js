// PROBE TEMPLATE for the Tally deep audit (15 Nov 2026). Copy it, rename it probes/NN-slug.js, and replace the body.
//   Run:   TALLY_REPO=/home/claude/work/audit/<you>/repo node probes/NN-slug.js
//   Exit:  1 when the defect is present (a check fails), 0 when everything checked is right.
// It must run on ANY clean audit copy (the counter agent reruns it on its own), so use only window.__tally / window.__all,
// the repo's fixtures, and data you synthesize inside the script. No real student data, ever.
const path = require('path');
const REPO = process.env.TALLY_REPO || '/home/claude/work/audit/counter-grades/repo';
const { chromium, fs, exe, check, done, pick, tmp, APP } = require(path.join(REPO, 'tests/lib.js'));   // lib.js chdirs into REPO
const K = '1205050-7T1A';   // the scrubbed real class in fixtures/ (16 counted students, accelerated)
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true /* , timezoneId: 'America/New_York' */ });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  // ---- one real (scrubbed) class: IXL Score Grid, then the Focus roster, then the Quarter 1 Focus gradebook ----
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  // (a Quarter 2 gradebook for the same class: fixtures/focus_gradebook_scrubbed_q2.csv, imported the same way)

  const run = () => p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const g = T.gradingFor(s.prep); if (!s.grades || !s.grades.overall) return { none: true, grades: !!s.grades, keys: Object.keys(s.grades||{}), arch: Object.keys(s.qArchive||{}) };
    A.fitCache && A.fitCache.clear && A.fitCache.clear();
    const f = A.fitCategories(s); const res = { exact: f && f.exact, err: f && f.err, off: A.gradeOff(s).length, n: s.grades.overall.filter(x => x != null).length, nA: s.grades.assignments.length };
    // perturb: every single stored category wrong in turn, and two wrong at once
    const saveMap = { ...g.map }, saveHow = { ...g.how }; let one = 0, oneStall = 0, two = 0, twoStall = 0; const names = g.cats.map(c => c.name);
    const as = s.grades.assignments;
    as.forEach((a, j) => names.forEach(c => { if (c === saveMap[a.name]) return; g.map = { ...saveMap, [a.name]: c }; g.how = { ...saveHow, [a.name]: 'guess' }; if (!A.gradeOff(s).length) return; one++; const r = A.fitCategories(s); if (!r.exact) oneStall++; }));
    for (let j = 0; j < as.length; j++) for (let k = j + 1; k < as.length; k++) { const c1 = names.find(c => c !== saveMap[as[j].name]), c2 = names.find(c => c !== saveMap[as[k].name]);
      g.map = { ...saveMap, [as[j].name]: c1, [as[k].name]: c2 }; g.how = { ...saveHow, [as[j].name]: 'guess', [as[k].name]: 'guess' }; if (!A.gradeOff(s).length) continue; two++; if (!A.fitCategories(s).exact) twoStall++; }
    g.map = saveMap; g.how = saveHow;
    return { ...res, one, oneStall, two, twoStall, how: Object.values(saveHow).join(',') }; }, K);
  const q1 = await run();
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed_q2.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const q2 = await run();
  console.log('OBSERVED: Q1', JSON.stringify(q1)); console.log('OBSERVED: Q2', JSON.stringify(q2));
  check(q1.exact && q1.off === 0 && q2.exact && q2.off === 0, 'the scrubbed real class fits exactly');
  check(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); done();   // done() sets the exit code: 1 if any check failed
})().catch(e => { console.error(e); process.exit(2); });
