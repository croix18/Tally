// GRD-06: a NEW assignment that the fit cannot pin to one category (two categories both reproduce every Focus grade)
// is stored as its NAME GUESS even when the guess is the one category that does NOT reproduce the grades.
// applyCategories (grades.js line 114-126): `if (!g.map[a.name]) { g.map[a.name] = catGuess(...) ... ask.push }`; the
// fit's own exact map is ignored. The import then asks with "Focus's grades proved every other assignment. These fit
// more than one category without changing anyone's grade" over a pre-filled choice that DOES change grades, and the
// Grades screen says "Matches the Focus Grade column for all N students" beside "Tally's grade differs from Focus's".
// Built on the scrubbed real class: one new small column (1-5 points), "Quiz Corrections" (named like an assessment: Tally guesses
// Assessments), that Focus has in Participation; with Participation at 5 % moving it to Classwork changes nobody's
// rounded grade, so the fit is exact but the column is not determined.
const path = require('path');
const REPO = process.env.TALLY_REPO || path.resolve(__dirname, '../repo');
const { chromium, fs, exe, check, done, pick, APP } = require(path.join(REPO, 'tests/lib.js'));
const K = '1205050-7T1A';
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + path.resolve(APP));
  const ixl = fs.readdirSync('fixtures').find(f => f.startsWith('ixl_7T1A_scrubbed'));
  await p.setInputFiles('#file', [path.resolve('fixtures', ixl)]); await p.waitForTimeout(500);
  await p.fill('#rpText', fs.readFileSync('fixtures/focus_roster_scrubbed.txt', 'utf8')); await p.click('#rpSave'); await p.waitForTimeout(300);
  await p.setInputFiles('#file', [path.resolve('fixtures/focus_gradebook_scrubbed.csv')]); await p.waitForTimeout(500); await pick(p); await p.waitForTimeout(600);
  const r = await p.evaluate(K => { const T = window.__tally, A = window.__all; const s = T.state.sections[K]; const gb = s.grades; const g = T.gradingFor(s.prep); const n = gb.students.length;
    const NEW = 'Quiz Corrections'; let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const keep = JSON.stringify({ map: g.map, how: g.how });
    for (let t = 0; t < 400; t++) {
      const o = JSON.parse(keep); g.map = o.map; g.how = o.how; gb.assignments = gb.assignments.filter(a => a.name !== NEW);
      const mx = [1, 2, 3, 5][t % 4]; const vals = gb.students.map(() => rnd() < 0.85 ? mx : Math.round(rnd() * mx * 2) / 2);
      gb.assignments.unshift({ name: NEW, category: 'Assessments', categoryFromFile: false, max: mx, values: vals, status: vals.map(() => 'score'), missing: 0, excused: 0, due: '11/13', assignedOn: '11/13' });
      const grade = (cat, i) => A.computeGrade(s, i, null, { ...g.map, [NEW]: cat }).rounded;
      const focus = gb.students.map((_, i) => grade('Participation', i));
      const okC = focus.every((v, i) => grade('Classwork', i) === v), badA = focus.some((v, i) => grade('Assessments', i) !== v);
      if (!(okC && badA)) continue;
      gb.overall = focus;                                                     // Focus's Grade column: the new column in Participation
      const ap = A.applyCategories(s); const fit = A.fitCategories(s);
      return { tries: t + 1, max: mx, guess: A.catGuess(NEW, g.cats), fitMap: fit.map[NEW], exact: fit.exact, determined: fit.determined[NEW], stored: g.map[NEW], how: g.how[NEW], asked: ap.ask,
        off: A.gradeOff(s).length, of: n, fitSaysAllMatch: fit.exact };
    }
    return null; }, K);
  // what the screen says
  await p.evaluate(() => { const T = window.__tally; T.save(); });
  await p.click(`[data-k="${K}"]`).catch(() => {}); await p.waitForTimeout(200); await p.click('#openGrades'); await p.waitForTimeout(400);
  const scr = await p.evaluate(() => ({ matches: [...document.querySelectorAll('#gridwrap .ghint')].map(x => x.textContent).find(t => /Matches the Focus Grade column/.test(t)) || null, differs: (document.querySelector('#gridwrap .gdiff') || {}).textContent || null }));
  console.log('OBSERVED:', JSON.stringify(r)); console.log('OBSERVED: screen', JSON.stringify({ matches: scr.matches, differs: scr.differs && scr.differs.replace(/\s+/g, ' ').split(':')[0] }));
  console.log('EXPECTED: the new column is stored in a category that reproduces every grade (the fit\'s, ' + (r && r.fitMap) + ', or the guess only when the guess also reproduces them); then no student differs, and "Matches … for all" is never shown beside "differs"');
  check(!!r, 'setup found');
  check(r && r.off === 0, 'after the import nobody differs from Focus');
  check(!(scr.matches && scr.differs), 'the screen does not say "matches for all" and "differs" at once');
  check(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); done();
})().catch(e => { console.error(e); process.exit(2); });
